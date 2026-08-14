// Configuration « Didactique du français » gérée par l'admin (page /admin) :
// UAA du programme et habiletés. Stockée dans le document Firestore
// configuration/didactique — accès via /api/didactique uniquement (routes
// serveur, pas de règle Firestore).
//
// Modèle : une HABILETÉ est l'unité de base. Elle appartient à un type modal
// (lire, écrire, parler, rechercher, réflexif), relève d'un GESTE général,
// s'exerce sur un OBJET (le genre travaillé : contraction de texte, CRC…) et
// vise une ou plusieurs UAA. Le geste n'est pas une entité séparée : c'est le
// libellé partagé par plusieurs habiletés, ce qui permet de le renommer d'un
// coup et de laisser un même geste exister dans deux types modaux.
//
// Source initiale : feuille « Ceintures et habiletés » du tableau de JP,
// importée par scripts/import-habiletes.ts (la colonne « objet » n'existe pas
// dans le tableau — elle se remplit dans /admin).
//
// Masquer (visible: false) retire l'élément des nouveaux formulaires sans
// casser l'affichage des contenus qui l'utilisent déjà — préférer masquer
// à supprimer quand l'élément a déjà servi.

import { UAA_LIST } from './grille';

export interface DidactiqueItem {
  id: string; // identifiant stable ("0".."6" pour les UAA)
  label: string;
  visible: boolean;
}

// Le MODE PRINCIPAL d'une activité : quelle compétence est en jeu.
// « Rechercher » n'en fait pas partie — chercher, c'est lire (le tableau source
// classe d'ailleurs tous les gestes de recherche en Lire ou Écrire). La
// recherche est un ATELIER, pas une modalité.
export type TypeModal = 'lire' | 'ecrire' | 'parler' | 'reflexif' | 'lexique' | 'savoirEtre';

// Le DISPOSITIF d'un atelier : la machinerie que l'app sait afficher.
// Correspond au champ historique devoir.typeTravail — d'où l'absence de
// migration. Liste fermée : un atelier sans dispositif serait une activité que
// l'app ne saurait pas ouvrir.
export type Dispositif = 'ecrire' | 'lire' | 'rechercher' | 'vocabulaire' | 'autoevaluation';

export interface Atelier {
  id: string;
  label: string; // « Atelier de recherche »
  court: string; // « Recherche » — pastilles des tableaux
  dispositif: Dispositif;
  // Mode principal proposé quand le prof choisit cet atelier. L'atelier de
  // recherche propose « lire » : chercher, c'est lire. Le prof peut changer.
  modeParDefaut: TypeModal;
}

export const ATELIERS: Atelier[] = [
  {
    id: 'ecriture',
    label: 'Atelier d’écriture',
    court: 'Écriture',
    dispositif: 'ecrire',
    modeParDefaut: 'ecrire',
  },
  {
    id: 'lecture',
    label: 'Atelier de lecture',
    court: 'Lecture',
    dispositif: 'lire',
    modeParDefaut: 'lire',
  },
  {
    id: 'recherche',
    label: 'Atelier de recherche',
    court: 'Recherche',
    dispositif: 'rechercher',
    modeParDefaut: 'lire',
  },
  {
    id: 'vocabulaire',
    label: 'Atelier de vocabulaire',
    court: 'Vocabulaire',
    dispositif: 'vocabulaire',
    modeParDefaut: 'lexique',
  },
  {
    // L'élève porte un regard sur son propre travail ou sur son attitude :
    // rien n'y est juste ou faux, donc pas de grille et pas de points. Le
    // mode principal est réflexif — c'est un geste sur soi.
    id: 'autoevaluation',
    label: 'Activité d’auto-évaluation',
    court: 'Auto-évaluation',
    dispositif: 'autoevaluation',
    modeParDefaut: 'reflexif',
  },
];

export function findAtelier(id: string | undefined): Atelier | undefined {
  return ATELIERS.find((a) => a.id === id);
}

// L'atelier correspondant à un dispositif — sert à retrouver l'atelier des
// activités créées avant l'existence du champ
export function atelierParDispositif(d: Dispositif): Atelier {
  return ATELIERS.find((a) => a.dispositif === d) ?? ATELIERS[0];
}

export const ATELIER_IDS = ATELIERS.map((a) => a.id);

export function atelierLabel(id: string, court = false): string {
  const a = ATELIERS.find((x) => x.id === id);
  return a ? (court ? a.court : a.label) : id;
}

export interface Habilete {
  id: string; // identifiant stable — repris du tableau source quand il existe
  type: TypeModal;
  geste: string; // geste général : « Identifier les idées essentielles »
  label: string; // habileté particulière : « Je suis capable de… »
  // Objets sur lesquels elle s'exerce (le genre travaillé : contraction de
  // texte, CRC…) — plusieurs possibles, vides à l'import
  objets: string[];
  // Ancien champ à valeur unique — conservé en lecture pour les documents
  // écrits avant le passage aux tags (normalisé par /api/didactique)
  objet?: string;
  uaa: string[]; // ids d'UAA visées (plusieurs possibles)
  ateliers: string[]; // ateliers où elle se travaille (plusieurs possibles)
  visible: boolean;
}

export interface DidactiqueConfig {
  uaa: DidactiqueItem[];
  habiletes: Habilete[];
  // Méthodes d'enseignement proposées aux modules d'une scénarisation
  // (cours explicite, atelier collaboratif…). Liste ouverte, tenue par l'admin.
  methodes: DidactiqueItem[];
}

// Méthodes livrées par défaut — l'admin en ajoute, en masque, en renomme
export const DEFAULT_METHODES: DidactiqueItem[] = [
  { id: 'cours-explicite', label: 'Cours explicite', visible: true },
  { id: 'cours-dialogique', label: 'Cours dialogique', visible: true },
  { id: 'atelier-autonomie', label: 'Atelier en autonomie', visible: true },
  { id: 'atelier-collaboratif', label: 'Atelier collaboratif', visible: true },
  { id: 'echanges', label: 'Échanges', visible: true },
  { id: 'jeu-de-role', label: 'Jeu de rôle', visible: true },
];

export const TYPES_MODAUX: { id: TypeModal; title: string; court: string }[] = [
  { id: 'lire', title: 'Gestes de lecture', court: 'Lire' },
  { id: 'ecrire', title: 'Gestes d’écriture', court: 'Écrire' },
  { id: 'parler', title: 'Gestes de parole', court: 'Parler' },
  { id: 'reflexif', title: 'Gestes réflexifs', court: 'Réfléchir' },
  { id: 'lexique', title: 'Gestes lexicaux', court: 'Lexique' },
  { id: 'savoirEtre', title: 'Gestes de savoir-être', court: 'Savoir-être' },
];

// ─── Gestes ───
//
// Un GESTE COGNITIF englobe des habiletés (cf. init.md § contexte métier) : il
// est le niveau macro — celui auquel on PLANIFIE un cours. Les habiletés en
// sont les déclinaisons évaluables, niveau auquel on NOTE une activité.
// D'où deux vocabulaires assumés : la scénarisation coche des gestes, la
// création d'activité coche des habiletés.

// Les familles de gestes qui relèvent du cognitif (par opposition au
// savoir-être et au réflexif, qui portent l'attitude et la métacognition)
export const TYPES_COGNITIFS: TypeModal[] = ['lire', 'ecrire', 'parler', 'lexique'];

// Les familles qui portent l'attitude : savoir-être et gestes méta
export const TYPES_SAVOIR_ETRE: TypeModal[] = ['reflexif', 'savoirEtre'];

// Gestes distincts des familles demandées, dédoublonnés et ordonnés.
// L'id d'un geste EST son libellé : le geste n'est pas une entité stockée,
// c'est le libellé partagé par plusieurs habiletés.
//
// Chaque geste porte sa FAMILLE (« Gestes de lecture »…) : les listes à cocher
// s'en servent pour montrer d'abord les grandes familles, puis les gestes de
// celle qu'on déplie — même logique que le sélecteur d'habiletés.
export function gestesDeTypes(
  config: DidactiqueConfig | null,
  types: TypeModal[]
): { id: string; label: string; groupe: string; type: TypeModal }[] {
  if (!config) return [];
  const vus = new Set<string>();
  const out: { id: string; label: string; groupe: string; type: TypeModal }[] = [];
  // On suit l'ordre des familles, pas celui du stockage : le menu doit se lire
  types.forEach((type) => {
    const famille = TYPES_MODAUX.find((t) => t.id === type)?.title ?? type;
    config.habiletes.forEach((h) => {
      if (!h.visible || h.type !== type) return;
      const geste = h.geste?.trim();
      if (!geste || vus.has(geste)) return;
      vus.add(geste);
      out.push({ id: geste, label: geste, groupe: famille, type });
    });
  });
  return out;
}

export const TYPE_MODAL_IDS: TypeModal[] = TYPES_MODAUX.map((t) => t.id);

export function isTypeModal(value: unknown): value is TypeModal {
  return typeof value === 'string' && (TYPE_MODAL_IDS as string[]).includes(value);
}

// Défauts servis tant que l'admin n'a rien enregistré. Les habiletés sont
// vides : elles arrivent par l'import du tableau source, pas par le code.
export const DEFAULT_DIDACTIQUE: DidactiqueConfig = {
  uaa: UAA_LIST.map((u) => ({ id: String(u.id), label: u.label, visible: true })),
  habiletes: [],
  methodes: DEFAULT_METHODES,
};

// Libellé d'une méthode — repli sur l'id pour les valeurs supprimées depuis
export function methodeLabel(config: DidactiqueConfig | null, id: string): string {
  return config?.methodes?.find((m) => m.id === id)?.label ?? id;
}

// Habiletés d'un type modal, dans l'ordre d'apparition
export function habiletesOfType(config: DidactiqueConfig, type: TypeModal): Habilete[] {
  return config.habiletes.filter((h) => h.type === type);
}

// Libellé d'affichage : l'habileté particulière, à défaut le geste
export function habileteLabel(h: Habilete): string {
  return h.label.trim() || h.geste;
}

// Objets d'une habileté, quel que soit le format stocké (tags ou ancien champ)
export function habileteObjets(h: Habilete): string[] {
  if (Array.isArray(h.objets) && h.objets.length) return h.objets;
  return h.objet?.trim() ? [h.objet.trim()] : [];
}

// L'atelier qui va de soi pour un mode principal : un geste de lecture se
// travaille en atelier de lecture. Parole et réflexif n'ont pas d'atelier
// propre — le prof rattache à la main.
export const ATELIER_PAR_MODE: Partial<Record<TypeModal, string>> = {
  lire: 'lecture',
  ecrire: 'ecriture',
  lexique: 'vocabulaire',
};

// Habiletés proposées à la création d'une activité, pour un atelier donné.
// Tant qu'aucune habileté n'a été rattachée à cet atelier dans /admin, on
// retombe sur celles du mode principal — sinon le prof n'aurait rien à cocher.
// `fallback` permet à l'interface de le dire au lieu de le faire en douce.
export function habiletesPourAtelier(
  config: DidactiqueConfig,
  atelier: string | undefined,
  mode: TypeModal | undefined
): { items: Habilete[]; fallback: boolean } {
  const visibles = config.habiletes.filter((h) => h.visible);
  // L'auto-évaluation ne travaille ni la lecture ni l'écriture : elle exerce
  // le savoir-être et la réflexivité. On les propose donc d'emblée, sans
  // attendre qu'un rattachement ait été fait dans /admin.
  if (atelier === 'autoevaluation') {
    const parAtelier = visibles.filter((h) => h.ateliers.includes(atelier));
    if (parAtelier.length) return { items: parAtelier, fallback: false };
    return {
      items: visibles.filter((h) => TYPES_SAVOIR_ETRE.includes(h.type)),
      fallback: false,
    };
  }
  if (atelier) {
    const parAtelier = visibles.filter((h) => h.ateliers.includes(atelier));
    if (parAtelier.length) return { items: parAtelier, fallback: false };
  }
  if (!mode) return { items: [], fallback: false };
  return { items: visibles.filter((h) => h.type === mode), fallback: true };
}
