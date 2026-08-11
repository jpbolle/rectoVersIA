// Formes de tracé sur image (atelier élève) — coordonnées en % (0-100)
// de la taille de l'image, donc indépendantes de la résolution d'affichage.
// Porté du module drawing-tools de romantismesam (sans la face recto/verso).

export type DrawTool = 'select' | 'line' | 'pencil' | 'cross' | 'rect' | 'ellipse';

export type DrawPoint = { x: number; y: number };

export type DrawShape =
  | { id: string; kind: 'line'; a: DrawPoint; b: DrawPoint }
  | { id: string; kind: 'pencil'; points: DrawPoint[] }
  | { id: string; kind: 'cross'; center: DrawPoint; halfW: number; halfH: number }
  | { id: string; kind: 'rect'; x: number; y: number; w: number; h: number }
  // Ellipse : stockée comme bounding box (mêmes champs que rect)
  | { id: string; kind: 'ellipse'; x: number; y: number; w: number; h: number };

export function newShapeId(): string {
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// Couleurs par outil — lisibles sur une image, sans collision entre outils
export function colorForKind(kind: DrawShape['kind']): string {
  switch (kind) {
    case 'line':
      return '#b3432f';
    case 'pencil':
      return '#d97706';
    case 'cross':
      return '#a35c2e';
    case 'rect':
      return '#047857';
    case 'ellipse':
      return '#7c3aed';
  }
}
