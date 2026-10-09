import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { docToPortfolioMatrice, etapesPortfolioPourFirestore } from '@/lib/portfolio-server';
import { sanitizeRessources } from '@/lib/ressources-server';

// Une matrice de portfolio : lecture, modification, archivage.
// On ne modifie que SES matrices (ou l'admin).

type Params = { params: Promise<{ id: string }> };

async function matriceDuProf(id: string, auth: { uid: string; isAdmin: boolean }) {
  const ref = adminDb.collection('portfolios').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ref, snap, erreur: NextResponse.json({ success: false, message: 'Portfolio introuvable' }, { status: 404 }) };
  if (snap.data()?.profId !== auth.uid && !auth.isAdmin) {
    return { ref, snap, erreur: NextResponse.json({ success: false, message: 'Ce portfolio appartient à un autre professeur' }, { status: 403 }) };
  }
  return { ref, snap, erreur: null };
}

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  if (auth.role !== 'prof') return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
  try {
    const { id } = await params;
    const { snap, erreur } = await matriceDuProf(id, auth);
    if (erreur) return erreur;
    return NextResponse.json({ success: true, data: docToPortfolioMatrice(snap) });
  } catch (error) {
    console.error('Erreur GET /api/portfolios/[id]:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  if (auth.role !== 'prof') return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
  try {
    const { id } = await params;
    const { ref, erreur } = await matriceDuProf(id, auth);
    if (erreur) return erreur;

    const body = await request.json();
    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body.titre === 'string' && body.titre.trim()) update.titre = body.titre.trim().slice(0, 200);
    if (typeof body.description === 'string') update.description = body.description.trim().slice(0, 1000);
    if (typeof body.tacheFinale === 'string') update.tacheFinale = body.tacheFinale.trim().slice(0, 2000);
    if (typeof body.consignes === 'string') update.consignes = body.consignes.slice(0, 10000);
    if (body.ressources !== undefined) {
      update.ressources = body.ressources ? sanitizeRessources(body.ressources, { codeAutorise: auth.isAdmin }) : null;
    }
    if (body.etapes !== undefined) update.etapes = etapesPortfolioPourFirestore(body.etapes, { codeAutorise: auth.isAdmin });
    if (typeof body.archive === 'boolean') update.archive = body.archive;

    await ref.update(update);
    const apres = await ref.get();
    return NextResponse.json({ success: true, data: docToPortfolioMatrice(apres) });
  } catch (error) {
    console.error('Erreur PATCH /api/portfolios/[id]:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

// DELETE = archiver. Une matrice a pu servir à des activités : on ne supprime jamais.
export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  if (auth.role !== 'prof') return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
  try {
    const { id } = await params;
    const { ref, erreur } = await matriceDuProf(id, auth);
    if (erreur) return erreur;
    await ref.update({ archive: true, updatedAt: new Date() });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur DELETE /api/portfolios/[id]:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
