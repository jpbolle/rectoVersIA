// PORTFOLIO D'APPRENTISSAGE (plan 2026-10-09-portfolio-etape-1-squelette).
//
// Deux objets :
//  - la MATRICE (`portfolios/{PFO-…}`, Mes Ressources › Portfolios) : la trame
//    réutilisable, sans classe ;
//  - l'ACTIVITÉ (`Devoir.typeTravail === 'portfolio'`, `Devoir.portfolio`) : la
//    COPIE de la matrice donnée à une classe, adaptable sans toucher la matrice.
//
// Une ÉTAPE est SOIT propre au portfolio (`etape` : objectifs, consigne,
// dépôts), SOIT un RENVOI vers une activité de Mes Activités (`activite` :
// conceptualisation, sondage, questionnaire, œuvre…). Les étapes se lisent
// dans l'ordre ; `verrouille` ferme la SUIVANTE tant que celle-ci n'est pas
// faite (réglage du créateur, étape par étape — repris de VibeCoding).
//
// Ce que l'élève dépose vit dans `Travail.content` (JSON `PortfolioContenuEleve`),
// champ par champ, clé `{etapeId}/{depotId}`.

import type { DevoirRessource } from './devoir';
import { generateEtapeId } from './sequence-fle';

export type NaturePortfolioEtape = 'etape' | 'activite';
export type StatutIA = 'libre' | 'partielle' | 'aucune';
export type PorteeEtape = 'personnelle' | 'collective';
// Étape 1 du chantier : texte et groupe. Tableau, image, lien, commentaires
// viendront aux étapes 3 à 5.
export type TypeDepot = 'texte' | 'groupe';

export interface PortfolioDepot {
  id: string; // DEP-…
  libelle: string;
  consigne?: string;
  // Le gris à effacer du Google Docs : affiché en filigrane, jamais enregistré
  exemple?: string;
  obligatoire?: boolean;
  type: TypeDepot;
}

export interface PortfolioEtape {
  id: string; // ETP-…
  nature: NaturePortfolioEtape;
  // Renvoi : l'activité de Mes Activités (titre / atelier recopiés à l'ajout)
  devoirId?: string;
  atelier?: string;
  typeTravail?: string;
  // Étiquette de regroupement (« 1. Premiers préparatifs ») — pas un niveau
  section?: string;
  titre: string;
  objectifs?: string[];
  consigne?: string;
  echeance?: string | null; // ISO (AAAA-MM-JJ)
  ia?: StatutIA | null; // null / absent = le réglage IA de l'activité
  portee?: PorteeEtape; // absent = personnelle
  // true = l'étape SUIVANTE reste fermée tant que celle-ci n'est pas faite
  verrouille?: boolean;
  ressources?: DevoirRessource | null;
  // Vide ou absent sur une étape propre = étape SANS TRACE (cochée à la main)
  depots?: PortfolioDepot[];
}

/** Le contenu d'une ACTIVITÉ portfolio (`Devoir.portfolio`). */
export interface PortfolioContenu {
  // La matrice d'origine, pour la retrouver — jamais resynchronisée
  portfolioId?: string | null;
  tacheFinale?: string;
  etapes: PortfolioEtape[];
}

export const PORTFOLIO_VIDE: PortfolioContenu = { etapes: [] };

/** La MATRICE (Mes Ressources › Portfolios). */
export interface PortfolioMatrice {
  id: string;
  titre: string;
  description: string;
  tacheFinale: string;
  consignes: string; // consignes générales, reprises par l'activité
  ressources: DevoirRessource | null;
  etapes: PortfolioEtape[];
  profId: string;
  archive: boolean;
  anneeScolaire: string;
  createdAt: string;
  updatedAt: string;
}

/** Ce que l'élève dépose — `Travail.content`, JSON. */
export interface PortfolioContenuEleve {
  type: 'portfolio';
  reponses: Record<string, string>; // `${etapeId}/${depotId}` → texte
  cochees: string[]; // étapes sans trace cochées à la main
  derniereEtape?: string; // là où l'élève en était
  // DÉRIVÉ, jamais stocké : le statut du groupe de l'élève (collection
  // `portfolioGroupes`), posé par le hook pour que `faite()` sache si un
  // dépôt « groupe » est rempli
  groupeStatut?: GroupeStatut | null;
}

// ─── Le GROUPE (dépôt de type `groupe`, 2026-10-09) ───
// L'élève déclare ses partenaires ; chacun confirme ; le prof accepte ou
// refuse. Accepté, le groupe partage les étapes collectives (étape 2 du
// chantier). Collection `portfolioGroupes`, accès serveur uniquement.
export type GroupeStatut = 'attente' | 'accepte' | 'refuse';
export type MembreStatut = 'confirme' | 'attente' | 'decline';

export interface MembreVue {
  eleveId: string;
  uid?: string | null;
  nom: string; // « Prénom N. » chez l'élève, « Prénom Nom » chez le prof
  statut: MembreStatut;
  moi?: boolean;
  createur?: boolean;
}

export interface GroupeVue {
  id: string;
  devoirId: string;
  statut: GroupeStatut;
  motif?: string;
  membres: MembreVue[];
  createdAt: string;
  updatedAt: string;
}

export interface CamaradeVue {
  eleveId: string;
  nom: string;
}

export function generateGroupeId(): string {
  return `PFG-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Les étapes portent-elles un dépôt « groupe » ? (sinon, rien à charger) */
export function aUnDepotGroupe(etapes: { depots?: PortfolioDepot[] }[]): boolean {
  return etapes.some((e) => (e.depots ?? []).some((d) => d.type === 'groupe'));
}

export const GROUPE_STATUT_LABELS: Record<GroupeStatut, string> = {
  attente: 'En attente du professeur',
  accepte: 'Groupe accepté',
  refuse: 'Groupe refusé',
};

export function generatePortfolioId(): string {
  return `PFO-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function generateEtapePortfolioId(): string {
  return generateEtapeId();
}

export function generateDepotId(): string {
  return `DEP-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function cleChamp(etapeId: string, depotId: string): string {
  return `${etapeId}/${depotId}`;
}

/** Une étape propre sans aucun dépôt : rien à déposer, l'élève la coche lui-même. */
export function estEtapeSansTrace(e: PortfolioEtape): boolean {
  return e.nature === 'etape' && !(e.depots && e.depots.length > 0);
}

export function nouvelleEtape(patch: Partial<PortfolioEtape> = {}): PortfolioEtape {
  return { id: generateEtapePortfolioId(), nature: 'etape', titre: '', ...patch };
}

export function nouveauDepot(type: TypeDepot = 'texte'): PortfolioDepot {
  return { id: generateDepotId(), libelle: '', type, obligatoire: true };
}

/** Les étapes regroupées par section CONSÉCUTIVE (une section vide = « sans section »). */
export interface SectionPortfolio<T extends PortfolioEtape = PortfolioEtape> {
  section: string;
  etapes: { etape: T; index: number }[];
}

export function sectionsDuPortfolio<T extends PortfolioEtape>(etapes: T[]): SectionPortfolio<T>[] {
  const sections: SectionPortfolio<T>[] = [];
  etapes.forEach((etape, index) => {
    const section = (etape.section ?? '').trim();
    const derniere = sections[sections.length - 1];
    if (derniere && derniere.section === section) derniere.etapes.push({ etape, index });
    else sections.push({ section, etapes: [{ etape, index }] });
  });
  return sections;
}

export const STATUT_IA_LABELS: Record<StatutIA, { court: string; long: string; picto: string }> = {
  libre: { court: 'IA libre', long: 'Les outils d’IA sont permis', picto: '🟢' },
  partielle: { court: 'IA partielle', long: 'IA pour reformuler ou s’aider, pas pour produire à ta place', picto: '🟠' },
  aucune: { court: 'Sans IA', long: 'Aucun outil d’IA dans cette étape', picto: '🔴' },
};

export const PORTEE_LABELS: Record<PorteeEtape, string> = {
  personnelle: 'Travail personnel',
  collective: 'Étape collective',
};

export const TYPE_DEPOT_LABELS: Record<TypeDepot, string> = {
  texte: 'Texte',
  groupe: 'Groupe (déclaration des partenaires)',
};
