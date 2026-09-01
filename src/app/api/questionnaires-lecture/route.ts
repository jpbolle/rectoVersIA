import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { calculateSchoolYear } from '@/lib/auth-utils';
import { sanitizeLectureQuiz } from '@/lib/lecture-server';
import { listerQuestionnaires, quizPourFirestore } from '@/lib/questionnaire-lecture-server';
import { generateQuestionnaireLectureId } from '@/types/questionnaire-lecture';

// GET — la bibliothèque du prof : les siens, puis les exemples partagés.
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 });
  }
  if (auth.role !== 'prof') {
    return NextResponse.json({ success: false, message: 'Accès refusé' }, { status: 403 });
  }

  try {
    return NextResponse.json({ success: true, data: await listerQuestionnaires(auth.uid) });
  } catch (error) {
    console.error('Erreur GET /api/questionnaires-lecture:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

// POST — créer un questionnaire dans la bibliothèque.
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 });
  }
  if (auth.role !== 'prof') {
    return NextResponse.json({ success: false, message: 'Accès refusé' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const nom = typeof body.nom === 'string' ? body.nom.trim() : '';
    if (!nom) {
      return NextResponse.json({ success: false, message: 'Nom requis' }, { status: 400 });
    }

    const id = generateQuestionnaireLectureId();
    const maintenant = new Date();
    await adminDb
      .collection('questionnairesLecture')
      .doc(id)
      .set({
        id,
        nom,
        description: typeof body.description === 'string' ? body.description.trim() : '',
        profId: auth.uid,
        anneeScolaire: calculateSchoolYear(),
        archive: false,
        // Le contenu passe par le MÊME garde-fou que celui des activités :
        // c'est lui qui recale les corrigés quand un choix vide est jeté.
        quiz: quizPourFirestore(sanitizeLectureQuiz(body.quiz) ?? { mode: 'worksheet', questions: [] }),
        createdAt: maintenant,
        updatedAt: maintenant,
      });

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Erreur POST /api/questionnaires-lecture:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
