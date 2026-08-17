// Helpers serveur du profil d'écrilecteur — partagés par les routes /api/profil/*.
// Chargent les données de l'élève connecté (travaux, corrections, devoirs, grilles)
// et construisent les statistiques par onglet.

import { adminDb } from '@/lib/firebase/admin';
import { scoreLectureQuiz } from '@/lib/lecture-scoring';
import { scoreRecherche } from '@/lib/recherche-scoring';
import { parseLectureAnswers } from '@/types/lecture';
import type { LectureQuiz } from '@/types/lecture';
import type { AutoEvalAnswer, AutoEvalQuestionnaire } from '@/types/autoevaluation';
import { bilanConfiance } from '@/lib/confiance-scoring';
import { bilanGrille } from '@/lib/grille-lucidite';
import type {
  AssuranceItem, BilanLucidite,
  HabileteStat, ProfilRecherche, RechercheItem,
} from '@/types/profil';
import type {
  NavigKidQuestion,
  NavigKidReponse,
  RechercheQuestionScore,
} from '@/types/navigkid';
import { queryElevesByEmail } from '@/lib/eleve-lookup';
import { LEVEL_PERCENTAGES } from '@/types/grille';
import {
  getWordCategory,
  type WordAttempt,
  type WordMasteryEntry,
  type VocabulaireActivityState,
  type VocabulaireWord,
} from '@/types/vocabulaire';
import type {
  SectionStats, CriterionStats, CriterionHistory,
  DevoirStat, DevoirCriterionStat,
  ProfilVocabGroup, ProfilVocabWord, ProfilPersoWord, ProfilVocabulaire, VocabActiviteStat,
} from '@/types/profil';

type LanguageType = 'ortho' | 'syntaxe' | 'lexique' | 'ponctuation';

export function detectLanguageType(name: string): LanguageType | null {
  if (/orthograph/i.test(name)) return 'ortho';
  if (/ponctuat/i.test(name)) return 'ponctuation';
  if (/syntaxe|syntact/i.test(name)) return 'syntaxe';
  if (/lexiqu|vocabul/i.test(name)) return 'lexique';
  return null;
}

export type CorrEntry = {
  id: string;
  travailId: string;
  devoirId: string;
  evaluation: Record<string, number>;
  score: number;
  // Questionnaires de lecture : points des questions ouvertes
  questionScores?: Record<string, number>;
  // Activités de recherche : notes de la réponse et de la démarche par question
  rechercheScores?: Record<string, RechercheQuestionScore>;
  // Auto-évaluation : le regard du prof, à confronter à celui de l'élève
  autoEvalProf?: Record<string, AutoEvalAnswer>;
};

export type ClassCorrEntry = {
  score: number;
  evaluation: Record<string, number>;
};

export type GrilleEntry = { criteria: { id: string; name: string; weight: number }[] };

export type DevoirInfo = {
  grille: string;
  intitule: string;
  date: string;
  type: 'ecrire' | 'lire' | 'rechercher' | 'vocabulaire' | 'autoevaluation';
  questionnaireId?: string;
  vocabulaireThemes?: string[];
  // Critères retirés de CETTE activité — ils sortent de toute comparaison
  hiddenCriteria?: string[];
  // Questionnaire de lecture — nécessaire pour recalculer les scores par
  // habileté (les QCM ne sont jamais stockés, ils se recalculent)
  lectureQuiz?: LectureQuiz | null;
  // Questionnaire d'auto-évaluation — nécessaire pour comparer les deux
  // regards (onglet réflexif du profil)
  autoEvalQuiz?: AutoEvalQuestionnaire | null;
};

export type TravailInfo = {
  id: string;
  devoirId: string;
  status: string;
  nonRendu?: 'justifie' | 'nonJustifie' | null;
  content?: string;
  // Auto-évaluation sur la grille (écriture) — à confronter à la correction
  // du prof pour mesurer la lucidité (voir buildAssuranceProfil)
  selfEvaluation?: Record<string, number> | null;
};

export interface StudentBase {
  travaux: TravailInfo[];
  corrections: CorrEntry[];
  devoirs: Map<string, DevoirInfo>;
  grilles: Map<string, GrilleEntry>;
  // Documents `eleves` de cet élève — un par classe, et il peut en avoir
  // plusieurs (deux cours, deux années). Les notes de certification sont
  // classées par eleveId : il faut les réunir tous.
  eleveIds: string[];
}

// Charge tout ce qui n'appartient qu'à l'élève : travaux, corrections visibles,
// devoirs associés, grilles (optionnel). Aucune donnée de classe ici.
export async function loadStudentBase(
  uid: string,
  email: string,
  opts: { withGrilles?: boolean; withContent?: boolean } = {}
): Promise<StudentBase | null> {
  // 1. L'utilisateur est-il un élève enregistré ?
  // `uid` vide = élève jamais connecté, consulté par son prof. Sans ce garde,
  // la requête ramènerait tous les documents dont `firebaseUid` vaut la chaîne
  // vide — c'est-à-dire les élèves des autres.
  const [byUid, byEmail] = await Promise.all([
    uid
      ? adminDb.collection('eleves').where('firebaseUid', '==', uid).get()
      : Promise.resolve({ empty: true, docs: [] as { id: string }[] }),
    queryElevesByEmail(email),
  ]);
  if (byUid.empty && byEmail.docs.length === 0) return null;

  const eleveIds = [...new Set([...byUid.docs, ...byEmail.docs].map((d) => d.id))];

  // 2. Ses travaux
  const travauxSnapshot = await adminDb
    .collection('travaux').where('studentId', '==', uid).get();
  const travaux: TravailInfo[] = travauxSnapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      devoirId: data.devoirId,
      status: data.status || 'draft',
      nonRendu: data.nonRendu || null,
      content: opts.withContent ? (data.content as string | undefined) : undefined,
      selfEvaluation: (data.selfEvaluation as Record<string, number> | null) || null,
    };
  });

  const base: StudentBase = {
    travaux, corrections: [], devoirs: new Map(), grilles: new Map(), eleveIds,
  };
  if (travaux.length === 0) return base;

  // 3. Ses corrections visibles (par lots de 30 IDs, en parallèle)
  const travailIds = travaux.map((t) => t.id);
  const corrBatches = Array.from(
    { length: Math.ceil(travailIds.length / 30) },
    (_, i) => travailIds.slice(i * 30, (i + 1) * 30).map((id) => `CORR-${id}`)
  );
  await Promise.all(corrBatches.map(async (batch) => {
    const snap = await adminDb.collection('corrections').where('__name__', 'in', batch).get();
    for (const doc of snap.docs) {
      const data = doc.data();
      if (data.visibleParEleve && data.evaluation) {
        base.corrections.push({
          id: doc.id, travailId: data.travailId, devoirId: data.devoirId,
          evaluation: data.evaluation as Record<string, number>,
          score: data.score || 0,
          questionScores: data.questionScores || undefined,
          rechercheScores: data.rechercheScores || undefined,
          autoEvalProf: data.autoEvalProf || undefined,
        });
      }
    }
  }));

  // 4. Les devoirs de tous ses travaux (pas seulement les corrigés :
  //    les onglets Rechercher et Vocabulaire n'ont pas de correction)
  const devoirIds = [...new Set(travaux.map((t) => t.devoirId))];
  const devBatches = Array.from(
    { length: Math.ceil(devoirIds.length / 30) },
    (_, i) => devoirIds.slice(i * 30, (i + 1) * 30)
  );
  await Promise.all(devBatches.map(async (batch) => {
    const snap = await adminDb.collection('devoirs').where('__name__', 'in', batch).get();
    for (const doc of snap.docs) {
      const data = doc.data();
      const rawDate = data.dateRemise || data.createdAt;
      const dateStr = rawDate
        ? (typeof rawDate === 'string' ? rawDate : rawDate.toDate().toISOString())
        : '';
      base.devoirs.set(doc.id, {
        grille: data.grille || '',
        intitule: data.intitule || '',
        date: dateStr,
        type: data.typeTravail || 'ecrire',
        questionnaireId: data.questionnaireId || undefined,
        vocabulaireThemes: data.vocabulaireThemes || undefined,
        hiddenCriteria: data.hiddenCriteria || undefined,
        lectureQuiz: data.lectureQuiz || null,
        autoEvalQuiz: data.autoEvalQuiz || null,
      });
    }
  }));

  // 5. Les grilles (pour les onglets à critères)
  if (opts.withGrilles) {
    const grilleRefs = [...new Set(
      [...base.devoirs.values()].map((d) => d.grille)
    )].filter(Boolean);
    await Promise.all(grilleRefs.map(async (ref) => {
      let doc = await adminDb.collection('grilles').doc(ref).get();
      if (!doc.exists) {
        const byName = await adminDb.collection('grilles').where('name', '==', ref).limit(1).get();
        if (!byName.empty) doc = byName.docs[0];
      }
      if (doc.exists) {
        const data = doc.data()!;
        base.grilles.set(ref, {
          criteria: (data.criteria || []).map((c: { id: string; name: string; weight: number }) => ({
            id: c.id, name: c.name, weight: c.weight,
          })),
        });
      }
    }));
  }

  return base;
}

// Charge les corrections de toute la classe pour chaque devoir — c'est la partie
// coûteuse (tous les travaux du devoir, puis toutes leurs corrections). Réservée
// aux onglets Lire / Écrire qui affichent moyenne et max de classe.
export async function loadClassStats(
  devoirIds: string[]
): Promise<Map<string, ClassCorrEntry[]>> {
  const classCorrsPerDevoir = new Map<string, ClassCorrEntry[]>();
  await Promise.all(devoirIds.map(async (devoirId) => {
    const allTrSnap = await adminDb
      .collection('travaux').where('devoirId', '==', devoirId).get();
    const allTravailIds = allTrSnap.docs.map((d) => d.id);
    if (allTravailIds.length === 0) { classCorrsPerDevoir.set(devoirId, []); return; }

    const classCorrsList: ClassCorrEntry[] = [];
    await Promise.all(
      Array.from({ length: Math.ceil(allTravailIds.length / 30) }, (_, i) =>
        allTravailIds.slice(i * 30, (i + 1) * 30)
      ).map(async (batchIds) => {
        const batch = batchIds.map((id) => `CORR-${id}`);
        const corrSnap = await adminDb
          .collection('corrections').where('__name__', 'in', batch).get();
        for (const doc of corrSnap.docs) {
          const d = doc.data();
          if (d.score > 0 && d.evaluation) {
            classCorrsList.push({
              score: d.score, evaluation: d.evaluation as Record<string, number>,
            });
          }
        }
      })
    );
    classCorrsPerDevoir.set(devoirId, classCorrsList);
  }));
  return classCorrsPerDevoir;
}

// Statistiques agrégées d'une section (écriture ou lecture).
// classCorrsPerDevoir vide → pas de comparaison classe (classeAvg/Max null).
export function buildSectionStats(
  corrsList: CorrEntry[],
  base: StudentBase,
  classCorrsPerDevoir: Map<string, ClassCorrEntry[]>
): SectionStats | null {
  if (corrsList.length === 0) return null;

  // Clé d'agrégation : les critères de langue restent agrégés toutes grilles
  // confondues (bloc « Maîtrise de la langue ») ; les autres sont séparés par
  // grille d'évaluation (objet évalué) pour la liste « Tous les critères ».
  const aggKey = (grilleName: string, critName: string) =>
    detectLanguageType(critName) ? `lang::${critName}` : `${grilleName}::${critName}`;

  const criterionAgg = new Map<string, {
    name: string; grille?: string;
    totalWeightedScore: number; totalWeight: number;
    count: number; history: CriterionHistory[];
  }>();
  let globalScoreSum = 0;

  for (const corr of corrsList) {
    globalScoreSum += corr.score;
    const devoir = base.devoirs.get(corr.devoirId);
    const grille = devoir ? base.grilles.get(devoir.grille) : undefined;
    if (!devoir || !grille) continue;

    for (const crit of grille.criteria) {
      const level = corr.evaluation[crit.id];
      if (level === undefined) continue;
      const pct = LEVEL_PERCENTAGES[level as keyof typeof LEVEL_PERCENTAGES] ?? 0;
      const key = aggKey(devoir.grille, crit.name);
      if (!criterionAgg.has(key)) {
        criterionAgg.set(key, {
          name: crit.name,
          grille: detectLanguageType(crit.name) ? undefined : devoir.grille,
          totalWeightedScore: 0, totalWeight: 0, count: 0, history: [],
        });
      }
      const agg = criterionAgg.get(key)!;
      agg.totalWeightedScore += pct * crit.weight;
      agg.totalWeight += crit.weight;
      agg.count += 1;
      agg.history.push({
        devoirName: devoir.intitule,
        date: devoir.date,
        score: pct,
      });
    }
  }

  const devoirIdsInSection = [...new Set(corrsList.map((c) => c.devoirId))];
  const classScoresByCrit = new Map<string, number[]>();
  const allClassGlobalScores: number[] = [];

  for (const devoirId of devoirIdsInSection) {
    const devoir = base.devoirs.get(devoirId);
    const grille = devoir ? base.grilles.get(devoir.grille) : undefined;
    const classCorrsList = classCorrsPerDevoir.get(devoirId) || [];
    for (const corr of classCorrsList) {
      allClassGlobalScores.push(corr.score);
      if (!grille) continue;
      for (const crit of grille.criteria) {
        const level = corr.evaluation[crit.id];
        if (level === undefined) continue;
        const pct = LEVEL_PERCENTAGES[level as keyof typeof LEVEL_PERCENTAGES] ?? 0;
        const key = aggKey(devoir!.grille, crit.name);
        if (!classScoresByCrit.has(key)) classScoresByCrit.set(key, []);
        classScoresByCrit.get(key)!.push(pct);
      }
    }
  }

  const classeAvg = allClassGlobalScores.length > 0
    ? Math.round(allClassGlobalScores.reduce((s, v) => s + v, 0) / allClassGlobalScores.length)
    : null;
  const classeMax = allClassGlobalScores.length > 0 ? Math.max(...allClassGlobalScores) : null;

  const criteria: CriterionStats[] = [];
  for (const [key, agg] of criterionAgg) {
    const classScores = classScoresByCrit.get(key) || [];
    criteria.push({
      name: agg.name,
      grille: agg.grille,
      averageScore: agg.totalWeight > 0 ? Math.round(agg.totalWeightedScore / agg.totalWeight) : 0,
      count: agg.count,
      history: agg.history.sort((a, b) => a.date.localeCompare(b.date)),
      classeAvg: classScores.length > 0
        ? Math.round(classScores.reduce((s, v) => s + v, 0) / classScores.length) : null,
      classeMax: classScores.length > 0 ? Math.max(...classScores) : null,
      languageType: detectLanguageType(agg.name) || undefined,
    });
  }
  criteria.sort((a, b) =>
    (a.grille || '').localeCompare(b.grille || '') || a.name.localeCompare(b.name)
  );

  return {
    totalEvaluations: corrsList.length,
    globalScore: Math.round(globalScoreSum / corrsList.length),
    classeAvg, classeMax, criteria,
  };
}

// Statistiques par devoir (pour le filtre par activité des onglets Lire / Écrire).
export function buildDevoirStats(
  corrsList: CorrEntry[],
  base: StudentBase,
  classCorrsPerDevoir: Map<string, ClassCorrEntry[]>
): DevoirStat[] {
  const devoirStatsList: DevoirStat[] = [];
  for (const corr of corrsList) {
    const devoir = base.devoirs.get(corr.devoirId);
    // Une auto-évaluation ne produit AUCUNE note : la compter ici la ferait
    // apparaître comme un zéro dans les statistiques de l'élève.
    if (
      !devoir ||
      devoir.type === 'rechercher' ||
      devoir.type === 'vocabulaire' ||
      devoir.type === 'autoevaluation'
    ) {
      continue;
    }

    const grille = base.grilles.get(devoir.grille);
    const classCorrsList = classCorrsPerDevoir.get(corr.devoirId) || [];

    const classeScores = classCorrsList.map((c) => c.score);
    const classeAvg = classeScores.length > 0
      ? Math.round(classeScores.reduce((s, v) => s + v, 0) / classeScores.length) : null;
    const classeMax = classeScores.length > 0 ? Math.max(...classeScores) : null;

    const devoirCriteria: DevoirCriterionStat[] = [];
    if (grille) {
      for (const crit of grille.criteria) {
        const level = corr.evaluation[crit.id];
        if (level === undefined) continue;
        const myScore = LEVEL_PERCENTAGES[level as keyof typeof LEVEL_PERCENTAGES] ?? 0;

        const classCritScores = classCorrsList
          .map((c) => {
            const l = c.evaluation[crit.id];
            return l !== undefined ? (LEVEL_PERCENTAGES[l as keyof typeof LEVEL_PERCENTAGES] ?? 0) : null;
          })
          .filter((v): v is number => v !== null);

        devoirCriteria.push({
          name: crit.name,
          score: myScore,
          classeAvg: classCritScores.length > 0
            ? Math.round(classCritScores.reduce((s, v) => s + v, 0) / classCritScores.length) : null,
          classeMax: classCritScores.length > 0 ? Math.max(...classCritScores) : null,
          languageType: detectLanguageType(crit.name) || undefined,
        });
      }
    }

    devoirStatsList.push({
      devoirId: corr.devoirId,
      name: devoir.intitule,
      date: devoir.date,
      type: devoir.type,
      myScore: corr.score,
      classeAvg, classeMax,
      criteria: devoirCriteria,
    });
  }
  devoirStatsList.sort((a, b) => a.date.localeCompare(b.date));
  return devoirStatsList;
}

// ─── Vocabulaire ─────────────────────────────────────────────────────────────

// Fusionne le suivi de maîtrise de toutes les activités vocabulaire de l'élève
// (un même mot peut avoir été travaillé dans plusieurs activités).
export function mergeWordMastery(base: StudentBase): Map<string, WordMasteryEntry> {
  const merged = new Map<string, WordMasteryEntry>();
  for (const travail of base.travaux) {
    const devoir = base.devoirs.get(travail.devoirId);
    if (!devoir || devoir.type !== 'vocabulaire' || !travail.content) continue;
    let state: VocabulaireActivityState | null = null;
    try { state = JSON.parse(travail.content); } catch { continue; }
    for (const entry of state?.wordMastery || []) {
      const key = entry.word.toLowerCase();
      const existing = merged.get(key);
      if (existing) {
        existing.attempts.push(...entry.attempts);
      } else {
        merged.set(key, { word: entry.word, attempts: [...entry.attempts] });
      }
    }
  }
  // Les tentatives doivent rester chronologiques (getWordCategory lit les 3 dernières)
  for (const entry of merged.values()) {
    entry.attempts.sort((a, b) => a.date.localeCompare(b.date));
  }
  return merged;
}

// Niveau 0-5 d'un mot : 0 jamais testé, 1 aucune réussite, 2-3 fragile, 4-5 connu.
export function wordLevel(entry: WordMasteryEntry | undefined): number {
  if (!entry || entry.attempts.length === 0) return 0;
  const successes = sumSuccesses(entry.attempts);
  if (getWordCategory(entry) === 'known') return successes >= 4 ? 5 : 4;
  if (successes >= 2) return 3;
  if (successes >= 1) return 2;
  return 1;
}

function sumSuccesses(attempts: WordAttempt[]): number {
  return attempts.reduce((s, a) => s + (a.correct ? (a.credit ?? 1) : 0), 0);
}

function toProfilWord(word: string, entry: WordMasteryEntry | undefined): ProfilVocabWord {
  return {
    word,
    level: wordLevel(entry),
    attempts: entry?.attempts.length ?? 0,
    successes: entry ? Math.round(sumSuccesses(entry.attempts) * 2) / 2 : 0,
  };
}

// Construit l'onglet Vocabulaire : groupes par série du prof + groupe mots personnels.
export async function buildVocabulaireProfil(
  uid: string,
  base: StudentBase
): Promise<ProfilVocabulaire> {
  const mastery = mergeWordMastery(base);

  // Thèmes imposés par les devoirs vocabulaire de l'élève — chargés une seule
  // fois : ils servent aux groupes de mots ET à la répartition par activité
  const themeIds = [...new Set(
    [...base.devoirs.values()]
      .filter((d) => d.type === 'vocabulaire')
      .flatMap((d) => d.vocabulaireThemes || [])
  )];

  const themes = new Map<string, { name: string; words: string[] }>();
  await Promise.all(themeIds.map(async (themeId) => {
    const doc = await adminDb.collection('vocabulaire').doc(themeId).get();
    if (!doc.exists) return;
    const data = doc.data()!;
    themes.set(themeId, {
      name: data.name || themeId,
      words: ((data.words || []) as VocabulaireWord[]).map((w) => w.word),
    });
  }));

  const groups: ProfilVocabGroup[] = [...themes.entries()].map(([themeId, theme]) => ({
    id: themeId,
    name: theme.name,
    isPerso: false,
    words: theme.words.map((w) => toProfilWord(w, mastery.get(w.toLowerCase()))),
  }));
  groups.sort((a, b) => a.name.localeCompare(b.name));

  // Statistiques par activité vocabulaire (état de chaque travail)
  const activites: VocabActiviteStat[] = [];
  for (const travail of base.travaux) {
    const devoir = base.devoirs.get(travail.devoirId);
    if (!devoir || devoir.type !== 'vocabulaire') continue;
    let state: VocabulaireActivityState | null = null;
    if (travail.content) {
      try { state = JSON.parse(travail.content); } catch { /* contenu illisible */ }
    }
    const words = [...new Set(
      (devoir.vocabulaireThemes || []).flatMap((t) => themes.get(t)?.words || [])
    )];
    // Maîtrise propre à cette activité (pas la fusion toutes activités)
    const actMastery = new Map(
      (state?.wordMastery || []).map((m) => [m.word.toLowerCase(), m])
    );
    const repartition = { maitrise: 0, moyen: 0, faible: 0, inconnu: 0 };
    for (const w of words) {
      const level = wordLevel(actMastery.get(w.toLowerCase()));
      if (level >= 4) repartition.maitrise++;
      else if (level >= 2) repartition.moyen++;
      else if (level === 1) repartition.faible++;
      else repartition.inconnu++;
    }
    activites.push({
      devoirId: travail.devoirId,
      intitule: devoir.intitule,
      date: devoir.date,
      ouvertures: state?.activityOpened || 0,
      timeSpentSeconds: state?.timeSpentSeconds || 0,
      learningSessions: state?.learningSessions || 0,
      totalWords: words.length,
      repartition,
      diagnostics: (state?.diagnosticScores || []).map((d) => ({
        date: d.date, correct: d.correct, total: d.total,
      })),
      evaluations: (state?.evaluationScores || []).map((e) => ({
        date: e.date, percentage: e.percentage,
      })),
    });
  }
  activites.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  // Mots personnels (définitions demandées dans l'app ou NavigKid)
  const persoDoc = await adminDb.collection('vocabulairePersonnel').doc(uid).get();
  const persoRaw: Array<{ word?: string; definition?: string; addedAt?: string }> =
    (persoDoc.exists ? persoDoc.data()?.words : []) || [];
  const perso: ProfilPersoWord[] = persoRaw
    .filter((w) => w.word)
    .map((w) => ({
      word: w.word!,
      definition: w.definition || '',
      addedAt: w.addedAt || null,
    }))
    .sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''));

  if (perso.length > 0) {
    groups.push({
      id: '__perso__',
      name: 'Mots personnels',
      isPerso: true,
      words: perso.map((w) => toProfilWord(w.word, mastery.get(w.word.toLowerCase()))),
    });
  }

  return { groups, perso, activites };
}


// Agrégation par habileté des questionnaires de lecture de l'élève.
// Nécessite loadStudentBase(..., { withContent: true }) : les réponses vivent
// dans travail.content, et les QCM se recalculent à chaque lecture.
//
// Règle : une question portant deux habiletés compte ENTIÈREMENT dans chacune.
// La somme des lignes ne retombe donc pas sur un total, et c'est voulu.
export function buildHabileteStats(base: StudentBase): HabileteStat[] {
  const corrById = new Map(base.corrections.map((c) => [c.travailId, c]));
  const cumul = new Map<string, { points: number; max: number; questions: number; activites: Set<string> }>();

  for (const travail of base.travaux) {
    const devoir = base.devoirs.get(travail.devoirId);
    if (!devoir || devoir.type !== 'lire' || !devoir.lectureQuiz) continue;

    // Sans correction rendue, rien n'est comptabilisé : le profil ne montre
    // que ce que l'élève a le droit de voir
    const corr = corrById.get(travail.id);
    if (!corr) continue;

    const answers = parseLectureAnswers(travail.content)?.answers ?? {};
    const score = scoreLectureQuiz(devoir.lectureQuiz as LectureQuiz, answers, corr.questionScores);

    for (const h of score.parHabilete) {
      const cur = cumul.get(h.habileteId) ?? {
        points: 0, max: 0, questions: 0, activites: new Set<string>(),
      };
      cur.points += h.points;
      cur.max += h.max;
      cur.questions += h.questions;
      cur.activites.add(travail.devoirId);
      cumul.set(h.habileteId, cur);
    }
  }

  return [...cumul.entries()]
    .map(([habileteId, v]) => ({
      habileteId,
      points: Math.round(v.points * 10) / 10,
      max: v.max,
      percent: v.max > 0 ? Math.round((v.points / v.max) * 100) : 0,
      questions: v.questions,
      activites: v.activites.size,
    }))
    .sort((a, b) => a.percent - b.percent);
}

// ─── Recherches guidées (NavigKid) ───
//
// Une seule construction pour l'onglet Rechercher ET la tuile de la Vue
// d'ensemble : le pourcentage affiché sur la carte et celui du détail ne
// doivent pas pouvoir diverger.
//
// Comme pour la lecture, rien n'est comptabilisé tant que la correction n'a pas
// été rendue visible : le profil ne montre que ce que l'élève a le droit de voir.
export async function buildRechercheProfil(
  uid: string,
  base: StudentBase
): Promise<ProfilRecherche> {
  const rechercheDevoirs = [...base.devoirs.entries()].filter(
    ([, d]) => d.type === 'rechercher' && d.questionnaireId
  );
  const corrParDevoir = new Map(base.corrections.map((c) => [c.devoirId, c]));

  const items: RechercheItem[] = [];
  const cumul = new Map<
    string,
    { points: number; max: number; questions: number; activites: Set<string> }
  >();

  await Promise.all(
    rechercheDevoirs.map(async ([devoirId, devoir]) => {
      const qRef = adminDb.collection('questionnaires').doc(devoir.questionnaireId!);
      const [qSnap, repSnap] = await Promise.all([
        qRef.get(),
        qRef.collection('reponses').doc(uid).get(),
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

  return { items, habiletes };
}

// Résumé de la tuile « Rechercher » de la Vue d'ensemble : le pourcentage
// d'ensemble et son détail par volet, cumulés sur toutes les recherches
// corrigées. Les recherches non corrigées ne pèsent sur aucun total — seul
// leur nombre est reporté.
export function resumeRecherche(profil: ProfilRecherche): {
  percent: number | null;
  reponsesPercent: number | null;
  demarchePercent: number | null;
  points: number;
  max: number;
  notees: number;
  total: number;
  remises: number;
} | null {
  const { items } = profil;
  if (items.length === 0) return null;

  let rPoints = 0, rMax = 0, dPoints = 0, dMax = 0, notees = 0;
  for (const item of items) {
    if (!item.reponses && !item.demarche) continue;
    notees++;
    rPoints += item.reponses?.points ?? 0;
    rMax += item.reponses?.max ?? 0;
    dPoints += item.demarche?.points ?? 0;
    dMax += item.demarche?.max ?? 0;
  }

  const pct = (p: number, m: number) => (m > 0 ? Math.round((p / m) * 100) : null);
  return {
    percent: pct(rPoints + dPoints, rMax + dMax),
    reponsesPercent: pct(rPoints, rMax),
    demarchePercent: pct(dPoints, dMax),
    points: Math.round((rPoints + dPoints) * 10) / 10,
    max: rMax + dMax,
    notees,
    total: items.length,
    remises: items.filter((i) => i.soumise).length,
  };
}

// ─── Degré d'assurance (lecture + recherche) ───
//
// La seconde mesure de lucidité du profil, à côté de l'auto-évaluation. Ici
// l'élève ne se compare pas au regard du prof mais à un RÉSULTAT : sur chaque
// question, il a annoncé un degré d'assurance avant de connaître sa note.
//
// Rien n'est comptabilisé tant que la correction n'est pas rendue : sans note,
// il n'y a rien à confronter.
export async function buildAssuranceProfil(
  uid: string,
  base: StudentBase
): Promise<{ items: AssuranceItem[]; total: BilanLucidite }> {
  const corrParDevoir = new Map(base.corrections.map((c) => [c.devoirId, c]));
  const items: AssuranceItem[] = [];

  // ── Activités d'écriture : auto-évaluation sur la grille ──
  // Le cas le plus direct : l'élève et le prof se prononcent sur les mêmes
  // critères et la même échelle, l'écart se lit en crans.
  for (const travail of base.travaux) {
    const devoir = base.devoirs.get(travail.devoirId);
    if (!devoir || devoir.type !== 'ecrire') continue;
    const corr = corrParDevoir.get(travail.devoirId);
    if (!corr) continue;

    const grille = base.grilles.get(devoir.grille);
    const bilan = bilanGrille(
      grille,
      travail.selfEvaluation,
      corr.evaluation,
      devoir.hiddenCriteria
    );
    if (bilan.comparees === 0) continue;
    items.push({
      devoirId: travail.devoirId,
      titre: devoir.intitule,
      date: devoir.date,
      dispositif: 'ecrire',
      comparees: bilan.comparees,
      justes: bilan.justes,
      sousEstimations: bilan.sousEstimations,
      surestimations: bilan.surestimations,
      ecartMoyen: bilan.ecartMoyen,
      tendance: bilan.tendance,
    });
  }

  // ── Questionnaires de lecture ──
  for (const travail of base.travaux) {
    const devoir = base.devoirs.get(travail.devoirId);
    if (!devoir || devoir.type !== 'lire' || !devoir.lectureQuiz) continue;
    const corr = corrParDevoir.get(travail.devoirId);
    if (!corr) continue;

    const answers = parseLectureAnswers(travail.content)?.answers ?? {};
    const score = scoreLectureQuiz(devoir.lectureQuiz, answers, corr.questionScores);
    const bilan = bilanConfiance(
      devoir.lectureQuiz.questions
        .filter((q) => q.type !== 'info')
        .map((q) => {
          const s = score.parQuestion.find((x) => x.questionId === q.id);
          return {
            questionId: q.id,
            enonce: q.enonce,
            percent:
              s && s.points !== null && s.max > 0 ? Math.round((s.points / s.max) * 100) : null,
            confiance: answers[q.id]?.confiance,
          };
        })
    );
    if (bilan.comparees === 0) continue;
    items.push({
      devoirId: travail.devoirId,
      titre: devoir.intitule,
      date: devoir.date,
      dispositif: 'lire',
      comparees: bilan.comparees,
      justes: bilan.justes,
      sousEstimations: bilan.sousEstimations,
      surestimations: bilan.surestimations,
      ecartMoyen: bilan.ecartMoyen,
      tendance: bilan.tendance,
    });
  }

  // ── Questionnaires de recherche (smiley posé dans l'extension) ──
  const rechercheDevoirs = [...base.devoirs.entries()].filter(
    ([, d]) => d.type === 'rechercher' && d.questionnaireId
  );
  await Promise.all(
    rechercheDevoirs.map(async ([devoirId, devoir]) => {
      const corr = corrParDevoir.get(devoirId);
      if (!corr) return;

      const qRef = adminDb.collection('questionnaires').doc(devoir.questionnaireId!);
      const [qSnap, repSnap] = await Promise.all([
        qRef.get(),
        qRef.collection('reponses').doc(uid).get(),
      ]);
      if (!qSnap.exists || !repSnap.exists) return;

      const questions: NavigKidQuestion[] = Array.isArray(qSnap.data()!.questions)
        ? qSnap.data()!.questions
        : [];
      const reponse = repSnap.data() as NavigKidReponse;
      const score = scoreRecherche(questions, reponse, corr.rechercheScores);

      // On confronte au volet RÉPONSE : l'élève se prononçait sur ce qu'il
      // avait trouvé, jamais sur la façon dont il avait cherché.
      const bilan = bilanConfiance(
        questions.map((q, index) => {
          const volet = score.parQuestion.find((p) => p.index === index);
          return {
            questionId: String(index),
            enonce: q.texte,
            percent:
              volet && volet.reponsePoints !== null && volet.reponseMax > 0
                ? Math.round((volet.reponsePoints / volet.reponseMax) * 100)
                : null,
            confiance: reponse.questions?.find((d) => d.questionIndex === index)?.confiance,
          };
        })
      );
      if (bilan.comparees === 0) return;
      items.push({
        devoirId,
        titre: qSnap.data()!.titre || devoir.intitule,
        date: devoir.date,
        dispositif: 'rechercher',
        comparees: bilan.comparees,
        justes: bilan.justes,
        sousEstimations: bilan.sousEstimations,
        surestimations: bilan.surestimations,
        ecartMoyen: bilan.ecartMoyen,
        tendance: bilan.tendance,
      });
    })
  );

  items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const comparees = items.reduce((s, i) => s + i.comparees, 0);
  if (comparees === 0) {
    return {
      items,
      total: {
        comparees: 0,
        justes: 0,
        sousEstimations: 0,
        surestimations: 0,
        ecartMoyen: 0,
        tendance: null,
      },
    };
  }

  // Moyenne PONDÉRÉE par le nombre de questions : une activité de dix
  // questions pèse plus qu'une de deux, sinon la tendance serait faussée.
  const sommePonderee = items.reduce((s, i) => s + i.ecartMoyen * i.comparees, 0);
  const ecartMoyen = Math.round((sommePonderee / comparees) * 100) / 100;

  return {
    items,
    total: {
      comparees,
      justes: items.reduce((s, i) => s + i.justes, 0),
      sousEstimations: items.reduce((s, i) => s + i.sousEstimations, 0),
      surestimations: items.reduce((s, i) => s + i.surestimations, 0),
      ecartMoyen,
      tendance:
        Math.abs(ecartMoyen) < 0.5 ? 'juste' : ecartMoyen > 0 ? 'surestime' : 'sousEstime',
    },
  };
}
