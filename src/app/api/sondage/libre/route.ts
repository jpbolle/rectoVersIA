import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/api-auth';
import {
  enregistrerReponsesLibres,
  etatLibreDeLEleve,
  mancheLibrePourEleve,
} from '@/lib/sondage-server';
import type { AutoEvalAnswer } from '@/types/autoevaluation';

// SONDAGE ANONYME AU RYTHME DE L'ÉLÈVE (2026-10-09, manche « libre »).
//
// GET  ?devoirId=DEV-…  → où en est l'élève : { aRepondu, ferme }
// POST { devoirId, answers } → il envoie TOUTES ses réponses, une seule fois.
//
// Même contrat que le direct : le serveur retient qui a envoyé (pour refuser
// un second envoi) et ne le sert jamais — rien dans `travaux`, rien au profil.
// Un prof n'a rien à faire ici : ses réponses iraient dans la répartition.

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 });
  }
  if (auth.role === 'prof') {
    return NextResponse.json({ success: true, data: { aRepondu: false, ferme: false, apercu: true } });
  }
  const devoirId = request.nextUrl.searchParams.get('devoirId');
  if (!devoirId) {
    return NextResponse.json({ success: false, message: 'devoirId requis' }, { status: 400 });
  }
  try {
    const etat = await etatLibreDeLEleve(devoirId, auth.uid, auth.email);
    return NextResponse.json({ success: true, data: etat });
  } catch (error) {
    console.error('Erreur GET /api/sondage/libre:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 });
  }
  if (auth.role === 'prof') {
    return NextResponse.json({ success: false, message: 'Accès refusé' }, { status: 403 });
  }
  try {
    const body = (await request.json()) as {
      devoirId?: string;
      answers?: Record<string, AutoEvalAnswer>;
    };
    const { devoirId, answers } = body;
    if (!devoirId || !answers || typeof answers !== 'object') {
      return NextResponse.json({ success: false, message: 'Requête invalide' }, { status: 400 });
    }
    const manche = await mancheLibrePourEleve(devoirId, auth.uid, auth.email);
    if (!manche) {
      return NextResponse.json({ success: false, message: 'Aucun sondage ouvert' }, { status: 404 });
    }
    if (manche.phase === 'finie') {
      return NextResponse.json({ success: true, data: { ok: false, motif: 'phase' } });
    }
    const res = await enregistrerReponsesLibres(manche.id, auth.uid, answers);
    return NextResponse.json({ success: true, data: res });
  } catch (error) {
    console.error('Erreur POST /api/sondage/libre:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
