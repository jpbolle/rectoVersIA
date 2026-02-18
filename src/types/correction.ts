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
  score?: number;
  status?: CorrectionStatus;
  visibleParEleve?: boolean;
  annotatedContent?: string;
  audioAnnotations?: AudioAnnotation[];
  draftAnnotations?: Record<string, DraftItemAnnotation>;
}
