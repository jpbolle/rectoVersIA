// Une œuvre : son sommaire (léger), sa modification, son archivage.
// Le CONTENU des sections vit dans la sous-collection — voir
// /api/oeuvres/[id]/sections. C'est tout l'intérêt du découpage : ouvrir une
// œuvre ne télécharge que des titres.

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { chapitresPourFirestore, docToOeuvre, rafraichirSommaire } from '@/lib/oeuvre-server';
import type { OeuvreChapitre } from '@/types/oeuvre';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

  try {
    const { id } = await params;
    const snap = await adminDb.collection('oeuvres').doc(id).get();
    if (!snap.exists) {
      return NextResponse.json({ success: false, message: 'Œuvre introuvable' }, { status: 404 });
    }

    const oeuvre = docToOeuvre(snap);
    // Le sommaire stocké peut avoir vieilli (une question ajoutée à une
    // section ne le met pas à jour) : on le recalcule depuis les sections.
    oeuvre.chapitres = await rafraichirSommaire(id);

    return NextResponse.json({ success: true, data: oeuvre });
  } catch (error) {
    console.error('Erreur GET /api/oeuvres/[id]:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  if (auth.role !== 'prof') return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });

  try {
    const { id } = await params;
    const ref = adminDb.collection('oeuvres').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ success: false, message: 'Œuvre introuvable' }, { status: 404 });
    }

    // On ne modifie que ses propres œuvres : pour reprendre celle d'un
    // collègue, on la duplique.
    const oeuvre = docToOeuvre(snap);
    if (oeuvre.profId !== auth.uid && !auth.isAdmin) {
      return NextResponse.json(
        { success: false, message: 'Cette œuvre appartient à un autre professeur — duplique-la pour la modifier' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const update: Record<string, unknown> = { updatedAt: new Date() };

    if (typeof body.titre === 'string' && body.titre.trim()) update.titre = body.titre.trim();
    if (typeof body.auteur === 'string') update.auteur = body.auteur.trim();
    if (typeof body.description === 'string') update.description = body.description.trim();
    if (typeof body.archive === 'boolean') update.archive = body.archive;
    if (auth.isAdmin && typeof body.shared === 'boolean') update.shared = body.shared;

    // Le sommaire est envoyé en entier quand le prof réordonne chapitres et
    // sections. Les sections elles-mêmes ne bougent pas : seul l'ordre change.
    if (Array.isArray(body.chapitres)) {
      // Même garde-fou que partout : aucun `undefined` ne part vers Firestore
      update.chapitres = chapitresPourFirestore(
        (body.chapitres as OeuvreChapitre[]).map((c) => ({
          ...c,
          sections: Array.isArray(c.sections) ? c.sections : [],
        }))
      );
    }

    await ref.update(update);
    const apres = await ref.get();
    return NextResponse.json({ success: true, data: docToOeuvre(apres) });
  } catch (error) {
    console.error('Erreur PATCH /api/oeuvres/[id]:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  if (auth.role !== 'prof') return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });

  try {
    const { id } = await params;
    const ref = adminDb.collection('oeuvres').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ success: false, message: 'Œuvre introuvable' }, { status: 404 });
    }
    if (docToOeuvre(snap).profId !== auth.uid && !auth.isAdmin) {
      return NextResponse.json({ success: false, message: 'Acces refuse' }, { status: 403 });
    }

    // Une œuvre peut être donnée à des activités en cours : on ARCHIVE, on ne
    // supprime pas. Les activités qui la référencent continuent de l'ouvrir.
    await ref.update({ archive: true, updatedAt: new Date() });
    return NextResponse.json({ success: true, message: 'Œuvre archivée' });
  } catch (error) {
    console.error('Erreur DELETE /api/oeuvres/[id]:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
