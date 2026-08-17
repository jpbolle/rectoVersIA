import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/api-auth';
import { resolveProfilTarget, isProfilTargetError } from '@/lib/profil-target';
import {
  loadStudentBase, buildSectionStats, buildVocabulaireProfil,
  buildRechercheProfil, resumeRecherche,
} from '@/lib/profil-stats';
import { buildCertificationsProfil, chargerLabelsUaa } from '@/lib/certification-server';
import type { ProfilGeneral } from '@/types/profil';

// GET - Onglet Général : données élève uniquement, pas de stats de classe (rapide)
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
    const empty: ProfilGeneral = {
      travauxRemis: 0, reussites: 0, echecs: 0, attention: [], nonRendusSanctionnes: [],
      lire: null, ecrire: null, rechercher: null, vocabulaire: null, certifications: null,
    };

    const base = await loadStudentBase(target.uid, target.email, {
      withGrilles: true, withContent: true,
    });
    if (!base) {
      return NextResponse.json({ success: true, data: empty });
    }

    // Les certifications ne dépendent d'AUCUN travail : une épreuve orale ou un
    // dossier papier se note sans que l'élève ait rien remis dans l'app. Elles
    // se calculent donc avant la sortie « aucun travail ».
    const certifications = await buildCertificationsProfil(
      base.eleveIds,
      await chargerLabelsUaa()
    );

    if (base.travaux.length === 0) {
      return NextResponse.json({ success: true, data: { ...empty, certifications } });
    }

    const typeOf = (devoirId: string) => base.devoirs.get(devoirId)?.type || 'ecrire';
    const corrEcrire = base.corrections.filter((c) => typeOf(c.devoirId) === 'ecrire');
    const corrLire = base.corrections.filter((c) => typeOf(c.devoirId) === 'lire');

    // Compteurs écriture
    const travauxRemis = base.travaux.filter(
      (t) => typeOf(t.devoirId) === 'ecrire' && t.status === 'submitted'
    ).length;
    const reussites = corrEcrire.filter((c) => c.score >= 60).length;
    const echecs = corrEcrire.filter((c) => c.score < 60).length;

    // Points d'attention : pires critères d'écriture (< 50), sans stats de classe
    const noClass = new Map();
    const ecritureStats = buildSectionStats(corrEcrire, base, noClass);
    const attention = (ecritureStats?.criteria ?? [])
      .filter((c) => c.averageScore < 50)
      .sort((a, b) => a.averageScore - b.averageScore)
      .slice(0, 2)
      .map((c) => c.name);

    const avg = (scores: number[]) =>
      Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);

    // Tuile Rechercher : le pourcentage d'ensemble et son détail par volet.
    // Le nombre de recherches ne dit rien du travail — il n'est plus qu'une
    // mention en second plan. Même construction que l'onglet Rechercher, pour
    // que la carte et le détail ne puissent pas afficher deux chiffres.
    const rechercher = resumeRecherche(await buildRechercheProfil(target.uid, base));

    // Tuile Vocabulaire : répartition par niveau de maîtrise (agrégat des
    // activités, comme la Vue d'ensemble de l'onglet Vocabulaire) + moyenne
    // des évaluations. Repli sur les groupes de mots si aucune activité.
    const vocab = await buildVocabulaireProfil(target.uid, base);
    let vocabulaire: ProfilGeneral['vocabulaire'] = null;
    if (vocab.activites.length > 0) {
      const sum = (f: (a: (typeof vocab.activites)[number]) => number) =>
        vocab.activites.reduce((s, a) => s + f(a), 0);
      const evals = vocab.activites.flatMap((a) => a.evaluations);
      vocabulaire = {
        maitrise: sum((a) => a.repartition.maitrise),
        moyen: sum((a) => a.repartition.moyen),
        faible: sum((a) => a.repartition.faible),
        inconnu: sum((a) => a.repartition.inconnu),
        total: sum((a) => a.totalWords),
        activites: vocab.activites.length,
        evalMoyenne: evals.length > 0 ? avg(evals.map((e) => e.percentage)) : null,
      };
    } else {
      const allVocabWords = vocab.groups.flatMap((g) => g.words);
      if (allVocabWords.length > 0) {
        vocabulaire = {
          maitrise: allVocabWords.filter((w) => w.level >= 4).length,
          moyen: allVocabWords.filter((w) => w.level >= 2 && w.level <= 3).length,
          faible: allVocabWords.filter((w) => w.level === 1).length,
          inconnu: allVocabWords.filter((w) => w.level === 0).length,
          total: allVocabWords.length,
          activites: 0,
          evalMoyenne: null,
        };
      }
    }

    // Travaux non faits sanctionnés (note 0 disciplinaire, hors statistiques)
    const nonRendusSanctionnes = base.travaux
      .filter((t) => t.nonRendu === 'nonJustifie')
      .map((t) => {
        const d = base.devoirs.get(t.devoirId);
        return { intitule: d?.intitule || 'Activité', date: d?.date || '' };
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const profil: ProfilGeneral = {
      travauxRemis, reussites, echecs, attention, nonRendusSanctionnes,
      ecrire: corrEcrire.length > 0
        ? { score: avg(corrEcrire.map((c) => c.score)), evaluations: corrEcrire.length }
        : null,
      lire: corrLire.length > 0
        ? { score: avg(corrLire.map((c) => c.score)), evaluations: corrLire.length }
        : null,
      rechercher,
      vocabulaire,
      certifications,
    };

    return NextResponse.json({ success: true, data: profil });
  } catch (error) {
    console.error('Erreur GET profil/general:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
