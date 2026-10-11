// GESTION DE L'AFFICHAGE (administration, plan 2026-10-11-gestion-affichage) :
// ce que les profs — et leurs élèves — voient des ateliers, des onglets de
// Mes Ressources et de quelques outils, pendant qu'un outil se met au point.
//
// Trois états par élément :
//  - visible : comme toujours ;
//  - test    : utilisable, avec un badge « Nouveau — en test » ;
//  - masque  : un atelier ou un onglet reste VISIBLE mais GRISÉ, transparent et
//              non cliquable (« Bientôt disponible », ou la note de JP) ; un
//              outil disparaît.
// Le masqué reste NORMAL pour l'admin et les PROFS TESTEURS (étiquette « masqué
// aux profs »), et pour les ÉLÈVES dont un prof est l'admin ou un testeur
// (option A de JP : « il suit le prof »).
//
// Masquer = INTERFACE seulement : aucune route ne refuse quoi que ce soit, une
// activité déjà créée avec un atelier masqué continue de fonctionner.
// Document `configuration/affichage`, serveur seulement (`/api/affichage`).

import { ATELIERS } from './didactique';

export type EtatAffichage = 'visible' | 'test' | 'masque';
export type GroupeAffichage = 'ateliers' | 'ressources' | 'outils';

export interface ElementAffichage {
  cle: string; // « atelier:portfolio », « ressource:grilles », « outil:roue »
  groupe: GroupeAffichage;
  label: string;
  // Où ça se voit, dit en clair dans la page d'administration
  aide?: string;
}

export const ELEMENTS_AFFICHAGE: ElementAffichage[] = [
  ...ATELIERS.filter((a) => a.dispositif !== 'sequence').map((a) => ({
    cle: `atelier:${a.id}`,
    groupe: 'ateliers' as const,
    label: a.label,
  })),
  { cle: 'ressource:grilles', groupe: 'ressources', label: 'Grilles d’évaluation' },
  { cle: 'ressource:vocabulaire', groupe: 'ressources', label: 'Listes de vocabulaire' },
  { cle: 'ressource:questionnaires', groupe: 'ressources', label: 'Questionnaires de lecture' },
  { cle: 'ressource:oeuvres', groupe: 'ressources', label: 'Bibliothèque d’œuvres' },
  { cle: 'ressource:portfolios', groupe: 'ressources', label: 'Portfolios' },
  { cle: 'ressource:conceptualisations', groupe: 'ressources', label: 'Conceptualisations' },
  { cle: 'ressource:scenarisation', groupe: 'ressources', label: 'Design & scénarisation didactique' },
  { cle: 'ressource:fle-theorie', groupe: 'ressources', label: 'FLE — Points de théorie' },
  { cle: 'ressource:fle-activites', groupe: 'ressources', label: 'FLE — Activités FLE' },
  { cle: 'outil:aide-ia-eleve', groupe: 'outils', label: 'Aide IA de l’élève', aide: 'L’onglet « Aide IA » dans l’activité de l’élève' },
  { cle: 'outil:aide-ia-prof', groupe: 'outils', label: 'Aide IA du professeur', aide: 'L’onglet d’aide IA à la correction, dans la copie' },
  { cle: 'outil:ceintures', groupe: 'outils', label: 'Ceintures', aide: 'Les ceintures par UAA : profil de l’élève, certifications de la classe' },
  { cle: 'outil:roue', groupe: 'outils', label: 'Roue de progression', aide: 'La roue des ceintures sur l’accueil de l’élève' },
  { cle: 'outil:competition', groupe: 'outils', label: 'Compétition en direct', aide: 'Le mode compétition du questionnaire et le bouton « Jouer »' },
  { cle: 'outil:sondage-direct', groupe: 'outils', label: 'Sondage en direct', aide: 'Le bouton « Ouvrir » du sondage piloté en classe' },
  { cle: 'outil:espace-fle', groupe: 'outils', label: 'Espace FLE', aide: 'Le double bouton « classique / FLE » de l’en-tête' },
  { cle: 'outil:roadmap', groupe: 'outils', label: 'Roadmap', aide: 'L’entrée « Roadmap » du menu de l’avatar' },
];

export const GROUPE_AFFICHAGE_LABELS: Record<GroupeAffichage, { titre: string; aide: string }> = {
  ateliers: { titre: 'Ateliers', aide: 'La popup « Choix de l’activité » et le formulaire de création. Masqué : grisé, non cliquable.' },
  ressources: { titre: 'Onglets de Mes Ressources', aide: 'Masqué : l’onglet reste visible, grisé, non cliquable.' },
  outils: { titre: 'Outils', aide: 'Masqué : l’outil disparaît pour ceux qui ne le voient pas.' },
};

export const ETAT_AFFICHAGE_LABELS: Record<EtatAffichage, string> = {
  visible: 'Visible',
  test: 'En test',
  masque: 'Masqué',
};

export const MAX_NOTE_AFFICHAGE = 160;

export interface ReglageAffichage {
  etat: EtatAffichage;
  note?: string;
}

/** Le document `configuration/affichage`. */
export interface ConfigAffichage {
  elements: Record<string, ReglageAffichage>;
  // Les profs TESTEURS, par uid (choisis dans la liste des profs — jamais une adresse)
  testeurs: string[];
}

/** Ce que reçoit chaque utilisateur : les réglages, et s'il voit le masqué. */
export interface AffichageResolu {
  elements: Record<string, ReglageAffichage>;
  voitMasque: boolean;
}

/** Ce que l'interface fait d'un élément, pour CET utilisateur. */
export interface VueAffichage {
  // Masqué et pas pour lui : atelier / onglet grisé, outil absent
  bloque: boolean;
  // « Nouveau — en test »
  enTest: boolean;
  // Masqué aux profs, mais lui le voit (admin, testeur) : petite étiquette
  masqueAuxProfs: boolean;
  // Le texte du survol d'un élément bloqué
  note: string;
}

export const VUE_LIBRE: VueAffichage = { bloque: false, enTest: false, masqueAuxProfs: false, note: '' };

export function vueAffichage(a: AffichageResolu | null | undefined, cle: string): VueAffichage {
  const r = a?.elements[cle];
  if (!r || r.etat === 'visible') return VUE_LIBRE;
  const note = r.note?.trim() || 'Bientôt disponible';
  if (r.etat === 'test') return { bloque: false, enTest: true, masqueAuxProfs: false, note };
  return a!.voitMasque
    ? { bloque: false, enTest: false, masqueAuxProfs: true, note }
    : { bloque: true, enTest: false, masqueAuxProfs: false, note };
}
