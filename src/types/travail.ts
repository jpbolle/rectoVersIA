import type { DrawShape } from './draw';

export type TravailStatus = 'draft' | 'submitted';

// Types pour le brouillon/plan (verso de la carte)
export type DraftType = 'crc' | 'plan' | 'brouillon';

export interface PlanItem {
  id: string;
  text: string;
  children: PlanItem[];
}

// Paire explication + illustration (toujours liees)
export interface CrcArgument {
  explication: string;
  illustration: string;
}

// Point enrichi pour le brainstorming CRC
export interface CrcPoint {
  id: string;
  text: string;              // idee principale
  arguments: CrcArgument[];  // developpements (explication + illustration)
}

// Element place dans le plan d'argumentation CRC
export interface CrcPlanItem {
  id: string;
  pointId: string;        // reference vers CrcPoint.id
  side: 'positif' | 'negatif'; // origine
}

export interface DraftContent {
  type: DraftType;
  // Mode CRC : points positifs / negatifs (nouveau format enrichi)
  positifs?: string[] | CrcPoint[];
  negatifs?: string[] | CrcPoint[];
  // Mode CRC : avis general (enthousiaste, mitige, negatif...)
  crcAvisGeneral?: string;
  // Mode CRC : plan d'argumentation (ordre des etiquettes)
  crcPlan?: CrcPlanItem[];
  // Mode plan : structure hierarchique d'idees
  plan?: PlanItem[];
  // Mode brouillon : notes libres (HTML)
  notes?: string;
}

export interface Travail {
  id: string;                    // TRV-{devoirId}-{studentId}
  devoirId: string;
  // SES-{devoirId}-{classeId} — la mise en œuvre à laquelle cette copie
  // appartient. Absent sur les travaux antérieurs aux sessions, et sur ceux
  // dont l'élève n'a plus de classe : l'appelant retombe alors sur l'activité.
  sessionId?: string | null;
  studentId: string;             // Firebase UID
  studentEmail: string;
  studentEmailHash?: string;     // Empreinte HMAC de l'email (requêtes d'identification — RGPD)
  studentName: string;
  content: string;               // Contenu HTML (Tiptap)
  draftContent?: DraftContent | null; // Brouillon / plan (verso)
  ressourceAnnotations?: string; // HTML annote par l'eleve (surlignage, rature, soulignement)
  ressourceNotes?: Record<string, string>; // Notes par paragraphe (index → texte)
  // Tracés de l'élève sur les images de ressources (clé = fileId de l'image)
  ressourceImageShapes?: Record<string, DrawShape[]>;
  status: TravailStatus;
  selfEvaluation: Record<string, number> | null;  // {criterionId: level}
  // Travail non rendu — décision du prof (jamais automatique) :
  // 'justifie' = absence/maladie acceptée, pas de note ;
  // 'nonJustifie' = travail non fait sanctionné, cote finale 0 SANS mettre les
  // critères à zéro (les stats de capacités ne sont pas parasitées).
  nonRendu?: NonRenduStatus | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
}

export type NonRenduStatus = 'justifie' | 'nonJustifie';

export interface CreateTravailData {
  devoirId: string;
  content?: string;
}

export interface UpdateTravailData {
  content?: string;
  draftContent?: DraftContent | null;
  ressourceAnnotations?: string;
  ressourceNotes?: Record<string, string>;
  ressourceImageShapes?: Record<string, DrawShape[]>;
  selfEvaluation?: Record<string, number> | null;
  status?: TravailStatus;
  nonRendu?: NonRenduStatus | null;  // prof uniquement
}
