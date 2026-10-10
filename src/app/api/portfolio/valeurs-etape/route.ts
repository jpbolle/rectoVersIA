import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { lirePortfolioContenu } from '@/lib/portfolio-server';
import { cibleSuivi, suiviDe } from '@/lib/portfolio-suivi-server';
import { identiteEleve, sequenceOuverteA } from '@/lib/sequence-server';
import { valeursAffichees } from '@/types/portfolio';

// Les VALEURS attribuées qu'une étape-RENVOI transmet à son activité (phase 3
// du plan 2026-10-10) : l'élève ouvre le questionnaire depuis son portfolio
// (`/activites/{devoirId}?portfolio={P}&etape={E}`) ; la page demande ici ce
// que l'étape E affiche — « Le sketch » de SON groupe — et le montre dans
// l'onglet Ressources.
//
// GET ?portfolio=&etape=&devoirId=  (élève)
//  → [{ valeurId, nom, genre, valeur | null }]

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  if (auth.role !== 'eleve') return NextResponse.json({ success: true, data: [] });

  try {
    const params = request.nextUrl.searchParams;
    const portfolioId = params.get('portfolio') || '';
    const etapeId = params.get('etape') || '';
    const devoirId = params.get('devoirId') || '';
    const snap = portfolioId ? await adminDb.collection('devoirs').doc(portfolioId).get() : null;
    if (!snap?.exists || snap.data()?.typeTravail !== 'portfolio') return NextResponse.json({ success: true, data: [] });

    const identite = await identiteEleve(auth.uid, auth.email);
    if (!(await sequenceOuverteA({ id: portfolioId, ...snap.data() }, identite))) {
      return NextResponse.json({ success: true, data: [] });
    }
    const etapes = lirePortfolioContenu(snap.data()!.portfolio).etapes;
    const etape = etapes.find((e) => e.id === etapeId);
    // L'étape doit bien renvoyer à l'activité ouverte
    if (!etape || etape.nature !== 'activite' || etape.devoirId !== devoirId || !(etape.affiche?.length)) {
      return NextResponse.json({ success: true, data: [] });
    }

    const suivi = await suiviDe((await cibleSuivi(portfolioId, auth.uid, auth.email)).cle);
    return NextResponse.json({ success: true, data: valeursAffichees(etapes, etape, suivi) });
  } catch (error) {
    console.error('Erreur GET /api/portfolio/valeurs-etape:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
