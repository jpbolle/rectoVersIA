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
  // LANGUE MATERNELLE (2026-10-08) — code de `LANGUES_MATERNELLES`, '' = pas
  // encore posée. Posée par le prof dans la fiche ; sert aux aides lexicales
  // de la lecture de cours. ⚠ Indice d'origine : CHIFFRÉE en base (encrypt),
  // jamais dans un where().
  langueMaternelle: string;
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

// Les langues des élèves DASPA — la liste de l'extension Daspalecte (11),
// même codes (ISO 639-1 ; « fa » pour le dari, qui n'a pas de code propre).
export const LANGUES_MATERNELLES: { code: string; label: string }[] = [
  { code: 'ar', label: 'Arabe' },
  { code: 'en', label: 'Anglais' },
  { code: 'fa', label: 'Dari' },
  { code: 'es', label: 'Espagnol' },
  { code: 'ku', label: 'Kurde' },
  { code: 'ps', label: 'Pashto' },
  { code: 'pl', label: 'Polonais' },
  { code: 'ro', label: 'Roumain' },
  { code: 'ru', label: 'Russe' },
  { code: 'tr', label: 'Turc' },
  { code: 'uk', label: 'Ukrainien' },
];

export function langueLabel(code: string): string {
  return LANGUES_MATERNELLES.find((l) => l.code === code)?.label ?? code;
}

export function estLangueConnue(code: unknown): code is string {
  return typeof code === 'string' && LANGUES_MATERNELLES.some((l) => l.code === code);
}

// NIVEAU GLOBAL — déduit du radar, jamais saisi (décision JP, 2026-10-08) :
// la médiane BASSE des compétences positionnées. Basse plutôt que haute parce
// qu'il commande la quantité d'aides lexicales : au doute, on aide plus.
// Aucune compétence positionnée → null (l'appelant décide du repli).
export function niveauGlobal<N extends { id: string; rang: number }>(
  positionnement: Record<string, string>,
  niveaux: N[]
): N | null {
  const rangs = Object.values(positionnement)
    .map((id) => niveaux.find((n) => n.id === id))
    .filter((n): n is N => !!n)
    .map((n) => n.rang)
    .sort((a, b) => a - b);
  if (rangs.length === 0) return null;
  const median = rangs[Math.floor((rangs.length - 1) / 2)];
  return niveaux.find((n) => n.rang === median) ?? null;
}

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
