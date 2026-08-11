import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { resolveProfilTarget, isProfilTargetError } from '@/lib/profil-target';
import { loadStudentBase } from '@/lib/profil-stats';
import type { RechercheItem } from '@/types/profil';
import type { NavigKidQuestionData } from '@/types/navigkid';

// GET - Onglet Rechercher : les recherches guidées NavigKid de l'élève
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 });
  }

  const target = await resolveProfilTarget(auth, request);
  if (isProfilTargetError(target)) {
    return NextResponse.json(
      { success: false, message: target.errorMessage },
      { status: target.errorStatus }
    );
  }

  try {
    const base = await loadStudentBase(target.uid, target.email);
    if (!base) return NextResponse.json({ success: true, data: [] });

    const rechercheDevoirs = [...base.devoirs.entries()]
      .filter(([, d]) => d.type === 'rechercher' && d.questionnaireId);

    const items: RechercheItem[] = [];
    await Promise.all(rechercheDevoirs.map(async ([devoirId, devoir]) => {
      const qRef = adminDb.collection('questionnaires').doc(devoir.questionnaireId!);
      const [qSnap, repSnap] = await Promise.all([
        qRef.get(),
        qRef.collection('reponses').doc(target.uid).get(),
      ]);
      if (!qSnap.exists) return;

      const qData = qSnap.data()!;
      const nbQuestions = Array.isArray(qData.questions) ? qData.questions.length : 0;

      let soumise = false;
      let date = devoir.date;
      let nbReponses = 0;
      let sitesConsultes = 0;
      let passages = 0;
      if (repSnap.exists) {
        soumise = true;
        const rep = repSnap.data()!;
        date = rep.soumisLe?.toDate?.()?.toISOString?.() || date;
        const questions = (rep.questions || []) as NavigKidQuestionData[];
        nbReponses = questions.filter((q) => (q.reponse || '').trim().length > 0).length;
        sitesConsultes = questions.reduce((s, q) => s + (q.sitesConsultes?.length || 0), 0);
        passages = questions.reduce((s, q) => s + (q.passages?.length || 0), 0);
      }

      items.push({
        devoirId,
        titre: qData.titre || devoir.intitule,
        date, soumise, nbQuestions, nbReponses, sitesConsultes, passages,
      });
    }));

    items.sort((a, b) => b.date.localeCompare(a.date));
    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    console.error('Erreur GET profil/recherche:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
