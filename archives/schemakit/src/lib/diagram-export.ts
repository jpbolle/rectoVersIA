/**
 * Export du schéma en image. Doit s'exécuter DANS un éditeur React Flow (accès aux
 * nœuds mesurés et au viewport) : chaque éditeur expose ces fonctions via `exportRef`.
 * PNG : `html-to-image` (dépendance acceptée par JP le 2026-09-13).
 * PDF : on ouvre l'image dans une fenêtre d'impression — le navigateur (Chromebook
 * compris) sait « Enregistrer en PDF » ; aucune bibliothèque.
 */
import { toPng } from 'html-to-image';
import { getNodesBounds, getViewportForBounds, type Node } from '@xyflow/react';

export interface DiagramExportHandle {
  /** Image PNG (data URL) du schéma entier, indépendante du zoom à l'écran. */
  toPng: (options?: { maxWidth?: number; pixelRatio?: number }) => Promise<string>;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function renderDiagramPng(
  container: HTMLElement,
  nodes: Node[],
  options: { maxWidth?: number; pixelRatio?: number } = {},
  /** Zone à inclure en plus des boîtes (axe et étages d'une ligne du temps). */
  extra?: Rect,
): Promise<string> {
  const viewportEl = container.querySelector<HTMLElement>('.react-flow__viewport');
  if (!viewportEl || (nodes.length === 0 && !extra)) throw new Error('Rien à exporter.');
  const padding = 40;
  const nodeBounds = nodes.length ? getNodesBounds(nodes) : extra!;
  const bounds = extra ? union(nodeBounds, extra) : nodeBounds;
  const maxWidth = options.maxWidth ?? 2000;
  const scale = Math.min(1, maxWidth / (bounds.width + padding * 2));
  const width = Math.ceil((bounds.width + padding * 2) * scale);
  const height = Math.ceil((bounds.height + padding * 2) * scale);
  const viewport = getViewportForBounds(bounds, width, height, scale, scale, 0);
  const canvasColor = getComputedStyle(container).backgroundColor || '#ffffff';
  return toPng(viewportEl, {
    backgroundColor: canvasColor,
    width,
    height,
    pixelRatio: options.pixelRatio ?? 2,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${viewport.x + padding * scale}px, ${viewport.y + padding * scale}px) scale(${viewport.zoom})`,
    },
    // Les barres d'outils flottantes ne font pas partie du schéma.
    filter: (el) => !(el instanceof HTMLElement && el.classList.contains('react-flow__node-toolbar')),
  });
}

function union(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y };
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Ouvre l'image dans une fenêtre et lance l'impression (→ « Enregistrer en PDF »). */
export function printDataUrl(dataUrl: string, title: string): boolean {
  const w = window.open('', '_blank');
  if (!w) return false;
  const safeTitle = title.replace(/[<>&]/g, '');
  w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${safeTitle}</title>
<style>
  @page { margin: 12mm; }
  body { margin: 0; display: flex; flex-direction: column; align-items: center; font-family: system-ui, sans-serif; color: #2b2a26; }
  h1 { font-size: 16pt; margin: 0 0 8mm; }
  img { max-width: 100%; max-height: 85vh; }
</style></head><body><h1>${safeTitle}</h1><img src="${dataUrl}" alt="" onload="setTimeout(function(){window.print();},100)"></body></html>`);
  w.document.close();
  return true;
}

/** Nom de fichier sûr à partir d'un titre. */
export function safeFilename(title: string, ext: string): string {
  const base = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `${base || 'schema'}.${ext}`;
}
