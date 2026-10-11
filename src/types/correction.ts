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
  // Qui a rédigé la correction, quand ce n'est pas l'auteur de l'activité
  // (coprofesseur d'une classe, 2026-10-04). `profId` reste l'auteur.
  correcteurUid?: string;
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
  // Atelier de conceptualisation : les PASTILLES du prof sur le schéma de
  // l'élève (vert = juste, rouge = faux), par boîte et par lien (2026-10-11)
  schemaMarques?: SchemaMarques;
  // ÉLÈVE : l'évaluation (grille, note, commentaire général) lui est-elle
  // ouverte ? Faux pour une copie renvoyée pour réécriture, même publiée
  // (`visibleParEleve`) — elle n'arrive qu'avec « Rendre comme corrigé ».
  evaluationVisible?: boolean;
  score: number;                                 // Score total calcule (GRILLE seulement)
  // Questionnaire de lecture : le total, ÉCRIT au moment de la correction.
  // `score` ci-dessus reste à 0 pour ces activités — il appartient aux grilles.
  // L'affichage continue de recalculer (lib/lecture-scoring.ts) ; ce champ est
  // la trace de la note donnée, lue par KitSchool à l'import. Voir
  // lib/lecture-score-persistance.ts.
  scoreLecture?: {
    percent: number | null;
    points: number;
    max: number;
    aNoter: number;
    calculeLe: string;
  };
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
  schemaMarques?: SchemaMarques;
  score?: number;
  status?: CorrectionStatus;
  visibleParEleve?: boolean;
  annotatedContent?: string;
  audioAnnotations?: AudioAnnotation[];
  draftAnnotations?: Record<string, DraftItemAnnotation>;
}

/** Une pastille : juste ou faux. Absente = pas d'avis. */
export type MarqueSchema = 'ok' | 'faux';

/**
 * Les pastilles d'une copie de schéma. Clés = identifiants du schéma de
 * l'élève : `boites` → id d'une boîte ; `liens` → id d'un lien de carte
 * conceptuelle / schéma libre, ou `t_{idDeLaBoite}` pour le rattachement
 * d'une idée à son parent (carte mentale, hiérarchie).
 */
export interface SchemaMarques {
  boites?: Record<string, MarqueSchema>;
  liens?: Record<string, MarqueSchema>;
}
