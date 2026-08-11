// Configuration « Didactique du français » gérée par l'admin (page /admin) :
// UAA du programme et gestes (lecture, écriture, recherche). Stockée dans le
// document Firestore configuration/didactique — accès via /api/didactique
// uniquement (routes serveur, pas de règle Firestore).
//
// Les listes alimentent dynamiquement les formulaires : UAA des grilles,
// menu « Gestes de lecture » du questionnaire de lecture, etc.
// Masquer (visible: false) retire l'élément des nouveaux formulaires sans
// casser l'affichage des contenus qui l'utilisent déjà — préférer masquer
// à supprimer quand l'élément a déjà servi.

import { UAA_LIST } from './grille';
import { LECTURE_COMPETENCES, LECTURE_COMPETENCE_LABELS } from './lecture';

export interface DidactiqueItem {
  id: string;      // identifiant stable ("0".."6" pour les UAA, slug pour les gestes)
  label: string;
  visible: boolean;
}

export interface DidactiqueConfig {
  uaa: DidactiqueItem[];
  gestesLecture: DidactiqueItem[];
  gestesEcriture: DidactiqueItem[];
  gestesRecherche: DidactiqueItem[];
}

export const DIDACTIQUE_CATEGORIES: { key: keyof DidactiqueConfig; title: string }[] = [
  { key: 'uaa', title: 'UAA de français' },
  { key: 'gestesLecture', title: 'Gestes de lecture' },
  { key: 'gestesEcriture', title: 'Gestes d’écriture' },
  { key: 'gestesRecherche', title: 'Gestes de recherche' },
];

// Défauts servis tant que l'admin n'a rien enregistré (et semés au premier
// enregistrement). Les ids des gestes de lecture reprennent les slugs
// historiques pour ne pas casser les questionnaires existants.
export const DEFAULT_DIDACTIQUE: DidactiqueConfig = {
  uaa: UAA_LIST.map((u) => ({ id: String(u.id), label: u.label, visible: true })),
  gestesLecture: LECTURE_COMPETENCES.map((c) => ({
    id: c,
    label: LECTURE_COMPETENCE_LABELS[c],
    visible: true,
  })),
  gestesEcriture: [],
  gestesRecherche: [],
};
