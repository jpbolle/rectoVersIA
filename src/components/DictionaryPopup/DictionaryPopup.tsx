'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './DictionaryPopup.module.css';

// Popup de définition partagée (éditeur + panneau latéral).
// Position fixe par rapport à la fenêtre (portal), fermée au clic extérieur,
// à la touche Échap ou au défilement.

export interface DictionaryPopupProps {
  word: string;
  /** Coordonnées écran du clic (clientX / clientY) */
  x: number;
  y: number;
  loading: boolean;
  items: string[];
  error: string | null;
  onClose: () => void;
}

const POPUP_WIDTH = 300;

export default function DictionaryPopup({
  word,
  x,
  y,
  loading,
  items,
  error,
  onClose,
}: DictionaryPopupProps) {
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-dict-popup]')) return;
      onClose();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleScroll = () => onClose();
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    // capture : attrape le défilement de n'importe quel conteneur
    document.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  const left = Math.max(8, Math.min(x, window.innerWidth - POPUP_WIDTH - 16));
  const top = Math.max(8, Math.min(y + 14, window.innerHeight - 120));

  return createPortal(
    <div className={styles.popup} style={{ top, left }} data-dict-popup>
      <div className={styles.header}>
        <span className={styles.word}>{word}</span>
        <button type="button" className={styles.close} onClick={onClose} title="Fermer">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      {loading ? (
        <div className={styles.loading}>
          <span className={styles.spinner} />
          Recherche dans le dictionnaire…
        </div>
      ) : error ? (
        <p className={styles.empty}>{error}</p>
      ) : items.length === 0 ? (
        <p className={styles.empty}>
          Le dictionnaire ne connaît pas ce mot. Vérifie son orthographe !
        </p>
      ) : (
        <ol className={styles.list}>
          {items.slice(0, 4).map((def, i) => (
            <li key={i}>{def}</li>
          ))}
        </ol>
      )}
      <div className={styles.source}>Source : Wiktionnaire</div>
    </div>,
    document.body
  );
}
