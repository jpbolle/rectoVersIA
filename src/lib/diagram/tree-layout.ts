/**
 * Disposition automatique des arbres — écrite à la main, sans dépendance.
 * - `hierarchy` : de haut en bas (organigramme), chaque parent centré sur ses enfants.
 * - `mindmap`   : racine au centre, première moitié des branches à droite, seconde à gauche.
 * Les tailles réelles viennent de React Flow ; `estimateSize` sert avant la mesure et
 * pour les transformations hors écran.
 */
import type { Diagram, DiagramNode } from '@/types/diagram';
import { ROOT_KEY, childrenMap, rootOf } from './tree';

export interface Size {
  width: number;
  height: number;
}

export type Side = 'right' | 'left' | 'down';

export interface Placement {
  x: number;
  y: number;
  side: Side;
}

const GAP_SIBLING = 20; // entre deux frères
const GAP_LEVEL = 56; // entre un parent et ses enfants

const NODE_MIN_WIDTH = 120;
const NODE_MAX_WIDTH = 240;
const CHAR_WIDTH = 8.2; // approximation pour 15px system-ui
const LINE_HEIGHT = 20;
const PADDING_X = 32;
const PADDING_Y = 20;

/** Taille approximative d'une boîte pour un texte donné (avant mesure réelle). */
export function estimateSize(label: string): Size {
  const text = Math.max(1, label.length) * CHAR_WIDTH + PADDING_X;
  const width = Math.min(NODE_MAX_WIDTH, Math.max(NODE_MIN_WIDTH, text));
  const lines = Math.max(1, Math.ceil(text / NODE_MAX_WIDTH));
  return { width: Math.round(width), height: LINE_HEIGHT * lines + PADDING_Y };
}

export function layoutTree(diagram: Diagram, sizeOf: (node: DiagramNode) => Size): Map<string, Placement> {
  const root = rootOf(diagram.nodes);
  const result = new Map<string, Placement>();
  if (!root) return result;
  const children = childrenMap(diagram.nodes);
  if (diagram.type === 'mindmap') layoutMindMap(root, children, sizeOf, result);
  else layoutHierarchy(root, children, sizeOf, result);
  return result;
}

// ─── Organigramme : frères côte à côte (axe x), niveaux vers le bas (axe y) ──

function layoutHierarchy(
  root: DiagramNode,
  children: Map<string, DiagramNode[]>,
  sizeOf: (n: DiagramNode) => Size,
  out: Map<string, Placement>,
) {
  const widths = new Map<string, number>();
  const subtreeWidth = (n: DiagramNode): number => {
    const kids = children.get(n.id) ?? [];
    const own = sizeOf(n).width;
    const total = kids.reduce((sum, k) => sum + subtreeWidth(k), 0) + Math.max(0, kids.length - 1) * GAP_SIBLING;
    const w = Math.max(own, total);
    widths.set(n.id, w);
    return w;
  };
  subtreeWidth(root);

  // Hauteur de chaque niveau = la boîte la plus haute du niveau.
  const levelHeight: number[] = [];
  const measure = (n: DiagramNode, depth: number) => {
    levelHeight[depth] = Math.max(levelHeight[depth] ?? 0, sizeOf(n).height);
    for (const k of children.get(n.id) ?? []) measure(k, depth + 1);
  };
  measure(root, 0);
  const levelY: number[] = [];
  levelHeight.forEach((h, i) => {
    levelY[i] = i === 0 ? 0 : levelY[i - 1] + levelHeight[i - 1] + GAP_LEVEL;
  });

  const place = (n: DiagramNode, left: number, depth: number) => {
    const w = widths.get(n.id)!;
    const size = sizeOf(n);
    out.set(n.id, { x: left + (w - size.width) / 2, y: levelY[depth], side: 'down' });
    const kids = children.get(n.id) ?? [];
    const total = kids.reduce((sum, k) => sum + widths.get(k.id)!, 0) + Math.max(0, kids.length - 1) * GAP_SIBLING;
    let cursor = left + (w - total) / 2;
    for (const k of kids) {
      place(k, cursor, depth + 1);
      cursor += widths.get(k.id)! + GAP_SIBLING;
    }
  };
  place(root, 0, 0);
}

// ─── Carte mentale : frères empilés (axe y), niveaux vers l'extérieur (axe x) ─

function layoutMindMap(
  root: DiagramNode,
  children: Map<string, DiagramNode[]>,
  sizeOf: (n: DiagramNode) => Size,
  out: Map<string, Placement>,
) {
  const heights = new Map<string, number>();
  const subtreeHeight = (n: DiagramNode): number => {
    const kids = children.get(n.id) ?? [];
    const own = sizeOf(n).height;
    const total = kids.reduce((sum, k) => sum + subtreeHeight(k), 0) + Math.max(0, kids.length - 1) * GAP_SIBLING;
    const h = Math.max(own, total);
    heights.set(n.id, h);
    return h;
  };
  const rootKids = children.get(root.id) ?? [];
  rootKids.forEach(subtreeHeight);
  const rootSize = sizeOf(root);

  // Première moitié à droite, seconde à gauche.
  const half = Math.ceil(rootKids.length / 2);
  const sides: [DiagramNode[], Side][] = [
    [rootKids.slice(0, half), 'right'],
    [rootKids.slice(half), 'left'],
  ];

  const place = (n: DiagramNode, edgeX: number, top: number, side: Side) => {
    const h = heights.get(n.id)!;
    const size = sizeOf(n);
    // edgeX = bord de la boîte côté parent (gauche si à droite de la racine, et inversement).
    const x = side === 'right' ? edgeX : edgeX - size.width;
    out.set(n.id, { x, y: top + (h - size.height) / 2, side });
    const kids = children.get(n.id) ?? [];
    const total = kids.reduce((sum, k) => sum + heights.get(k.id)!, 0) + Math.max(0, kids.length - 1) * GAP_SIBLING;
    let cursor = top + (h - total) / 2;
    const nextEdge = side === 'right' ? x + size.width + GAP_LEVEL : x - GAP_LEVEL;
    for (const k of kids) {
      place(k, nextEdge, cursor, side);
      cursor += heights.get(k.id)! + GAP_SIBLING;
    }
  };

  const rootCenterY = 0;
  out.set(root.id, { x: 0, y: rootCenterY - rootSize.height / 2, side: 'down' });
  for (const [kids, side] of sides) {
    const total = kids.reduce((sum, k) => sum + heights.get(k.id)!, 0) + Math.max(0, kids.length - 1) * GAP_SIBLING;
    let cursor = rootCenterY - total / 2;
    const edgeX = side === 'right' ? rootSize.width + GAP_LEVEL : -GAP_LEVEL;
    for (const k of kids) {
      place(k, edgeX, cursor, side);
      cursor += heights.get(k.id)! + GAP_SIBLING;
    }
  }
}

export { ROOT_KEY };
