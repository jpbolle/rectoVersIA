// Questionnaire de lecture (activités de type « lire ») :
// le prof compose des blocs de questions au verso de la création d'activité,
// l'élève y répond dans sa colonne de gauche (mode worksheet ou quiz).

import type { DrawShape } from './draw';

export type LectureQuizMode = 'worksheet' | 'quiz';

// 'info' : bloc informatif — pas une question, le prof introduit ou commente
// à même le questionnaire (pas de points, pas de réponse)
export type LectureQuestionType = 'qcm' | 'texte-court' | 'texte-long' | 'fluorage' | 'info';

// Compétences de lecture exercées (alimentent l'onglet Lire du profil élève)
export type LectureCompetence =
  | 'explicite'
  | 'inferer'
  | 'interpreter'
  | 'forme'
  | 'modes-medias'
  | 'esprit-critique'
  | 'structures';

export const LECTURE_COMPETENCE_LABELS: Record<LectureCompetence, string> = {
  explicite: "Comprendre l'explicite",
  inferer: 'Inférer',
  interpreter: 'Interpréter',
  forme: 'Analyser la forme',
  'modes-medias': 'Modes et médias',
  'esprit-critique': 'Exercer son esprit critique',
  structures: 'Identifier des structures',
};

export const LECTURE_COMPETENCES: LectureCompetence[] = [
  'explicite',
  'inferer',
  'interpreter',
  'forme',
  'modes-medias',
  'esprit-critique',
  'structures',
];

// Image jointe à une question — stockée en base64 Firestore (ressourceImages),
// servie par /api/ressources/image/[id]
export interface LectureQuestionImage {
  url: string;
  fileId: string;
}

export interface LectureQuestion {
  id: string;                       // LQ-{timestamp}-{rand}
  type: LectureQuestionType;
  enonce: string;
  points: number;
  competences: LectureCompetence[];
  // Toute question peut porter une image : vignette + agrandissement,
  // et atelier de tracé complet côté élève (tracés enregistrés avec la réponse)
  image?: LectureQuestionImage | null;
  // Réponse idéale du prof — jamais exposée à l'élève (filtrée côté serveur),
  // affichée dans la correction pour comparaison
  reponseIdeale?: string;
  // QCM
  choices?: string[];
  correctIndex?: number;            // jamais exposé à l'élève (filtré côté serveur)
  // Fluorage : extrait collé dans la question, ou la ressource de l'activité
  // (l'élève fluore alors dans l'onglet Ressources — annotations existantes)
  fluoSource?: 'extrait' | 'ressource';
  fluoTexte?: string;
}

export interface LectureQuiz {
  mode: LectureQuizMode;
  questions: LectureQuestion[];
}

// ── Réponses de l'élève — stockées en JSON dans travail.content ──

export interface LectureAnswer {
  choiceIndex?: number | null;      // qcm
  text?: string;                    // texte court (brut) / texte long (HTML Tiptap)
  shapes?: DrawShape[];             // tracés sur l'image de la question
  fluoWords?: number[];             // indices des mots fluorés (fluorage « extrait »)
}

export interface LectureAnswersState {
  type: 'lecture';
  answers: Record<string, LectureAnswer>;   // clé = LectureQuestion.id
}

export function generateLectureQuestionId(): string {
  return `LQ-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function parseLectureAnswers(content: string | undefined | null): LectureAnswersState | null {
  if (!content) return null;
  try {
    const parsed = JSON.parse(content);
    if (parsed && parsed.type === 'lecture' && parsed.answers) return parsed as LectureAnswersState;
    return null;
  } catch {
    return null;
  }
}
