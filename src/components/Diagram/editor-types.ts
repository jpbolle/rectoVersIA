/** Ce que les deux éditeurs (carte conceptuelle, arbre) ont en commun vis-à-vis de la page. */
import type { RefObject } from 'react';
import type { DiagramExportHandle } from '@/lib/diagram/diagram-export';

export interface EditorSelection {
  nodeIds: string[];
  edgeIds: string[];
}

export const EMPTY_SELECTION: EditorSelection = { nodeIds: [], edgeIds: [] };

export interface EditorCommonProps {
  /** Fond quadrillé affiché ou non (préférence d'affichage). */
  grid: boolean;
  /** Lecture seule : vue prof, travail remis. */
  readOnly?: boolean;
  onSelectionChange?: (selection: EditorSelection) => void;
  /** Bouton « Outils… » des barres flottantes : ouvre l'onglet Outils du volet du bas. */
  onOpenTools?: () => void;
  /** L'éditeur y dépose ses fonctions d'export (PNG) une fois monté. */
  exportRef?: RefObject<DiagramExportHandle | null>;
}
