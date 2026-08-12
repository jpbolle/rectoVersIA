import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { sanitizeQuestionsForStudent } from '@/lib/navigkid-server';
import type { NavigKidQuestion } from '@/types/navigkid';

export async function PATCH(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id requis' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { questions, theme } = body;

    const ref = adminDb.collection('questionnaires').doc(id);
    const doc = await ref.get();
    if (!doc.exists) {
      return NextResponse.json({ success: false, message: 'Questionnaire non trouve' }, { status: 404 });
    }

    // Vérifier que le prof est bien le propriétaire
    if (doc.data()!.profId !== auth.uid) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 403 });
    }

    const update: Record<string, unknown> = {};
    if (questions !== undefined) update.questions = questions;
    if (theme !== undefined) update.theme = theme;

    await ref.update(update);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur PATCH /api/navigkid/questionnaire:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id requis' }, { status: 400 });
  }

  try {
    const doc = await adminDb.collection('questionnaires').doc(id).get();
    if (!doc.exists) {
      return NextResponse.json({ success: false, message: 'Questionnaire non trouve' }, { status: 404 });
    }

    const data = doc.data()!;
    let questions: NavigKidQuestion[] = data.questions || [];

    // Élève : jamais les éléments de correction. Les bonnes réponses QCM ne
    // partent que si le prof a rendu le corrigé disponible sur l'activité.
    if (auth.role === 'eleve') {
      let corrigeDisponible = false;
      if (data.devoirId) {
        const devoirSnap = await adminDb.collection('devoirs').doc(data.devoirId).get();
        corrigeDisponible = devoirSnap.exists && devoirSnap.data()?.corrigeDisponible === true;
      }
      questions = sanitizeQuestionsForStudent(questions, corrigeDisponible);
    }

    return NextResponse.json({
      success: true,
      data: {
        id: doc.id,
        titre: data.titre || '',
        theme: data.theme || '',
        consignes: data.consignes || '',
        questions,
        codeAcces: data.codeAcces || '',
        profId: data.profId || '',
        devoirId: data.devoirId || '',
      },
    });
  } catch (error) {
    console.error('Erreur GET /api/navigkid/questionnaire:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
