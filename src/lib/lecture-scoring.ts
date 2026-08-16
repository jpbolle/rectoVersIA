// Notation d'un questionnaire de lecture, et agrégation par habileté.
//
// Deux sources de points :
//  - questions AUTO-CORRIGEABLES (QCM, matrice, appariement, remise en ordre,
//    image annotée, ensembles, et le fluorage quand il porte des catégories) :
//    comptées automatiquement, jamais stockées — recalculées à chaque lecture
//    pour rester justes si le prof retouche le questionnaire ;
//  - autres questions : notées à la main par le prof, de 0 au maximum de la
//    question, dans correction.questionScores.
//
// BARÈME PARTIEL (décision de JP, 2026-08-16) : une question à plusieurs
// items rapporte au prorata des items réussis. 6 lignes de matrice justes sur
// 8 valent 75 % des points. La règle de calcul vit dans `partReussite`
// (src/types/lecture.ts) — un seul endroit, partagé avec le serveur.
//
// Une question non encore notée est HORS TOTAL (ni au numérateur, ni au
// dénominateur) : sinon un travail à moitié corrigé afficherait un score faux.
//
// Règle d'agrégation par habileté — une question portant deux habiletés compte
// ENTIÈREMENT dans chacune, jamais divisée. La somme des scores par habileté
// ne retombe donc pas sur le total, et c'est voulu : sinon une question à deux
// habiletés serait comptée à moitié dans les deux.
//
// Utilisable côté serveur (profil) comme côté client (onglets Évaluation).

import type { LectureAnswer, LectureQuestion, LectureQuiz } from '@/types/lecture';
import { estAutoCorrigeable, partReussite } from '@/types/lecture';

export interface QuestionScore {
  questionId: string;
  points: number | null; // null = pas encore noté
  max: number;
  auto: boolean; // true = comptée automatiquement (pas de saisie du prof)
}

export interface HabileteScore {
  habileteId: string;
  points: number;
  max: number;
  questions: number; // nombre de questions notées portant cette habileté
}

export interface LectureScore {
  points: number;
  max: number;
  percent: number | null; // null quand rien n'est encore notable
  aNoter: number; // questions en attente d'une note du prof
  parQuestion: QuestionScore[];
  parHabilete: HabileteScore[];
}

// Les blocs informatifs ne sont pas des questions
export function isScorable(q: LectureQuestion): boolean {
  return q.type !== 'info' && (q.points || 0) > 0;
}

// Note d'une question : automatique quand la machine sait trancher, saisie du
// prof sinon.
function scoreQuestion(
  q: LectureQuestion,
  answers: Record<string, LectureAnswer>,
  questionScores: Record<string, number> | undefined
): QuestionScore {
  const max = q.points || 0;

  // Un type auto-corrigeable dont le corrigé a été filtré (élève sans
  // correction rendue) : on ne peut pas trancher, la question reste à noter.
  // C'est ce qui met « … / 3 » dans la pastille au lieu d'un faux zéro.
  if (seCorrigeSeule(q)) {
    if (!estAutoCorrigeable(q)) {
      return { questionId: q.id, points: null, max, auto: true };
    }
    const part = partReussite(q, answers[q.id]) ?? 0;
    return {
      questionId: q.id,
      // Au dixième de point : un appariement de 3 sur 7 ne tombe pas rond,
      // et arrondir à l'entier fausserait le total de la copie.
      points: Math.round(part * max * 10) / 10,
      max,
      auto: true,
    };
  }

  const saisi = questionScores?.[q.id];
  return {
    questionId: q.id,
    points: typeof saisi === 'number' ? Math.max(0, Math.min(max, saisi)) : null,
    max,
    auto: false,
  };
}

/**
 * Cette question relève-t-elle de la correction automatique, indépendamment
 * du fait que le corrigé soit là ? À distinguer d'`estAutoCorrigeable`, qui
 * regarde si la clé est effectivement présente : un QCM dont on a filtré
 * `correctIndex` pour l'élève relève toujours de l'automatique, il attend
 * juste sa clé — d'où le « … » dans la pastille plutôt qu'un faux zéro.
 *
 * Le fluorage n'en relève QUE s'il porte des catégories. Sans elles, un
 * soulignage se juge par degrés et le professeur reste seul juge : c'est le
 * comportement historique, et il ne change pas.
 */
export function seCorrigeSeule(q: LectureQuestion): boolean {
  switch (q.type) {
    case 'qcm':
    case 'matrice':
    case 'appariement':
    case 'ordre':
    case 'image-annotee':
    case 'ensembles':
      return true;
    case 'fluorage':
      return !!q.fluoCategories?.length;
    default:
      return false;
  }
}

export function scoreLectureQuiz(
  quiz: LectureQuiz | null | undefined,
  answers: Record<string, LectureAnswer>,
  questionScores?: Record<string, number>
): LectureScore {
  const vide: LectureScore = {
    points: 0,
    max: 0,
    percent: null,
    aNoter: 0,
    parQuestion: [],
    parHabilete: [],
  };
  if (!quiz?.questions?.length) return vide;

  const questions = quiz.questions.filter(isScorable);
  const parQuestion = questions.map((q) => scoreQuestion(q, answers, questionScores));

  let points = 0;
  let max = 0;
  let aNoter = 0;
  parQuestion.forEach((s) => {
    if (s.points === null) {
      aNoter++;
      return;
    }
    points += s.points;
    max += s.max;
  });

  // Agrégation par habileté : chaque question notée est versée en entier à
  // chacune de ses habiletés
  const parHabilete = new Map<string, HabileteScore>();
  questions.forEach((q, i) => {
    const s = parQuestion[i];
    if (s.points === null) return;
    q.competences.forEach((id) => {
      const cur = parHabilete.get(id) ?? { habileteId: id, points: 0, max: 0, questions: 0 };
      cur.points += s.points!;
      cur.max += s.max;
      cur.questions += 1;
      parHabilete.set(id, cur);
    });
  });

  return {
    points: Math.round(points * 10) / 10,
    max,
    percent: max > 0 ? Math.round((points / max) * 100) : null,
    aNoter,
    parQuestion,
    parHabilete: [...parHabilete.values()],
  };
}

// Fusion de plusieurs activités pour le profil : les points s'additionnent
// habileté par habileté à travers toutes les activités de lecture
export function mergeHabileteScores(scores: HabileteScore[][]): HabileteScore[] {
  const total = new Map<string, HabileteScore>();
  scores.flat().forEach((s) => {
    const cur = total.get(s.habileteId) ?? {
      habileteId: s.habileteId,
      points: 0,
      max: 0,
      questions: 0,
    };
    cur.points += s.points;
    cur.max += s.max;
    cur.questions += s.questions;
    total.set(s.habileteId, cur);
  });
  return [...total.values()].sort((a, b) => b.max - a.max);
}
