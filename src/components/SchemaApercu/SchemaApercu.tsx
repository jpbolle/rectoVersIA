'use client';

// Un schéma en grand, pour le regarder seulement (loupe du corrigé, 2026-10-11).
// Posé dans <body> par un portail : le formulaire d'activité qui l'ouvre se
// retourne en 3D (transform), ce qui piégerait une couche `position: fixed`.

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DiagramWorkspace } from '@/components/Diagram/DiagramWorkspace';
import { DIAGRAM_TYPE_LABELS, type Diagram } from '@/types/diagram';
import styles from './SchemaApercu.module.css';

interface Props {
  diagram: Diagram;
  titre: string;
  onClose: () => void;
}

const rien = () => {};

export default function SchemaApercu({ diagram, titre, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.fenetre} role="dialog" aria-label={`Aperçu : ${titre}`}>
        <header className={styles.entete}>
          <h3>
            {titre} <span className={styles.type}>— {DIAGRAM_TYPE_LABELS[diagram.type]}</span>
          </h3>
          <button type="button" className={styles.fermer} onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </header>
        <div className={styles.cadre}>
          <DiagramWorkspace diagram={diagram} onChange={rien} readOnly embedded lockType />
        </div>
      </div>
    </div>,
    document.body
  );
}
