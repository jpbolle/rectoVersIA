import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/api-auth';
import { resolveProfilTarget, isProfilTargetError } from '@/lib/profil-target';
import { loadStudentBase } from '@/lib/profil-stats';
import { comparer } from '@/lib/autoeval-scoring';
import { echelonLabel, parseAutoEvalAnswers } from '@/types/autoevaluation';
import type { ProfilReflexif, ReflexifItem } from '@/types/profil';

// GET - Onglet Réflexif : la LUCIDITÉ de l'élève.
//
// Une auto-évaluation n'a pas de note. Ce que cet onglet suit, c'est l'écart
// entre le regard de l'élève sur lui-même et celui de son professeur, aux mêmes
// questions ordonnées (cf. src/lib/autoeval-scoring.ts).
//
// Comme partout dans le profil, rien n'est comptabilisé tant que la correction
// n'a pas été rendue visible : sinon l'élève lirait le regard du prof avant
// l'heure. Les corrections chargées par loadStudentBase sont déjà filtrées.
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
    const vide: ProfilReflexif = {
      items: [],
      total: {
        comparees: 0,
        justes: 0,
        sousEstimations: 0,
        surestimations: 0,
        ecartMoyen: 0,
        tendance: null,
      },
      gestes: [],
    };

    const base = await loadStudentBase(target.uid, target.email, { withContent: true });
    if (!base) return NextResponse.json({ success: true, data: vide });

    const corrParDevoir = new Map(base.corrections.map((c) => [c.devoirId, c]));
    const items: ReflexifItem[] = [];
    // Cumul par geste : somme des écarts, pour dire si l'élève se sous-estime
    // sur telle famille de gestes en particulier
    const parGeste = new Map<string, { comparees: number; somme: number }>();

    for (const travail of base.travaux) {
      const devoir = base.devoirs.get(travail.devoirId);
      if (!devoir || devoir.type !== 'autoevaluation' || !devoir.autoEvalQuiz) continue;

      const reponsesEleve = parseAutoEvalAnswers(travail.content)?.answers ?? {};
      const correction = corrParDevoir.get(travail.devoirId);
      const bilan = comparer(devoir.autoEvalQuiz, reponsesEleve, correction?.autoEvalProf);

      // Émotions déclarées — elles ne se comparent pas, elles se racontent
      const humeurs: string[] = [];
      devoir.autoEvalQuiz.questions
        .filter((q) => q.type === 'humeur')
        .forEach((q) => {
          const e = reponsesEleve[q.id]?.echelon;
          if (e) humeurs.push(echelonLabel('humeur', e));
        });

      bilan.ecarts.forEach((e) => {
        e.competences.forEach((c) => {
          const acc = parGeste.get(c) ?? { comparees: 0, somme: 0 };
          acc.comparees += 1;
          acc.somme += e.ecart;
          parGeste.set(c, acc);
        });
      });

      items.push({
        devoirId: travail.devoirId,
        titre: devoir.intitule,
        date: devoir.date,
        intention: devoir.autoEvalQuiz.intention || undefined,
        comparees: bilan.comparees,
        justes: bilan.justes,
        sousEstimations: bilan.sousEstimations,
        surestimations: bilan.surestimations,
        ecartMoyen: bilan.ecartMoyen,
        tendance: bilan.tendance,
        enAttenteProf: bilan.enAttenteProf,
        humeurs,
      });
    }

    items.sort((a, b) => (a.date < b.date ? 1 : -1));

    // Cumul général : on repart des questions, pas des moyennes de moyennes —
    // une activité de 10 questions ne doit pas peser autant qu'une de 2
    const comparees = items.reduce((s, i) => s + i.comparees, 0);
    const justes = items.reduce((s, i) => s + i.justes, 0);
    const sousEstimations = items.reduce((s, i) => s + i.sousEstimations, 0);
    const surestimations = items.reduce((s, i) => s + i.surestimations, 0);
    const sommeEcarts = items.reduce((s, i) => s + i.ecartMoyen * i.comparees, 0);
    const ecartMoyen = comparees ? sommeEcarts / comparees : 0;
    const tendance = comparees
      ? Math.abs(ecartMoyen) < 0.5
        ? ('juste' as const)
        : ecartMoyen < 0
          ? ('sousEstime' as const)
          : ('surestime' as const)
      : null;

    const data: ProfilReflexif = {
      items,
      total: { comparees, justes, sousEstimations, surestimations, ecartMoyen, tendance },
      gestes: [...parGeste.entries()]
        .map(([habileteId, v]) => ({
          habileteId,
          comparees: v.comparees,
          ecartMoyen: v.comparees ? v.somme / v.comparees : 0,
        }))
        .sort((a, b) => b.comparees - a.comparees),
    };

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Erreur GET /api/profil/reflexif:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
