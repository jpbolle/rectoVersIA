import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { COLLECTION_ALERTES, couper, reactiverIa } from '@/lib/consommation-ia';
import { construireRapport } from '@/lib/rapport-couts';

// Gestion des coûts IA (admin) — plan harnais/plans/2026-10-15-gestion-couts-ia.md
//
// GET ?mois=AAAA-MM → le rapport du mois (coûts par jour, fonction, modèle,
//   activité, élève ; erreurs fréquentes ; alertes ; coupures ; console).
//   Ouvrir la page relance aussi la surveillance depuis la base.
// POST { action: 'reactiver', devoirId } → rend l'IA à une activité coupée
// POST { action: 'couper', devoirId } → coupe l'IA d'une activité à la main
// POST { action: 'vue', id } | { action: 'toutesVues' } → alertes lues

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth?.isAdmin) return NextResponse.json({ success: false, message: 'Accès réservé' }, { status: 403 });
  try {
    const rapport = await construireRapport(request.nextUrl.searchParams.get('mois'));
    return NextResponse.json({ success: true, data: rapport });
  } catch (error) {
    console.error('Erreur GET /api/admin/couts:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth?.isAdmin) return NextResponse.json({ success: false, message: 'Accès réservé' }, { status: 403 });
  try {
    const body = (await request.json()) as { action?: string; devoirId?: string; id?: string };
    if (body.action === 'reactiver' && typeof body.devoirId === 'string' && body.devoirId) {
      await reactiverIa(body.devoirId);
      return NextResponse.json({ success: true });
    }
    if (body.action === 'couper' && typeof body.devoirId === 'string' && body.devoirId) {
      await couper(body.devoirId, ['Coupure manuelle par l’administrateur'], 0, 0, 'Coupée à la main par l’administrateur');
      return NextResponse.json({ success: true });
    }
    if (body.action === 'vue' && typeof body.id === 'string' && body.id) {
      await adminDb.collection(COLLECTION_ALERTES).doc(body.id).update({ vue: true });
      return NextResponse.json({ success: true });
    }
    if (body.action === 'toutesVues') {
      const snap = await adminDb.collection(COLLECTION_ALERTES).where('vue', '==', false).limit(400).get();
      const lot = adminDb.batch();
      snap.docs.forEach((d) => lot.update(d.ref, { vue: true }));
      await lot.commit();
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ success: false, message: 'Action inconnue' }, { status: 400 });
  } catch (error) {
    console.error('Erreur POST /api/admin/couts:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
