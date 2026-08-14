import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { resolveProfilTarget, isProfilTargetError } from '@/lib/profil-target';
import { loadStudentBase } from '@/lib/profil-stats';
import { scoreRecherche } from '@/lib/recherche-scoring';
import type { ProfilRecherche, RechercheItem } from '@/types/profil';
import type { HabileteStat } from '@/types/profil';
import type { NavigKidQuestion, NavigKidReponse } from '@/types/navigkid';

// GET - Onglet Rechercher : les recherches guidées NavigKid de l'élève, leurs
// notes (réponses / démarche) et le cumul par habileté.
//
// Comme pour la lecture, rien n'est comptabilisé tant que la correction n'a pas
// été rendue visible : le profil ne montre que ce que l'élève a le droit de voir.
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
    const vide: ProfilRecherche = { items: [], habiletes: [] };
    const base = await loadStudentBase(target.uid, target.email);
    if (!base) return NextResponse.json({ success: true, data: vide });

    const rechercheDevoirs = [...base.devoirs.entries()].filter(
      ([, d]) => d.type === 'rechercher' && d.questionnaireId
    );
    // Correction rendue visible, indexée par devoir
    const corrParDevoir = new Map(base.corrections.map((c) => [c.devoirId, c]));

    const items: RechercheItem[] = [];
    const cumul = new Map<string, { points: number; max: number; questions: number; activites: Set<string> }>();

    await Promise.all(
      rechercheDevoirs.map(async ([devoirId, devoir]) => {
        const qRef = adminDb.collection('questionnaires').doc(devoir.questionnaireId!);
        const [qSnap, repSnap] = await Promise.all([
          qRef.get(),
          qRef.collection('reponses').doc(target.uid).get(),
        ]);
        if (!qSnap.exists) return;

        const qData = qSnap.data()!;
        const questions: NavigKidQuestion[] = Array.isArray(qData.questions) ? qData.questions : [];

        let date = devoir.date;
        let reponse: NavigKidReponse | null = null;
        if (repSnap.exists) {
          const rep = repSnap.data()!;
          date = rep.soumisLe?.toDate?.()?.toISOString?.() || rep.soumisLe || date;
          reponse = rep as NavigKidReponse;
        }

        const corr = corrParDevoir.get(devoirId);
        const score = scoreRecherche(questions, reponse, corr?.rechercheScores);

        items.push({
          devoirId,
          titre: qData.titre || devoir.intitule,
          date,
          soumise: repSnap.exists,
          nbQuestions: questions.length,
          nbReponses: score.stats.questionsRepondues,
          sitesConsultes: score.stats.sites,
          passages: score.stats.passages,
          motsCles: score.stats.motsCles,
          // Sans correction rendue, aucune note ne remonte
          reponses: corr ? score.reponses : null,
          demarche: corr ? score.demarche : null,
        });

        if (!corr) return;
        score.parHabilete.forEach((h) => {
          const cur = cumul.get(h.habileteId) ?? {
            points: 0,
            max: 0,
            questions: 0,
            activites: new Set<string>(),
          };
          cur.points += h.points;
          cur.max += h.max;
          cur.questions += h.questions;
          cur.activites.add(devoirId);
          cumul.set(h.habileteId, cur);
        });
      })
    );

    items.sort((a, b) => b.date.localeCompare(a.date));

    const habiletes: HabileteStat[] = [...cumul.entries()]
      .map(([habileteId, v]) => ({
        habileteId,
        points: Math.round(v.points * 10) / 10,
        max: v.max,
        percent: v.max > 0 ? Math.round((v.points / v.max) * 100) : 0,
        questions: v.questions,
        activites: v.activites.size,
      }))
      .sort((a, b) => a.percent - b.percent);

    const data: ProfilRecherche = { items, habiletes };
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Erreur GET profil/recherche:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
