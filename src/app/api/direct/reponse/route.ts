import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/api-auth';
import { accesAccorde, accesManche, enregistrerReponse, mancheDeLEleve } from '@/lib/manche-server';
import { mancheId } from '@/types/manche';
import type { LectureAnswer } from '@/types/lecture';

// POST /api/direct/reponse — l'élève répond à la question EN COURS.
//
// Le temps de réponse est mesuré ICI, à l'arrivée, et jamais annoncé par le
// navigateur : avec un podium au bout, le chronomètre ne peut pas vivre chez
// celui qui joue.
//
// Une réponse ne se corrige pas : la première reçue est la bonne. Sans quoi il
// suffirait d'attendre la révélation pour changer d'avis.
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
      answer?: LectureAnswer;
    };
    const { questionId, answer, devoirId } = body;
    const sessionId = body.sessionId;

    if (!questionId || !answer || typeof answer !== 'object') {
      return NextResponse.json({ success: false, message: 'Requête invalide' }, { status: 400 });
    }

    // Même résolution que pour l'état : sa classe désigne sa partie, et il
    // peut en avoir plusieurs (`mancheDeLEleve`).
    let id: string | null = sessionId ? mancheId(sessionId) : null;
    if (!id && devoirId) id = await mancheDeLEleve(devoirId, auth.uid, auth.email);
    if (!id) {
      return NextResponse.json({ success: false, message: 'Aucune partie' }, { status: 404 });
    }
    const acces = await accesManche(id, auth);
    if (!accesAccorde(acces)) {
      return NextResponse.json({ success: false, message: 'Accès refusé' }, { status: 403 });
    }

    const res = await enregistrerReponse(id, auth.uid, questionId, answer);
    // Un refus n'est pas une erreur : le chrono a pu expirer pendant l'envoi,
    // ou l'élève a cliqué deux fois. L'écran affiche « réponse enregistrée »
    // dans les deux cas — ce n'est pas le moment de lui parler technique.
    return NextResponse.json({ success: true, data: res });
  } catch (error) {
    console.error('Erreur POST /api/direct/reponse:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
