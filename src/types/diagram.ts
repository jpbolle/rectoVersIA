/**
 * Format de schéma de SchémaKit — LE NÔTRE, indépendant de React Flow.
 * C'est ce format qui est enregistré et exporté ; l'éditeur convertit à l'entrée
 * et à la sortie (voir src/lib/diagram-convert.ts).
 */

export type DiagramType = 'timeline' | 'mindmap' | 'hierarchy' | 'conceptmap' | 'libre';

/** Les types dans l'ordre où l'app les propose. */
export const DIAGRAM_TYPES: DiagramType[] = ['conceptmap', 'libre', 'mindmap', 'hierarchy', 'timeline'];

// ── Schéma LIBRE (ajout RectoVerso, 2026-10-04 — repris de la card « Schéma »
// de VibeCoding) : une carte conceptuelle où chaque boîte a une FORME et une
// TAILLE, et chaque flèche un tracé et un sens. C'est le « petit draw.io »
// demandé par JP ; il se transforme vers les autres types en passant par la
// carte conceptuelle (les formes sont alors oubliées).
export type ShapeKind = 'rect' | 'rounded' | 'ellipse' | 'diamond' | 'note' | 'text';
export const SHAPE_KINDS: { kind: ShapeKind; label: string; glyph: string }[] = [
  { kind: 'rounded', label: 'Boîte arrondie', glyph: '▢' },
  { kind: 'rect', label: 'Rectangle', glyph: '▭' },
  { kind: 'ellipse', label: 'Ellipse', glyph: '⬭' },
  { kind: 'diamond', label: 'Losange', glyph: '◇' },
  { kind: 'note', label: 'Note', glyph: '🗒' },
  { kind: 'text', label: 'Texte seul', glyph: 'T' },
];
export const DEFAULT_SHAPE: ShapeKind = 'rounded';
export type EdgePath = 'curve' | 'ortho' | 'straight';
export type EdgeArrow = 'end' | 'both' | 'none';

export type NodeColor = 'white' | 'yellow' | 'green' | 'blue' | 'pink' | 'orange';

/** Couleur de fond de chaque teinte (clair, lisible sur écran d'entrée de gamme). */
export const NODE_COLORS: Record<NodeColor, string> = {
  white: '#ffffff',
  yellow: '#fff3b0',
  green: '#d5efd3',
  blue: '#d6e6fb',
  pink: '#fadbe6',
  orange: '#ffe0c2',
};

/** Nom français de chaque teinte — utilisé dans le Markdown (`couleur:vert`). */
export const NODE_COLOR_NAMES: Record<NodeColor, string> = {
  white: 'blanc',
  yellow: 'jaune',
  green: 'vert',
  blue: 'bleu',
  pink: 'rose',
  orange: 'orange',
};

export const DEFAULT_NODE_COLOR: NodeColor = 'yellow';

/**
 * Une couleur est soit un nom de palette (`'green'`), soit un code libre (`'#a1b2c3'`)
 * choisi via le bouton « + » du sélecteur. Les palettes restent la voie normale.
 */
export type ColorRef = string;

/** Palette des traits et contours — plus foncée que les fonds, lisible en trait fin. */
export const STROKE_COLORS = {
  gray: '#8a857a',
  dark: '#2b2a26',
  green: '#2d6a5a',
  orange: '#d4944c',
  blue: '#3b6fb6',
  red: '#c0392b',
  purple: '#7b4fa6',
} as const;
export type StrokeColor = keyof typeof STROKE_COLORS;

export const STROKE_COLOR_NAMES: Record<StrokeColor, string> = {
  gray: 'gris',
  dark: 'noir',
  green: 'vert',
  orange: 'orange',
  blue: 'bleu',
  red: 'rouge',
  purple: 'violet',
};

const HEX = /^#[0-9a-f]{6}$/i;

export function isHexColor(ref: string | undefined): ref is string {
  return !!ref && HEX.test(ref);
}

/** Couleur de fond réelle d'une boîte. */
export function resolveFill(ref: ColorRef | undefined): string {
  if (ref && ref in NODE_COLORS) return NODE_COLORS[ref as NodeColor];
  if (isHexColor(ref)) return ref;
  return NODE_COLORS[DEFAULT_NODE_COLOR];
}

/** Couleur réelle d'un trait ou d'un contour. */
export function resolveStroke(ref: ColorRef | undefined): string {
  if (ref && ref in STROKE_COLORS) return STROKE_COLORS[ref as StrokeColor];
  if (isHexColor(ref)) return ref;
  return STROKE_COLORS.gray;
}

// ─── Styles ────────────────────────────────────────────────────────────────

export type LineWidth = 1 | 2 | 4;
export type LineDash = 'solid' | 'dashed' | 'dotted';

/** Style d'un trait (lien de carte conceptuelle, branche d'arbre). */
export interface LineStyle {
  width?: LineWidth;
  dash?: LineDash;
  color?: ColorRef;
}

export type BoxBorder = 'thin' | 'thick' | 'none';
export type BoxCorners = 'round' | 'square';

/** Style d'un encadré (la boîte d'un concept ou d'une idée). */
export interface BoxStyle {
  border?: BoxBorder;
  corners?: BoxCorners;
  borderColor?: ColorRef;
}

export const DEFAULT_LINE: Required<LineStyle> = { width: 2, dash: 'solid', color: 'gray' };
export const DEFAULT_BOX: Required<BoxStyle> = { border: 'thin', corners: 'round', borderColor: 'gray' };

/** Style effectif d'un trait : le sien, sinon les réglages du schéma, sinon les défauts. */
export function effectiveLine(own: LineStyle | undefined, diagram: Pick<Diagram, 'defaults'>): Required<LineStyle> {
  return { ...DEFAULT_LINE, ...diagram.defaults?.line, ...own };
}

export function effectiveBox(own: BoxStyle | undefined, diagram: Pick<Diagram, 'defaults'>): Required<BoxStyle> {
  return { ...DEFAULT_BOX, ...diagram.defaults?.box, ...own };
}

/** Tableau de tirets SVG pour un style de trait. */
export function dashArray(dash: LineDash, width: number): string | undefined {
  if (dash === 'dashed') return `${width * 4} ${width * 3}`;
  if (dash === 'dotted') return `${width} ${width * 2}`;
  return undefined;
}

export interface DiagramNode {
  id: string;
  label: string;
  x: number;
  y: number;
  color?: ColorRef; // fond de la boîte
  box?: BoxStyle; // contour et coins
  branch?: LineStyle; // arbres : le trait vers le parent
  // Spécifique à un type :
  date?: string; // timeline : "1815", "1815-06", "1815-06-18", "-52" (av. J.-C.)
  endDate?: string; // timeline : fin d'une période
  laneId?: string; // timeline : l'étage (absent = sur l'axe)
  parentId?: string; // mindmap / hierarchy : un seul parent
  shape?: ShapeKind; // libre : la forme de la boîte (absent = arrondie)
  width?: number; // libre : taille fixée par l'élève (absent = selon le texte)
  height?: number;
}

export interface DiagramEdge {
  id: string;
  source: string; // id du nœud de départ
  target: string; // id du nœud d'arrivée
  label?: string; // conceptmap : le mot de liaison
  line?: LineStyle;
  path?: EdgePath; // libre : courbe (défaut), coudé ou droit
  arrow?: EdgeArrow; // libre : pointe à l'arrivée (défaut), aux deux bouts, aucune
}

/** Un étage de ligne du temps : un bandeau au-dessus ou au-dessous de l'axe. */
export interface TimelineLane {
  id: string;
  label: string;
  side: 'above' | 'below';
  color?: ColorRef;
}

export interface Diagram {
  type: DiagramType;
  title: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  /** timeline : les étages, dans l'ordre (du plus proche de l'axe au plus éloigné). */
  lanes?: TimelineLane[];
  viewport?: { x: number; y: number; zoom: number };
  /** Réglages par défaut du schéma (ce que l'onglet Outils modifie sans sélection). */
  defaults?: { line?: LineStyle; box?: BoxStyle };
  /** Éléments à placer : ce qu'une transformation n'a pas su caser (tags déplaçables). */
  pending?: string[];
  /**
   * Positions mémorisées d'une forme précédente : quand une carte conceptuelle devient
   * un arbre, ses positions sont gardées ici pour être retrouvées au retour.
   */
  layouts?: { conceptmap?: Record<string, { x: number; y: number }> };
}

export const DIAGRAM_TYPE_LABELS: Record<DiagramType, string> = {
  timeline: 'Ligne du temps',
  mindmap: 'Carte mentale',
  hierarchy: 'Schéma hiérarchisé',
  conceptmap: 'Carte conceptuelle',
  libre: 'Schéma libre',
};

export function createEmptyDiagram(type: DiagramType, title = ''): Diagram {
  return { type, title, nodes: [], edges: [] };
}

/** Identifiant court et unique (suffisant côté client ; Firestore n'en dépend pas). */
export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
