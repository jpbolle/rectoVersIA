// Référentiel « Français langue étrangère » géré par l'admin (page /admin,
// Gestion didactique › FLE). Stocké dans le document Firestore
// configuration/didactique-fle — accès via /api/didactique-fle uniquement
// (routes serveur, pas de règle Firestore).
//
// C'est le SECOND référentiel de l'application, à côté de la didactique du
// français (UAA + habiletés, `didactique.ts`). Les deux ne se mélangent pas :
// une classe de type « fle » (cf. `classe.ts`) présente celui-ci à la place
// des UAA dans ses formulaires.
//
// Modèle :
//  - une COMPÉTENCE est une branche du radar (compréhension orale, écrite,
//    production orale, écrite, interaction, grammaire, lexique, FLSco) ;
//  - un NIVEAU est un cran du CECR (Cadre européen commun de référence pour
//    les langues), ordonné par `rang` : pré-A1 = 0 … C2 = 6. La maquette de
//    JP s'arrête à B2 : C1 et C2 existent mais sont masqués par défaut ;
//  - un DESCRIPTEUR est un « Je peux… » à la croisée d'une compétence et
//    d'un niveau — l'équivalent FLE des habiletés ;
//  - un TYPE DE MODULE qualifie un module de la bibliothèque FLE (grammaire,
//    vocabulaire, phonétique…). Liste ouverte, tenue par l'admin.
//
// Masquer (visible: false) retire l'élément des nouveaux formulaires sans
// casser l'affichage des contenus qui l'utilisent déjà — préférer masquer
// à supprimer quand l'élément a déjà servi.

import type { DidactiqueItem } from './didactique';

export type { DidactiqueItem };

export interface NiveauCecr {
  id: string; // 'pre-a1', 'a1', 'a2', 'b1', 'b2', 'c1', 'c2'
  label: string; // « A1 »
  rang: number; // 0 = pré-A1 … 6 = C2 — l'ordre des anneaux du radar
  visible: boolean;
}

export interface DescripteurFle {
  id: string;
  competence: string; // id d'une compétence
  niveau: string; // id d'un niveau
  label: string; // « Je peux me présenter et présenter quelqu'un »
  visible: boolean;
}

export interface DidactiqueFleConfig {
  competences: DidactiqueItem[];
  niveaux: NiveauCecr[];
  descripteurs: DescripteurFle[];
  typesModule: DidactiqueItem[];
}

// ─── Défauts ───
// Servis tant que l'admin n'a rien enregistré, et pour remplir un document
// vide. Les huit compétences sont celles de la maquette du radar (2026-09-14),
// dans le sens horaire depuis le haut.
export const DEFAULT_COMPETENCES_FLE: DidactiqueItem[] = [
  { id: 'comprehension-orale', label: 'Compréhension orale', visible: true },
  { id: 'comprehension-ecrite', label: 'Compréhension écrite', visible: true },
  { id: 'production-orale', label: 'Production orale', visible: true },
  { id: 'production-ecrite', label: 'Production écrite', visible: true },
  { id: 'interaction', label: 'Interaction', visible: true },
  { id: 'grammaire', label: 'Grammaire', visible: true },
  { id: 'lexique', label: 'Lexique', visible: true },
  { id: 'flsco', label: 'FLSco (langue de l’école)', visible: true },
];

export const DEFAULT_NIVEAUX_CECR: NiveauCecr[] = [
  { id: 'pre-a1', label: 'Pré-A1', rang: 0, visible: true },
  { id: 'a1', label: 'A1', rang: 1, visible: true },
  { id: 'a2', label: 'A2', rang: 2, visible: true },
  { id: 'b1', label: 'B1', rang: 3, visible: true },
  { id: 'b2', label: 'B2', rang: 4, visible: true },
  // Au-delà de B2, le dispositif DASPA n'a plus d'élève : masqués, pas supprimés
  { id: 'c1', label: 'C1', rang: 5, visible: false },
  { id: 'c2', label: 'C2', rang: 6, visible: false },
];

export const DEFAULT_TYPES_MODULE_FLE: DidactiqueItem[] = [
  { id: 'grammaire', label: 'Grammaire', visible: true },
  { id: 'vocabulaire', label: 'Vocabulaire', visible: true },
  { id: 'phonetique', label: 'Phonétique', visible: true },
  { id: 'actes-de-parole', label: 'Actes de parole', visible: true },
  { id: 'langue-de-l-ecole', label: 'Langue de l’école', visible: true },
  { id: 'culture', label: 'Culture', visible: true },
];

// Quelques « Je peux… » d'amorce, un par compétence, au niveau A1 — pour que
// l'admin voie la forme attendue et n'ouvre pas sur des tableaux vides.
export const DEFAULT_DESCRIPTEURS_FLE: DescripteurFle[] = [
  {
    id: 'd-co-a1',
    competence: 'comprehension-orale',
    niveau: 'a1',
    label: 'Je peux comprendre des mots familiers et des expressions très courantes si l’on parle lentement.',
    visible: true,
  },
  {
    id: 'd-ce-a1',
    competence: 'comprehension-ecrite',
    niveau: 'a1',
    label: 'Je peux comprendre des noms familiers, des mots et des phrases très simples (affiches, catalogues).',
    visible: true,
  },
  {
    id: 'd-po-a1',
    competence: 'production-orale',
    niveau: 'a1',
    label: 'Je peux utiliser des expressions simples pour décrire où j’habite et les gens que je connais.',
    visible: true,
  },
  {
    id: 'd-pe-a1',
    competence: 'production-ecrite',
    niveau: 'a1',
    label: 'Je peux écrire une courte carte postale simple et remplir un formulaire avec mes coordonnées.',
    visible: true,
  },
  {
    id: 'd-in-a1',
    competence: 'interaction',
    niveau: 'a1',
    label: 'Je peux poser des questions simples sur des sujets familiers et y répondre.',
    visible: true,
  },
  {
    id: 'd-gr-a1',
    competence: 'grammaire',
    niveau: 'a1',
    label: 'Je peux conjuguer être et avoir au présent et former une phrase simple.',
    visible: true,
  },
  {
    id: 'd-lx-a1',
    competence: 'lexique',
    niveau: 'a1',
    label: 'Je connais le vocabulaire de la classe, de la famille, des nombres et des jours.',
    visible: true,
  },
  {
    id: 'd-fs-a1',
    competence: 'flsco',
    niveau: 'a1',
    label: 'Je comprends les consignes de base de l’école : lis, écris, souligne, entoure.',
    visible: true,
  },
];

export const DEFAULT_DIDACTIQUE_FLE: DidactiqueFleConfig = {
  competences: DEFAULT_COMPETENCES_FLE,
  niveaux: DEFAULT_NIVEAUX_CECR,
  descripteurs: DEFAULT_DESCRIPTEURS_FLE,
  typesModule: DEFAULT_TYPES_MODULE_FLE,
};

// ─── Lectures ───

// Niveaux visibles, du plus bas au plus haut — l'ordre des anneaux du radar
export function niveauxVisibles(config: DidactiqueFleConfig | null): NiveauCecr[] {
  return [...(config?.niveaux ?? [])].filter((n) => n.visible).sort((a, b) => a.rang - b.rang);
}

export function competencesVisibles(config: DidactiqueFleConfig | null): DidactiqueItem[] {
  return (config?.competences ?? []).filter((c) => c.visible);
}

// Libellés — repli sur l'id pour une valeur supprimée depuis
export function niveauLabel(config: DidactiqueFleConfig | null, id: string): string {
  return config?.niveaux.find((n) => n.id === id)?.label ?? id;
}

export function competenceLabel(config: DidactiqueFleConfig | null, id: string): string {
  return config?.competences.find((c) => c.id === id)?.label ?? id;
}

export function typeModuleLabel(config: DidactiqueFleConfig | null, id: string): string {
  return config?.typesModule.find((t) => t.id === id)?.label ?? id;
}

// Les « Je peux… » d'une compétence à un niveau donné
export function descripteursDe(
  config: DidactiqueFleConfig | null,
  competence: string,
  niveau: string
): DescripteurFle[] {
  return (config?.descripteurs ?? []).filter(
    (d) => d.visible && d.competence === competence && d.niveau === niveau
  );
}

// Identifiant lisible dérivé d'un libellé — stable une fois posé (même
// mécanique que les méthodes d'enseignement du référentiel français)
export function slugFle(label: string, existants: Set<string>, prefixe = 'item'): string {
  const base = label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  let id = base || `${prefixe}-${existants.size + 1}`;
  let n = 2;
  while (existants.has(id)) id = `${base || prefixe}-${n++}`;
  return id;
}
