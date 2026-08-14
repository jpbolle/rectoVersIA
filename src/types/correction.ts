import type { RechercheQuestionScore } from './navigkid';
import type { AutoEvalAnswer } from './autoevaluation';

export type CorrectionStatus = 'draft' | 'finalized';

export interface AudioAnnotation {
  id: string;
  audioData: string;   // base64 data URL (data:audio/webm;base64,...)
  createdAt: string;
}

export interface DraftItemAnnotation {
  status?: 'correct' | 'incorrect';
  audio?: string; // base64 data URL (data:audio/webm;base64,...)
}

export interface Correction {
  id: string;                                    // CORR-{travailId}
  travailId: string;
  devoirId: string;
  studentId: string;
  profId: string;
  profEmail: string;
  evaluation: Record<string, number>;            // {criterionId: level}
  commentaireGeneral: string;
  commentaireGeneralAudio?: string;              // base64 data URL (commentaire vocal)
  commentairesCriteres?: Record<string, string>; // {criterionId: commentaire}
  // Questionnaire de lecture : points attribués par le prof aux questions
  // ouvertes ({questionId: points}). Les QCM ne sont PAS stockés ici — ils sont
  // recalculés à la lecture (voir lib/lecture-scoring.ts).
  questionScores?: Record<string, number>;
  // Activité de recherche (NavigKid) : deux notes par question — la réponse et
  // la démarche. Clé = index de la question. Voir lib/recherche-scoring.ts.
  rechercheScores?: Record<string, RechercheQuestionScore>;
  // Auto-évaluation : le REGARD DU PROF sur l'élève, donné aux mêmes questions
  // que lui. Ce n'est pas une note — c'est un second point de vue, dont l'écart
  // avec celui de l'élève dit sa lucidité. Voir lib/autoeval-scoring.ts.
  // Clé = AutoEvalQuestion.id. Le prof ne se prononce que sur les questions
  // ordonnées (sentiment de compétence, échelle 1-5) : une émotion ne s'évalue pas.
  autoEvalProf?: Record<string, AutoEvalAnswer>;
  score: number;                                 // Score total calcule
  status: CorrectionStatus;
  visibleParEleve: boolean;
  annotatedContent?: string;                     // HTML annote par le prof
  audioAnnotations?: AudioAnnotation[];          // Commentaires vocaux
  draftAnnotations?: Record<string, DraftItemAnnotation>; // Annotations sur le brouillon
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
  version: number;
}

export interface CreateCorrectionData {
  travailId: string;
  devoirId: string;
  studentId: string;
  evaluation?: Record<string, number>;
  commentaireGeneral?: string;
  score?: number;
}

export interface UpdateCorrectionData {
  evaluation?: Record<string, number>;
  commentaireGeneral?: string;
  commentaireGeneralAudio?: string;
  commentairesCriteres?: Record<string, string>;
  questionScores?: Record<string, number>;
  rechercheScores?: Record<string, RechercheQuestionScore>;
  autoEvalProf?: Record<string, AutoEvalAnswer>;
  score?: number;
  status?: CorrectionStatus;
  visibleParEleve?: boolean;
  annotatedContent?: string;
  audioAnnotations?: AudioAnnotation[];
  draftAnnotations?: Record<string, DraftItemAnnotation>;
}
