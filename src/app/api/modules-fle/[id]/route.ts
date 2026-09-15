import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { docToModuleFle, idsPourFirestore } from '@/lib/module-fle-server';
import { sanitizeRessources } from '@/lib/ressources-server';

// Un module FLE : lecture, modification, archivage.
// On ne modifie que SES modules (ou l'admin) — celui d'un collègue se duplique.

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

  try {
    const { id } = await params;
    const snap = await adminDb.collection('modulesFle').doc(id).get();
    if (!snap.exists) {
      return NextResponse.json({ success: false, message: 'Module introuvable' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: docToModuleFle(snap) });
  } catch (error) {
    console.error('Erreur GET /api/modules-fle/[id]:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  if (auth.role !== 'prof') return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });

  try {
    const { id } = await params;
    const ref = adminDb.collection('modulesFle').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ success: false, message: 'Module introuvable' }, { status: 404 });
    }
    const moduleFle = docToModuleFle(snap);
    if (moduleFle.profId !== auth.uid && !auth.isAdmin) {
      return NextResponse.json(
        { success: false, message: 'Ce module appartient à un autre professeur — duplique-le pour le modifier' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body.titre === 'string' && body.titre.trim()) update.titre = body.titre.trim().slice(0, 200);
    if (typeof body.description === 'string') update.description = body.description.trim().slice(0, 1000);
    if (typeof body.type === 'string') update.type = body.type.trim().slice(0, 60);
    if (typeof body.niveau === 'string') update.niveau = body.niveau.trim().slice(0, 60);
    if (Array.isArray(body.competences)) update.competences = idsPourFirestore(body.competences);
    if (typeof body.introduction === 'string') update.introduction = body.introduction;
    if (body.ressources !== undefined) {
      update.ressources = sanitizeRessources(body.ressources, { codeAutorise: auth.isAdmin });
    }
    if (typeof body.archive === 'boolean') update.archive = body.archive;
    if (auth.isAdmin && typeof body.shared === 'boolean') update.shared = body.shared;

    await ref.update(update);
    const apres = await ref.get();
    return NextResponse.json({ success: true, data: docToModuleFle(apres) });
  } catch (error) {
    console.error('Erreur PATCH /api/modules-fle/[id]:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

// DELETE = archiver. Un module peut être référencé par une séquence en cours :
// on ne supprime jamais.
export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  if (auth.role !== 'prof') return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });

  try {
    const { id } = await params;
    const ref = adminDb.collection('modulesFle').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ success: false, message: 'Module introuvable' }, { status: 404 });
    }
    if (snap.data()?.profId !== auth.uid && !auth.isAdmin) {
      return NextResponse.json({ success: false, message: 'Acces refuse' }, { status: 403 });
    }
    await ref.update({ archive: true, updatedAt: new Date() });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur DELETE /api/modules-fle/[id]:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
