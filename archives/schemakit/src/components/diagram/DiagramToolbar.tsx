'use client';

/**
 * Barre d'outils de l'éditeur : tout ce qui compte est un bouton visible.
 * Pas de clic droit, pas de molette obligatoire (Chromebook, pavé tactile).
 */
import type { ReactNode } from 'react';
import { Panel, useReactFlow } from '@xyflow/react';
import styles from './DiagramToolbar.module.css';

interface Props {
  onAdd: () => void;
  onDelete: () => void;
  canDelete: boolean;
  addLabel?: string;
  /** Boutons propres à un éditeur, placés après « Ajouter ». */
  extra?: ReactNode;
}

export function DiagramToolbar({ onAdd, onDelete, canDelete, addLabel = 'Ajouter un concept', extra }: Props) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  return (
    <Panel position="top-left" className={styles.bar}>
      <button type="button" className={`${styles.button} ${styles.primary}`} onClick={onAdd}>
        ＋ {addLabel}
      </button>
      {extra}
      <button type="button" className={styles.button} onClick={onDelete} disabled={!canDelete}>
        Supprimer
      </button>
      <span className={styles.separator} />
      <button type="button" className={styles.button} onClick={() => zoomOut({ duration: 150 })} title="Zoom arrière">
        −
      </button>
      <button type="button" className={styles.button} onClick={() => zoomIn({ duration: 150 })} title="Zoom avant">
        ＋
      </button>
      <button type="button" className={styles.button} onClick={() => fitView({ padding: 0.2, duration: 200 })}>
        Tout voir
      </button>
    </Panel>
  );
}
