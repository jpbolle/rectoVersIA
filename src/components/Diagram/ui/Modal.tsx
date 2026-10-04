'use client';

/**
 * Popup de l'application (jamais `confirm()` / `prompt()` — consigne durable) :
 * centrée, sur fond assombri, avec en-tête et pied d'actions.
 */
import { useEffect, type ReactNode } from 'react';
import styles from './Modal.module.css';

interface Props {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  actions: ReactNode;
}

export function Modal({ title, open, onClose, children, actions }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>{title}</header>
        <div className={styles.body}>{children}</div>
        <footer className={styles.footer}>{actions}</footer>
      </div>
    </div>
  );
}
