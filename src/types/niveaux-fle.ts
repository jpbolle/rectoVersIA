// Positionnement CECR d'un élève FLE — ce que le prof règle avec les huit
// curseurs de la fiche élève, et que l'élève voit en radar sur /fle.
//
// Document Firestore niveauxFle/{eleveId}, accès serveur uniquement
// (/api/niveaux-fle). Un élève inscrit dans deux classes a deux documents
// `eleves`, donc potentiellement deux positionnements : la lecture côté élève
// prend le plus récent.
//
// Ce qui s'y trouve ne se DÉDUIT PAS des travaux : c'est le regard du prof.
// Le radar garde ses huit branches même pour les compétences qu'aucune
// activité n'alimente encore (interaction, production orale — chantier
// ultérieur) : elles vivent du positionnement seul.

export interface ObjectifMois {
  mois: string; // « 2026-09 »
  texte: string;
}

export interface NiveauxFle {
  eleveId: string;
  // compétence → niveau (ids du référentiel configuration/didactique-fle).
  // Une compétence absente = pas encore positionnée : pré-A1 sur le radar.
  positionnement: Record<string, string>;
  objectifsMois: ObjectifMois[];
  // Les positionnements précédents, du plus récent au plus ancien — posés à
  // chaque changement des curseurs, 24 au plus
  historique: { date: string; positionnement: Record<string, string> }[];
  updatedAt: string;
}

export const HISTORIQUE_MAX = 24;

// Le mois courant au format « 2026-09 »
export function moisCourant(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// « septembre 2026 » — un « 2026-09 » nu se lit mal
export function libelleMois(mois: string): string {
  const [a, m] = mois.split('-').map(Number);
  if (!a || !m) return mois;
  return new Date(a, m - 1, 1).toLocaleDateString('fr-BE', { month: 'long', year: 'numeric' });
}
