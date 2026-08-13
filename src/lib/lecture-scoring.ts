// Notation d'un questionnaire de lecture, et agrégation par habileté.
//
// Deux sources de points :
//  - QCM : comptés automatiquement (réponse == correctIndex), jamais stockés —
//    recalculés à chaque lecture pour rester justes si le prof corrige le quiz ;
//  - autres questions : notées à la main par le prof, de 0 au maximum de la
//    question, dans correction.questionScores.
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

export interface QuestionScore {
  questionId: string;
  points: number | null; // null = pas encore noté
  max: number;
  auto: boolean; // true = QCM compté automatiquement
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

// Note d'une question : automatique pour les QCM, saisie du prof sinon
function scoreQuestion(
  q: LectureQuestion,
  answers: Record<string, LectureAnswer>,
  questionScores: Record<string, number> | undefined
): QuestionScore {
  const max = q.points || 0;

  if (q.type === 'qcm') {
    // Le corrigé n'est pas toujours transmis au client (filtré pour l'élève) :
    // sans correctIndex, on ne peut pas trancher — la question reste à noter
    if (typeof q.correctIndex !== 'number') {
      return { questionId: q.id, points: null, max, auto: true };
    }
    const choix = answers[q.id]?.choiceIndex;
    return {
      questionId: q.id,
      points: choix === q.correctIndex ? max : 0,
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
