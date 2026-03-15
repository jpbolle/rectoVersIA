'use client';

import type { Grille } from '@/types/grille';
import styles from './GrilleCard.module.css';

interface GrilleCardProps {
  grille: Grille;
  onEdit?: (grille: Grille) => void;
  onDelete?: (grille: Grille) => void;
  onDuplicate: (grille: Grille) => void;
  onToggleShared?: (grille: Grille) => void;
  onView?: (grille: Grille) => void;
  readOnly?: boolean;
  isAdmin?: boolean;
}

export default function GrilleCard({ grille, onEdit, onDelete, onDuplicate, onToggleShared, onView, readOnly, isAdmin }: GrilleCardProps) {
  const totalWeight = grille.criteria.reduce((sum, c) => sum + c.weight, 0);

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(grille);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(grille);
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDuplicate(grille);
  };

  return (
    <article className={styles.card}>
      {grille.uaa && grille.uaa.length > 0 && (
        <div className={styles.uaaTags}>
          {grille.uaa.map((id) => (
            <span key={id} className={styles.uaaTag}>UAA {id}</span>
          ))}
        </div>
      )}
      <div className={styles.cardIcon}>📋</div>
      <h3 className={styles.title}>{grille.name}</h3>

      {grille.description && (
        <p className={styles.description}>{grille.description}</p>
      )}

      {grille.profName && readOnly && (
        <p className={styles.profName}>{grille.profName}</p>
      )}

      <div className={styles.metaRow}>
        <span className={styles.metaItem}>
          <span className={styles.metaIcon}>📊</span>
          <span>{grille.criteria.length} critère{grille.criteria.length > 1 ? 's' : ''}</span>
        </span>
        <span className={styles.metaItem}>
          <span className={styles.metaIcon}>⚖️</span>
          <span>{totalWeight} pts</span>
        </span>
      </div>

      {!readOnly && isAdmin && onToggleShared && (
        <button
          className={`${styles.shareButton} ${grille.shared ? styles.shareActive : ''}`}
          onClick={(e) => { e.stopPropagation(); onToggleShared(grille); }}
          title={grille.shared ? 'Retirer des exemples' : 'Partager comme exemple'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}

      {!readOnly && onEdit && (
        <button
          className={styles.editButton}
          onClick={handleEdit}
          title="Modifier la grille"
        >
          ✏️
        </button>
      )}

      {readOnly && onView && (
        <button
          className={styles.viewButton}
          onClick={(e) => { e.stopPropagation(); onView(grille); }}
          title="Voir la grille"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
          </svg>
        </button>
      )}

      <button
        className={styles.duplicateButton}
        onClick={handleDuplicate}
        title={readOnly ? 'Dupliquer dans mes grilles' : 'Dupliquer la grille'}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="4" y="1" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
          <rect x="1" y="4" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" fill="white"/>
        </svg>
      </button>

      {!readOnly && onDelete && (
        <button
          className={styles.deleteButton}
          onClick={handleDelete}
          title="Supprimer la grille"
        >
          🗑️
        </button>
      )}
    </article>
  );
}
