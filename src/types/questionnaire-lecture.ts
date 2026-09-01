// ═══ QUESTIONNAIRE DE LECTURE — le MATÉRIEL, sorti de l'activité ═══
//
// Jusqu'au 2026-09-01, le questionnaire d'une activité de lecture vivait DANS
// le document `devoirs`. Le rejouer l'année suivante obligeait donc à dupliquer
// l'activité entière — et cette duplication recopie une vingtaine de champs à
// la main, ce qui a déjà produit des coquilles vides quand l'un d'eux était
// oublié.
//
// Le questionnaire devient donc un document à part, au même rang que les
// grilles, les œuvres et les listes de vocabulaire : il vit dans Mes
// Ressources, et les activités y RENVOIENT.
//
// ⚠ COMPATIBILITÉ — la référence n'est pas obligatoire. Une activité qui porte
// encore son questionnaire en propre (`devoirs.lectureQuiz`) continue de
// fonctionner exactement comme avant. C'est ce repli qui permet de migrer sans
// interrompre la production, et c'est aussi lui qui, à terme, tiendra lieu de
// version FIGÉE pour les sessions déjà passées.
//
// Voir `harnais/plans/2026-09-01-sessions-par-classe.md`, étape 4.

import type { LectureQuiz } from './lecture';

export interface QuestionnaireLecture {
  id: string; // QLE-YYYYMMDD-XXXX
  /** Ce sous quoi le prof le retrouve dans sa bibliothèque */
  nom: string;
  description?: string;
  profId: string;
  anneeScolaire: string;
  archive: boolean;
  /** Questionnaire d'exemple, visible de tous les profs (admin seulement) */
  shared?: boolean;
  /** Le contenu même : mode + questions */
  quiz: LectureQuiz;
  createdAt: string;
  updatedAt: string;
}

/** Ce qu'on montre dans une carte, sans charger toutes les questions. */
export interface QuestionnaireLectureResume {
  id: string;
  nom: string;
  description?: string;
  profId: string;
  anneeScolaire: string;
  archive: boolean;
  shared?: boolean;
  /** Nombre de questions, blocs informatifs exclus */
  nbQuestions: number;
  /** Total des points */
  points: number;
  mode: LectureQuiz['mode'];
  updatedAt: string;
}

function horodatage(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export function generateQuestionnaireLectureId(): string {
  const suffixe = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `QLE-${horodatage()}-${suffixe}`;
}

/** Les chiffres d'une carte, calculés à la lecture (jamais stockés). */
export function resumerQuiz(quiz: LectureQuiz | null | undefined): {
  nbQuestions: number;
  points: number;
} {
  const questions = quiz?.questions ?? [];
  return {
    nbQuestions: questions.filter((q) => q.type !== 'info').length,
    points: questions.reduce((s, q) => s + (q.points || 0), 0),
  };
}
