'use client';

import type { Grille } from '@/types/grille';
import styles from './GrilleCard.module.css';

interface GrilleCardProps {
  grille: Grille;
  onEdit: (grille: Grille) => void;
  onDelete: (grille: Grille) => void;
  onDuplicate: (grille: Grille) => void;
}

export default function GrilleCard({ grille, onEdit, onDelete, onDuplicate }: GrilleCardProps) {
  const totalWeight = grille.criteria.reduce((sum, c) => sum + c.weight, 0);

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(grille);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(grille);
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

      <button
        className={styles.editButton}
        onClick={handleEdit}
        title="Modifier la grille"
      >
        ✏️
      </button>

      <button
        className={styles.duplicateButton}
        onClick={handleDuplicate}
        title="Dupliquer la grille"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="4" y="1" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
          <rect x="1" y="4" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" fill="white"/>
        </svg>
      </button>

      <button
        className={styles.deleteButton}
        onClick={handleDelete}
        title="Supprimer la grille"
      >
        🗑️
      </button>
    </article>
  );
}
