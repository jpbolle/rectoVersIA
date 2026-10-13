// Diaporama — 6ᵉ outil des points de théorie FLE (plan 2026-10-13).
//
// Transposé de l'outil « Diaporama » de l'app VibeCoding (`SlidesCardView`) :
// une dia à la fois, projetable en plein écran. Une dia porte un titre et des
// BLOCS (texte en Markdown, image, lien, encadré), mis en page automatiquement ;
// ou bien c'est une DIA HTML : une page tierce (liste blanche) ou du code
// (administrateur seulement — même règle que l'onglet Interactif).
//
// Rangé dans `ressources.diaporama` du point de théorie (`modulesFle`). Les
// images sont des ADRESSES (`/api/ressources/upload`) : le document ne porte
// pas leurs données. Un seul diaporama par point de théorie (décision JP).

export type DiaBloc =
  | { id: string; kind: 'texte'; texte: string }
  /** Une forme à retenir : étiquette à gauche, valeur en gros à droite */
  | {
      id: string;
      kind: 'encadre';
      label: string;
      valeur: string;
      /** Largeur en % de la colonne de texte (20 à 100, défaut 100) */
      largeur?: number;
    }
  /** Un bouton qui ouvre la page dans un nouvel onglet */
  | { id: string; kind: 'lien'; label: string; url: string }
  | {
      id: string;
      kind: 'image';
      src: string;
      alt: string;
      /** Taille en % (20 à 200) ; au-delà de 100, la colonne des images s'élargit */
      taille?: number;
      /** Au clic : ouvrir un lien… */
      lien?: string;
      /** …ou afficher une fenêtre de texte (Markdown)… */
      fenetre?: { titre: string; corps: string };
      /** …ou agrandir l'image */
      agrandir?: boolean;
    };

export type DiaBlocImage = Extract<DiaBloc, { kind: 'image' }>;

export interface Dia {
  id: string;
  titre: string;
  blocs: DiaBloc[];
  /** Dia HTML : la page occupe tout le cadre. Absent = dia classique. */
  html?: {
    /** Page tierce — sur la liste blanche (`src/lib/integration.ts`) */
    url?: string;
    /** Code HTML/CSS/JS — administrateur seulement, bac à sable fermé */
    code?: string;
  };
  /** Zoom d'une dia HTML, en % (défaut 100) */
  zoom?: number;
  /** Dia HTML (code) : centrer le contenu dans la dia */
  centrer?: boolean;
}

export interface RessourceDiaporama {
  titre: string;
  dias: Dia[];
}

/** Plafond du diaporama entier (le document Firestore est limité à 1 Mo). */
export const TAILLE_MAX_DIAPORAMA = 700_000;

export const LIBELLE_BLOC: Record<DiaBloc['kind'], string> = {
  texte: 'Texte',
  encadre: 'Encadré',
  lien: 'Lien',
  image: 'Image',
};

export function idDia(): string {
  return `DIA-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Le diaporama a-t-il quelque chose à montrer ? */
export function diaporamaPresent(d: RessourceDiaporama | null | undefined): boolean {
  return !!d && Array.isArray(d.dias) && d.dias.length > 0;
}

/** Poids du diaporama tel qu'il sera rangé (approximation suffisante) */
export function tailleDiaporama(d: RessourceDiaporama | null | undefined): number {
  return d ? new Blob([JSON.stringify(d)]).size : 0;
}

/** Texte Markdown sans sa syntaxe : libellés de navigation, miniatures */
export function texteBrut(md: string): string {
  return md
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^[ \t]*(#{1,6}\s+|[-*+]\s+|\d+\.\s+|>\s?)/gm, '')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1');
}

/** Adresse sûre (http ou https seulement), sinon chaîne vide */
export function adresseWeb(url: string | undefined): string {
  try {
    const u = new URL((url ?? '').trim());
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : '';
  } catch {
    return '';
  }
}
