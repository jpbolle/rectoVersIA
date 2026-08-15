import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { sanitizeQuestionsForStudent } from '@/lib/navigkid-server';
import { generateTravailId } from '@/lib/travail-utils';
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

    // Réglage porté par l'activité, pas par le questionnaire — absent = activé
    let autoEvalActivite = true;
    if (data.devoirId) {
      const devSnap = await adminDb.collection('devoirs').doc(data.devoirId).get();
      autoEvalActivite = devSnap.exists && devSnap.data()?.autoEvaluation !== false;
    }

    // Élève : jamais les éléments de correction. Deux portes mènent aux bonnes
    // réponses QCM — le corrigé rendu disponible sur l'activité (tout le monde),
    // ou la correction de CET élève rendue visible.
    //
    // La seconde n'est pas un confort : l'onglet Évaluation compte les QCM
    // côté client (recherche-scoring). Sans les bonnes réponses, chaque QCM
    // bascule en « à noter » et ses points disparaissent du total — l'élève
    // lirait un score amputé sans savoir pourquoi.
    if (auth.role === 'eleve') {
      let avecCorrectes = false;
      if (data.devoirId) {
        const [devoirSnap, correctionSnap] = await Promise.all([
          adminDb.collection('devoirs').doc(data.devoirId).get(),
          adminDb
            .collection('corrections')
            .doc(`CORR-${generateTravailId(data.devoirId, auth.uid)}`)
            .get(),
        ]);
        avecCorrectes =
          (devoirSnap.exists && devoirSnap.data()?.corrigeDisponible === true) ||
          (correctionSnap.exists && correctionSnap.data()?.visibleParEleve === true);
      }
      questions = sanitizeQuestionsForStudent(questions, avecCorrectes);
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
        // Auto-évaluation intégrée : l'extension y lit s'il faut proposer les
        // smileys d'assurance. Elle n'a pas accès au document devoir.
        autoEvaluation: autoEvalActivite,
      },
    });
  } catch (error) {
    console.error('Erreur GET /api/navigkid/questionnaire:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
