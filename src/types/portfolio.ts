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

import type { CSSProperties } from 'react';
import type { DevoirRessource } from './devoir';
import { generateEtapeId } from './sequence-fle';

export type NaturePortfolioEtape = 'etape' | 'activite';
export type StatutIA = 'libre' | 'partielle' | 'aucune';
export type PorteeEtape = 'personnelle' | 'collective';
// Un dépôt combine un ou plusieurs types (plan 2026-10-10-portfolio-depots-
// multitypes) : « texte + lien » = un seul bloc chez l'élève, une zone par
// type. `groupe` ne se combine avec rien (circuit d'acceptation propre).
// `scene` (2026-10-11, JP) : l'élève choisit une scène de l'œuvre fixée par le
// prof (`PortfolioDepot.oeuvreId`) — exclusif lui aussi. Valeur stockée : l'id
// de la section (`oeuvres/{id}/sections/{sectionId}`).
export type TypeDepot = 'texte' | 'lien' | 'image' | 'tableau' | 'scene' | 'groupe';

// Ordre d'affichage des zones chez l'élève, et des cases chez le prof
export const ORDRE_TYPES_DEPOT: TypeDepot[] = ['texte', 'lien', 'image', 'tableau', 'scene', 'groupe'];

// Les types que le prof peut cocher aujourd'hui (les autres : « bientôt »)
export const TYPES_DEPOT_DISPONIBLES: TypeDepot[] = ['texte', 'lien', 'image', 'tableau', 'scene', 'groupe'];

// Les types qui ne se combinent avec aucun autre
export const TYPES_DEPOT_EXCLUSIFS: TypeDepot[] = ['scene', 'groupe'];

// Tableau : le prof fixe les colonnes, l'élève ajoute les lignes
export const MAX_COLONNES_TABLEAU = 8;
export const MAX_LIGNES_TABLEAU = 60;

export interface PortfolioDepot {
  id: string; // DEP-…
  libelle: string;
  consigne?: string;
  // Le gris à effacer du Google Docs : affiché en filigrane, jamais enregistré
  exemple?: string;
  obligatoire?: boolean;
  types: TypeDepot[];
  // Les intitulés des colonnes — dépôt avec la partie « tableau » seulement
  colonnes?: string[];
  // L'œuvre de la bibliothèque où l'élève choisit sa scène — dépôt « scene » seulement
  oeuvreId?: string;
  // ⚠ ANCIENNE FORME (avant le 2026-10-10) : un seul type. Lire les types
  // par `typesDuDepot()`, jamais `type` ni `types` directement.
  type?: TypeDepot;
}

/** Les types d'un dépôt, quelle que soit sa forme en base (`type` seul, ou `types`). */
export function typesDuDepot(d: { types?: TypeDepot[]; type?: TypeDepot }): TypeDepot[] {
  const brut: unknown[] = Array.isArray(d.types) && d.types.length > 0 ? d.types : d.type ? [d.type] : [];
  const types = ORDRE_TYPES_DEPOT.filter((t) => brut.includes(t));
  const exclusif = TYPES_DEPOT_EXCLUSIFS.find((t) => types.includes(t));
  if (exclusif) return [exclusif];
  return types.length > 0 ? types : ['texte'];
}

/**
 * La clé d'une PARTIE de dépôt dans `PortfolioContenuEleve.reponses`.
 * Le texte garde la clé historique `{etapeId}/{depotId}` (les textes déjà
 * déposés restent lisibles) ; les autres parties ajoutent `/{type}`.
 */
export function clePartie(etapeId: string, depotId: string, type: TypeDepot): string {
  const base = cleChamp(etapeId, depotId);
  return type === 'texte' ? base : `${base}/${type}`;
}

// ─── Validation du prof et VALEURS ATTRIBUÉES (plan 2026-10-10-portfolio-
// validation-variables) ───
//
// Chaque étape à dépôts ou à activité se SOUMET au prof ; le prof valide ✓ ou
// refuse ✗, avec une appréciation et un commentaire. En validant, il peut
// ATTRIBUER au groupe des valeurs déclarées dans l'étape (« Le sketch » : une
// scène d'une œuvre ; « La captation » : un lien…), que les étapes suivantes
// affichent. Ce qui revient au groupe vit dans `portfolioSuivi` (serveur).

export type GenreValeur = 'oeuvre' | 'lien' | 'video' | 'integration';

export const GENRE_VALEUR_LABELS: Record<GenreValeur, string> = {
  oeuvre: 'Texte de la bibliothèque',
  lien: 'Lien',
  video: 'Vidéo (YouTube, Drive)',
  integration: 'Page intégrée (Genially…)',
};

/** Une valeur que l'étape ATTRIBUE à la validation — déclarée par le prof. */
export interface ValeurDeclaree {
  id: string; // VAL-…
  nom: string; // « Le sketch »
  genre: GenreValeur;
}

export interface ValidationEtape {
  // true = l'étape suivante reste fermée tant que le prof n'a pas validé
  bloquante: boolean;
  attribue: ValeurDeclaree[];
}

/** Une valeur attribuée plus tôt, affichée dans CETTE étape. */
export interface AffichageValeur {
  valeurId: string;
  place: 'travail' | 'ressources';
}

export type Appreciation = 'bien' | 'moyen' | 'faible';
export const APPRECIATIONS: Record<Appreciation, { emoji: string; label: string }> = {
  bien: { emoji: '😀', label: 'Très bien' },
  moyen: { emoji: '😐', label: 'Correct' },
  // Une vraie grimace (JP, 2026-10-11)
  faible: { emoji: '😖', label: 'Insuffisant' },
};

export interface SoumissionEtape {
  date: string; // ISO
  n: number; // 1re, 2e… soumission (après un refus, on resoumet)
}

export interface RetourEtape {
  decision: 'valide' | 'refuse';
  appreciation?: Appreciation | null;
  commentaire?: string;
  date: string;
  // La soumission sur laquelle porte ce retour : une soumission plus récente
  // = l'étape est « à revoir »
  soumissionN: number;
}

export interface ValeurAttribuee {
  genre: GenreValeur;
  oeuvreId?: string;
  sectionId?: string | null; // absent / null = l'œuvre entière
  url?: string;
  titre?: string; // « Les Fourberies de Scapin — Acte II, scène 7 »
}

/** Ce qui revient à un groupe (ou à un élève sans groupe) — `portfolioSuivi`. */
export interface SuiviPortfolio {
  soumissions: Record<string, SoumissionEtape>;
  // Le DERNIER retour du prof par étape (ce que voit l'élève)
  retours: Record<string, RetourEtape>;
  // TOUS les retours par étape, du plus ancien au plus récent (JP, 2026-10-11 :
  // « garder une trace des refus, nombre et remarques » — pour noter la
  // progression et l'autonomie). Jamais réécrit, seulement allongé.
  historique: Record<string, RetourEtape[]>;
  valeurs: Record<string, ValeurAttribuee>;
}

export const SUIVI_VIDE: SuiviPortfolio = { soumissions: {}, retours: {}, historique: {}, valeurs: {} };

/** Une valeur prête à afficher dans une étape : son nom, son genre, ce qui a été attribué. */
export interface ValeurAffichee {
  valeurId: string;
  nom: string;
  genre: GenreValeur;
  valeur: ValeurAttribuee | null; // null = pas encore attribuée à ce groupe
  place?: 'travail' | 'ressources';
}

/** Ce qu'affiche une étape, résolu : déclaration (dans une étape quelconque) + valeur du groupe. */
export function valeursAffichees(
  etapes: Pick<PortfolioEtape, 'validation'>[],
  etape: Pick<PortfolioEtape, 'affiche'>,
  suivi: SuiviPortfolio | null | undefined,
  place?: 'travail' | 'ressources'
): ValeurAffichee[] {
  const declarees = new Map(etapes.flatMap((e) => e.validation?.attribue ?? []).map((v) => [v.id, v]));
  const resultat: ValeurAffichee[] = [];
  for (const a of etape.affiche ?? []) {
    if (place && a.place !== place) continue;
    const d = declarees.get(a.valeurId);
    if (d) resultat.push({ valeurId: d.id, nom: d.nom, genre: d.genre, valeur: suivi?.valeurs[d.id] ?? null, place: a.place });
  }
  return resultat;
}

export function generateValeurId(): string {
  return `VAL-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** L'étape se soumet-elle au prof ? (dépôts ou activité — pas une étape sans trace) */
export function etapeASoumettre(e: Pick<PortfolioEtape, 'nature' | 'depots'>): boolean {
  return e.nature === 'activite' || (e.depots?.length ?? 0) > 0;
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
  // « Aide de l'IA » : COMMENT l'élève peut s'en servir (JP, 2026-10-11) —
  // lu au survol de la carte IA, côté élève
  iaPrecision?: string;
  portee?: PorteeEtape; // absent = personnelle
  // true = l'étape SUIVANTE reste fermée tant que celle-ci n'est pas faite
  verrouille?: boolean;
  ressources?: DevoirRessource | null;
  // Vide ou absent sur une étape propre = étape SANS TRACE (cochée à la main)
  depots?: PortfolioDepot[];
  // Validation du prof : bloque-t-elle la suite, quelles valeurs attribue-t-elle
  validation?: ValidationEtape | null;
  // Les valeurs attribuées plus tôt qu'affiche cette étape, et où
  affiche?: AffichageValeur[];
  // L'INTRODUCTION (JP, 2026-10-11) : la première étape, obligatoire — un
  // disque en tête du serpentin, symétrique de la cible. Ni dépôt, ni renvoi,
  // ni validation : elle est FAITE dès que l'élève l'a ouverte.
  introduction?: boolean;
  // Son image de couverture : id `ressourceImages` (servie par
  // `/api/ressources/image/{id}`), recadrée dans le cercle à l'affichage
  couverture?: string | null;
  // Son CADRAGE, réglé par le prof (taille + point visé) ; absent = centrée
  couvertureCadrage?: CadrageCouverture | null;
}

/**
 * Le cadrage de la couverture dans le cercle (JP, 2026-10-11) :
 *  - `zoom` : 1 = l'image REMPLIT juste le cercle ; au-dessus elle grandit ;
 *    en dessous elle rétrécit et se voit EN ENTIER, fond blanc autour ;
 *  - `x`, `y` : le point de l'image (en % de l'image ENTIÈRE) posé au centre
 *    du cercle — 50/50 = le centre de l'image ;
 *  - `ratio` : largeur / hauteur de l'image, relevé au chargement dans la
 *    popup. Sans lui (ou sans cadrage), l'image remplit le cercle, centrée.
 */
export interface CadrageCouverture {
  zoom: number;
  x: number;
  y: number;
  ratio?: number | null;
}

export const ZOOM_COUVERTURE_MIN = 0.3;
export const ZOOM_COUVERTURE_MAX = 4;
export const CADRAGE_CENTRE: CadrageCouverture = { zoom: 1, x: 50, y: 50 };

/** Un cadrage borné (lecture tolérante : tout ce qui cloche retombe au centre). */
export function cadrageBorne(c: unknown): CadrageCouverture {
  const v = c && typeof c === 'object' ? (c as Record<string, unknown>) : {};
  const n = (x: unknown, min: number, max: number, def: number) =>
    typeof x === 'number' && Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : def;
  const ratio = typeof v.ratio === 'number' && Number.isFinite(v.ratio) && v.ratio > 0 ? Math.min(10, Math.max(0.1, v.ratio)) : null;
  return {
    zoom: Math.round(n(v.zoom, ZOOM_COUVERTURE_MIN, ZOOM_COUVERTURE_MAX, 1) * 100) / 100,
    x: Math.round(n(v.x, 0, 100, 50) * 10) / 10,
    y: Math.round(n(v.y, 0, 100, 50) * 10) / 10,
    ratio: ratio === null ? null : Math.round(ratio * 1000) / 1000,
  };
}

/**
 * La taille et la place de l'image dans le cercle, en % du cercle — même
 * rendu quelle que soit sa taille (popup, serpentin, page élève, sommaire).
 * L'image garde ses proportions : à zoom 1, son petit côté = le cercle ; on
 * la multiplie par le zoom, puis on pose le point (x, y) au centre.
 * ⚠ Le conteneur doit être `position: relative; overflow: hidden`.
 */
export function styleCouverture(c: CadrageCouverture | null | undefined): CSSProperties {
  const cad = c ? cadrageBorne(c) : null;
  if (!cad?.ratio) return { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' };
  const largeur = (cad.ratio >= 1 ? cad.ratio : 1) * 100 * cad.zoom;
  const hauteur = (cad.ratio >= 1 ? 1 : 1 / cad.ratio) * 100 * cad.zoom;
  return {
    position: 'absolute',
    width: `${largeur}%`,
    height: `${hauteur}%`,
    left: `${50 - (cad.x / 100) * largeur}%`,
    top: `${50 - (cad.y / 100) * hauteur}%`,
    maxWidth: 'none',
    objectFit: 'fill',
  };
}

/** La largeur rendue de l'image, en % du cercle (pour convertir un glisser en %). */
export function largeurCouverture(c: CadrageCouverture): { largeur: number; hauteur: number } {
  const r = c.ratio ?? 1;
  return { largeur: (r >= 1 ? r : 1) * 100 * c.zoom, hauteur: (r >= 1 ? 1 : 1 / r) * 100 * c.zoom };
}

export const TITRE_INTRODUCTION = 'Introduction';

/** Une introduction neuve, vierge. */
export function nouvelleIntroduction(): PortfolioEtape {
  return nouvelleEtape({ introduction: true, titre: TITRE_INTRODUCTION });
}

/** Ce qu'une introduction ne porte jamais (elle reste une page d'information). */
export function nettoyerIntroduction(e: PortfolioEtape): PortfolioEtape {
  return {
    ...e,
    nature: 'etape',
    introduction: true,
    // Chaînes vides, jamais `undefined` (interdit en base)
    devoirId: '',
    atelier: '',
    typeTravail: '',
    depots: [],
    validation: null,
    verrouille: false,
    portee: 'personnelle',
    affiche: [],
  };
}

/**
 * L'introduction en tête, et une seule — sans en CRÉER (lecture : une
 * introduction inventée à chaque lecture changerait d'id à chaque fois).
 * Une introduction en trop redevient une étape ordinaire.
 */
export function ordonnerIntroduction(etapes: PortfolioEtape[]): PortfolioEtape[] {
  const i = etapes.findIndex((e) => e.introduction === true);
  if (i < 0) return etapes;
  const reste = etapes
    .filter((_, k) => k !== i)
    .map((e) => (e.introduction ? { ...e, introduction: false, couverture: null, couvertureCadrage: null } : e));
  return [nettoyerIntroduction(etapes[i]), ...reste];
}

/** L'introduction en tête — créée si elle manque (écriture, constructeur). */
export function avecIntroduction(etapes: PortfolioEtape[]): PortfolioEtape[] {
  const ordonnees = ordonnerIntroduction(etapes);
  return ordonnees[0]?.introduction ? ordonnees : [nouvelleIntroduction(), ...ordonnees];
}

/**
 * Le NUMÉRO affiché d'une étape : l'introduction n'en a pas (null), les
 * étapes qui la suivent commencent à 1. Sans introduction (ancien
 * portfolio jamais réenregistré), on compte depuis 1 comme avant.
 */
export function numeroEtape(etapes: Pick<PortfolioEtape, 'introduction'>[], i: number): number | null {
  if (etapes[i]?.introduction) return null;
  return etapes[0]?.introduction ? i : i + 1;
}

/** Le nombre d'étapes NUMÉROTÉES (l'introduction ne compte pas). */
export function nombreEtapes(etapes: Pick<PortfolioEtape, 'introduction'>[]): number {
  return etapes.filter((e) => !e.introduction).length;
}

/** L'adresse de l'image de couverture (route publique des ressources du prof). */
export function urlCouverture(id: string | null | undefined): string | null {
  return id ? `/api/ressources/image/${encodeURIComponent(id)}` : null;
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
  // Privé : absent des « Portfolios des professeurs » des collègues (absent =
  // partagé). Plan 2026-10-13-ressources-privees.
  prive?: boolean;
  archive: boolean;
  anneeScolaire: string;
  createdAt: string;
  updatedAt: string;
}

/** Ce que l'élève dépose — `Travail.content`, JSON. */
export interface PortfolioContenuEleve {
  type: 'portfolio';
  reponses: Record<string, string>; // `clePartie()` → texte, adresse…
  cochees: string[]; // étapes sans trace cochées à la main
  // La consigne d'une étape = une liste de tâches (2026-10-10) : les tâches
  // cochées, clé `cleTache(etapeId, cle de la ligne)` — la clé d'une ligne
  // est son TEXTE (`decouperConsignes`), jamais sa position
  taches?: string[];
  derniereEtape?: string; // là où l'élève en était
  // DÉRIVÉ, jamais stocké : le statut du groupe de l'élève (collection
  // `portfolioGroupes`), posé par le hook pour que `faite()` sache si un
  // dépôt « groupe » est rempli
  groupeStatut?: GroupeStatut | null;
  // DÉRIVÉ, jamais stocké dans la copie : soumissions, retours du prof et
  // valeurs attribuées du groupe (`portfolioSuivi`), posés par le hook
  suivi?: SuiviPortfolio | null;
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

/**
 * Un « groupe » d'un seul élève = l'élève a déclaré TRAVAILLER SEUL (JP,
 * 2026-10-11 : « même si une étape est collective, un élève peut être
 * seul »). Même circuit qu'un groupe : le prof accepte ou refuse (motif) ;
 * accepté, le dépôt est rempli et les étapes collectives restent les siennes.
 */
export function groupeSolo(g: Pick<GroupeVue, 'membres'>): boolean {
  return g.membres.length === 1;
}

export function generateGroupeId(): string {
  return `PFG-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Les étapes portent-elles un dépôt « groupe » ? (sinon, rien à charger) */
export function aUnDepotGroupe(etapes: { depots?: PortfolioDepot[] }[]): boolean {
  return etapes.some((e) => (e.depots ?? []).some((d) => typesDuDepot(d).includes('groupe')));
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

export function cleTache(etapeId: string, cleLigne: string): string {
  return `${etapeId}|${cleLigne}`;
}

export function cleChamp(etapeId: string, depotId: string): string {
  return `${etapeId}/${depotId}`;
}

/** Une étape propre sans aucun dépôt : rien à déposer, l'élève la coche lui-même. */
// ⚠ L'introduction EN EST UNE (aucun dépôt) : même mécanisme `cochees` — sauf
// que c'est l'ouverture qui la coche, pas l'élève (`usePortfolioEleve`).
export function estEtapeSansTrace(e: PortfolioEtape): boolean {
  return e.nature === 'etape' && !(e.depots && e.depots.length > 0);
}

export function nouvelleEtape(patch: Partial<PortfolioEtape> = {}): PortfolioEtape {
  return { id: generateEtapePortfolioId(), nature: 'etape', titre: '', ...patch };
}

export function nouveauDepot(types: TypeDepot[] = ['texte']): PortfolioDepot {
  return { id: generateDepotId(), libelle: '', types, obligatoire: true };
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

// Les images (public/ia-statut/) sont les pictogrammes de JP : leur couleur
// fait foi — vert = non-recours, jaune = aide, rouge = généré par l'IA.
// `image` = la scène seule (mini-icône : popup, badges) ; `carte` = la CARTE
// ENTIÈRE, cadre noir et texte compris (JP, 2026-10-11 : « elle porte le
// message ») — recadrée des originaux « N copie.png » du même dossier.
export const STATUT_IA_LABELS: Record<StatutIA, { court: string; long: string; image: string; carte: string }> = {
  libre: { court: 'Généré par l’IA', long: 'Les outils d’IA sont permis', image: '/ia-statut/libre.png', carte: '/ia-statut/libre-carte.png' },
  partielle: {
    court: 'Aide de l’IA',
    long: 'IA pour reformuler ou s’aider, pas pour produire à ta place',
    image: '/ia-statut/partielle.png',
    carte: '/ia-statut/partielle-carte.png',
  },
  aucune: { court: 'Non-recours à l’IA', long: 'Aucun outil d’IA dans cette étape', image: '/ia-statut/aucune.png', carte: '/ia-statut/aucune-carte.png' },
};

export const PORTEE_LABELS: Record<PorteeEtape, string> = {
  personnelle: 'Travail personnel',
  collective: 'Étape collective',
};

export const TYPE_DEPOT_LABELS: Record<TypeDepot, string> = {
  texte: 'Texte',
  lien: 'Lien',
  image: 'Image',
  tableau: 'Tableau',
  scene: 'Scène d’une œuvre',
  groupe: 'Groupe',
};
