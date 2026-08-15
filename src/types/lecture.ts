// Questionnaire de lecture (activités de type « lire ») :
// le prof compose des blocs de questions au verso de la création d'activité,
// l'élève y répond dans sa colonne de gauche (mode worksheet ou quiz).

import type { DrawShape } from './draw';
import type { NiveauConfiance } from './confiance';

export type LectureQuizMode = 'worksheet' | 'quiz';

// 'info' : bloc informatif — pas une question, le prof introduit ou commente
// à même le questionnaire (pas de points, pas de réponse)
export type LectureQuestionType = 'qcm' | 'texte-court' | 'texte-long' | 'fluorage' | 'info';

// Gestes de lecture exercés (alimentent l'onglet Lire du profil élève).
// Les 7 slugs historiques ci-dessous servent de valeurs par défaut ; la liste
// vivante est gérée par l'admin (configuration/didactique) et une question
// peut donc porter n'importe quel id de geste (champ competences: string[]).
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

// Audio joint à une question — même stockage que les images (base64 Firestore,
// ≤ 700 Ko soit ~2 min en qualité voix), servi par /api/ressources/image/[id]
export interface LectureQuestionAudio {
  url: string;
  fileId: string;
  // Nombre d'écoutes autorisées côté élève — absent/null = illimité.
  // Contrôle côté navigateur (compteur dans la réponse), pas inviolable.
  maxEcoutes?: number | null;
}

export interface LectureQuestion {
  id: string;                       // LQ-{timestamp}-{rand}
  type: LectureQuestionType;
  enonce: string;
  points: number;
  competences: string[];   // ids de gestes de lecture (config didactique)
  // Toute question peut porter une image : vignette + agrandissement,
  // et atelier de tracé complet côté élève (tracés enregistrés avec la réponse)
  image?: LectureQuestionImage | null;
  // Toute question peut porter un audio (dictée, compréhension orale),
  // avec un nombre d'écoutes limité ou non
  audio?: LectureQuestionAudio | null;
  // Texte joint à la question — un extrait, un document court, une consigne
  // longue. Affiché sous l'énoncé, avant la zone de réponse.
  document?: string;
  // Réponse idéale du prof — jamais exposée à l'élève (filtrée côté serveur),
  // affichée dans la correction pour comparaison
  reponseIdeale?: string;
  // QCM
  choices?: string[];
  correctIndex?: number;            // jamais exposé à l'élève (filtré côté serveur)
  // Souligner du texte (« fluorage ») : extrait collé dans la question, ou la
  // ressource de l'activité (l'élève souligne alors dans l'onglet Ressources)
  fluoSource?: 'extrait' | 'ressource';
  fluoTexte?: string;
  // Mots attendus soulignés par le prof (indices dans fluoTexte) — jamais
  // exposés à l'élève avant le corrigé ; servent à la comparaison automatique
  fluoAttendu?: number[];
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
  audioPlays?: number;              // nombre d'écoutes de l'audio déjà consommées
  // Degré d'assurance annoncé par l'élève au moment de répondre — facultatif,
  // n'entre dans AUCUN score. Voir src/types/confiance.ts.
  confiance?: NiveauConfiance;
}

export interface LectureAnswersState {
  type: 'lecture';
  answers: Record<string, LectureAnswer>;   // clé = LectureQuestion.id
}

/**
 * Récapitulatif de remise, CALCULÉ SUR LE SERVEUR (`computeLectureResume`) :
 * le navigateur de l'élève n'a pas les bonnes réponses et ne peut donc rien
 * compter. Même forme que le récapitulatif d'une recherche — c'est le même
 * moment du parcours, il doit se lire pareil.
 */
export interface LectureResume {
  total: number;
  correctes: number;
  erreurs: number;
  aCorrigerParProf: number;
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
