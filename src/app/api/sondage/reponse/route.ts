import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/api-auth';
import { accesAccorde, accesManche, mancheDeLEleve } from '@/lib/manche-server';
import { enregistrerReponseSondage } from '@/lib/sondage-server';
import { mancheId } from '@/types/manche';
import type { AutoEvalAnswer } from '@/types/autoevaluation';

// POST /api/sondage/reponse — l'élève répond à la question EN COURS.
//
// Une réponse ne se corrige pas : la première reçue est la bonne. Le serveur
// retient QUI a répondu (pour refuser une seconde réponse) mais ne le ressert
// jamais : le sondage est anonyme.
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
      sessionId?: string;
      devoirId?: string;
      questionId?: string;
      answer?: AutoEvalAnswer;
    };
    const { questionId, answer, devoirId, sessionId } = body;

    if (!questionId || !answer || typeof answer !== 'object') {
      return NextResponse.json({ success: false, message: 'Requête invalide' }, { status: 400 });
    }

    let id: string | null = sessionId ? mancheId(sessionId) : null;
    if (!id && devoirId) id = await mancheDeLEleve(devoirId, auth.uid, auth.email);
    if (!id) {
      return NextResponse.json({ success: false, message: 'Aucun sondage' }, { status: 404 });
    }
    const acces = await accesManche(id, auth);
    if (!accesAccorde(acces)) {
      return NextResponse.json({ success: false, message: 'Accès refusé' }, { status: 403 });
    }

    const res = await enregistrerReponseSondage(id, auth.uid, questionId, answer);
    return NextResponse.json({ success: true, data: res });
  } catch (error) {
    console.error('Erreur POST /api/sondage/reponse:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
