// Bibliothèque de modules FLE — onglet « Modules FLE » de Mes Ressources.
//
// Un MODULE est une ressource de THÉORIE, autonome et réutilisable : un point
// de langue (« le verbe avoir », « se présenter ») avec une introduction (les
// indications du prof) et les ressources qui portent la théorie elle-même
// (document, images, vidéos, liens, contenus interactifs — les mêmes cinq
// onglets que le verso d'une activité). Il ne contient PAS d'activités
// (décision JP du 2026-09-14) : sur la ligne du temps d'une séquence, une
// étape est SOIT une théorie (un module), SOIT une activité de Mes Activités.
// Une séquence référence le module, ce qui permet de donner « le verbe avoir »
// à la 1re et à la 4e sans le recopier.
//
// Modèle de partage calqué sur les grilles et les œuvres : chacun voit les
// modules des collègues et les DUPLIQUE pour les modifier ; seul l'admin marque
// un module comme exemple partagé (`shared`). Le partage nominatif en
// co-édition des œuvres n'est pas repris ici (décision JP, 2026-09-14 :
// « mes modules + partage optionnel » — la duplication suffit).
//
// Collection Firestore `modulesFle`, accès serveur uniquement (/api/modules-fle).

import type { DevoirRessource } from './devoir';

export interface ModuleFle {
  id: string; // MFL-YYYYMMDD-XXXX
  titre: string; // « Le verbe avoir »
  description?: string;
  type: string; // id de `typesModule` du référentiel FLE (grammaire, vocabulaire…)
  niveau: string; // id d'un niveau du CECR (a1, a2…)
  competences: string[]; // ids des compétences du radar
  introduction: string; // HTML Tiptap — indications, introduction (pas la théorie)
  ressources: DevoirRessource | null; // la théorie elle-même : document, images, vidéos…
  profId: string;
  profName?: string;
  shared: boolean; // exemple proposé à tous (admin)
  archive: boolean;
  anneeScolaire: string;
  createdAt: string;
  updatedAt: string;
}

// Icône d'un type de module sur sa carte — un repli générique pour les types
// que l'admin ajoute
export const ICONES_TYPE_MODULE: Record<string, string> = {
  grammaire: '🧩',
  vocabulaire: '🗂️',
  phonetique: '🔊',
  'actes-de-parole': '💬',
  'langue-de-l-ecole': '🏫',
  culture: '🎭',
};

export function iconeTypeModule(type: string): string {
  return ICONES_TYPE_MODULE[type] ?? '📘';
}

/** Un texte riche est « vide » s'il n'a que des balises sans texte */
export function introductionVide(html: string | undefined | null): boolean {
  if (!html) return true;
  return html.replace(/<[^>]*>/g, '').trim().length === 0;
}

/** Nombre de ressources jointes (document, outils, fichiers, vidéos, interactifs) */
export function compterRessources(r: DevoirRessource | null | undefined): number {
  if (!r) return 0;
  let n = 0;
  if (r.document && !introductionVide(r.document)) n++;
  if (r.outils && !introductionVide(r.outils)) n++;
  n += r.files?.length ?? 0;
  n += r.videos?.length ?? 0;
  n += r.interactifs?.length ?? 0;
  return n;
}

function horodatage(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function suffixe(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

export function generateModuleFleId(): string {
  return `MFL-${horodatage()}-${suffixe()}`;
}
