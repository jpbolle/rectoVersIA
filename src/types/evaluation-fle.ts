// ═══ ÉVALUATIONS FLE (2026-10-08) ═══
//
// Le prof « glisse » dans une classe FLE ses évaluations — diagnostique,
// régulative ou certificative — sous trois formes : un lien (Google Docs,
// Drive, page), un PDF (stocké en base64 dans `fichiersFle`, ≤ 700 Ko comme
// les images de ressources), ou une ACTIVITÉ existante de Mes Activités (la
// classe lui est alors ajoutée, pour que les élèves puissent l'ouvrir).
// L'élève les retrouve dans la card « Mes évaluations » de « Mon cours FLE ».
//
// Collection `evaluationsFle/{id}` (EVF-…), serveur seul (/api/fle/evaluations).

export type TypeEvaluation = 'diagnostic' | 'regulative' | 'certificative';

export const TYPES_EVALUATION: { id: TypeEvaluation; label: string; aide: string }[] = [
  { id: 'diagnostic', label: 'Diagnostique', aide: 'Au départ : où en est l’élève' },
  { id: 'regulative', label: 'Régulative', aide: 'En cours de route : ajuster' },
  { id: 'certificative', label: 'Certificative', aide: 'À la fin : ce qui compte' },
];

export function labelTypeEvaluation(t: string): string {
  return TYPES_EVALUATION.find((x) => x.id === t)?.label ?? t;
}

export type SourceEvaluation =
  | { kind: 'lien'; url: string }
  | { kind: 'pdf'; fichierId: string; nomFichier: string }
  | { kind: 'activite'; devoirId: string; intitule: string; typeTravail?: string };

export interface EvaluationFle {
  id: string;
  classeId: string;
  profId: string;
  titre: string;
  type: TypeEvaluation;
  source: SourceEvaluation;
  createdAt: string;
  // Côté élève, pour une activité : où il en est
  statut?: 'non-commence' | 'en-cours' | 'remis' | 'corrige';
}

export const PDF_EVALUATION_MAX = 700 * 1024;
