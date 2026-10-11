import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { poserAnnonce } from '@/lib/annonce-server';
import { profPeutGerer } from '@/lib/portfolio-groupe-server';
import { lirePortfolioContenu } from '@/lib/portfolio-server';
import { cibleSuivi } from '@/lib/portfolio-suivi-server';

// LA CLOCHE d'une étape, dans la copie d'un portfolio lue par le prof (JP,
// 2026-10-11) : un message à l'élève — ou à tout son groupe accepté —, posé
// dans sa cloche avec le titre de l'étape et un lien vers le portfolio.
//
// POST { devoirId, eleve: uid, etapeId, message } → { envoyes: nombre d'élèves prévenus }

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  if (auth.role !== 'prof') return NextResponse.json({ success: false, message: 'Réservé aux professeurs' }, { status: 403 });

  try {
    const body = await request.json();
    const devoirId = typeof body.devoirId === 'string' ? body.devoirId : '';
    const eleve = typeof body.eleve === 'string' ? body.eleve : '';
    const etapeId = typeof body.etapeId === 'string' ? body.etapeId : '';
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 800) : '';
    if (!devoirId || !eleve || !message) {
      return NextResponse.json({ success: false, message: 'Message vide' }, { status: 400 });
    }

    const devoirSnap = await adminDb.collection('devoirs').doc(devoirId).get();
    if (!devoirSnap.exists || devoirSnap.data()?.typeTravail !== 'portfolio') {
      return NextResponse.json({ success: false, message: 'Portfolio introuvable' }, { status: 404 });
    }
    if (!auth.isAdmin && !(await profPeutGerer(devoirId, auth))) {
      return NextResponse.json({ success: false, message: 'Acces refuse' }, { status: 403 });
    }
    const etape = lirePortfolioContenu(devoirSnap.data()?.portfolio).etapes.find((e) => e.id === etapeId);
    const titre = etape?.titre?.trim();

    // L'élève, ou son groupe accepté (les mêmes destinataires qu'un retour du prof)
    const { uids } = await cibleSuivi(devoirId, eleve);
    await Promise.all(
      uids.map((uid) =>
        poserAnnonce({
          message: titre ? `« ${titre} » — ${message}` : message,
          cible: 'eleve',
          destinataireUid: uid,
          auteurUid: auth.uid,
          lien: `/activites/${devoirId}`,
          etiquette: '🗂️ Portfolio',
        })
      )
    );
    return NextResponse.json({ success: true, data: { envoyes: uids.length } });
  } catch (error) {
    console.error('Erreur POST /api/portfolio/message:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
