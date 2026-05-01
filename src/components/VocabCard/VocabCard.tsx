'use client';

import type { VocabulaireThemeSummary } from '@/hooks/useVocabulaireThemes';
import styles from './VocabCard.module.css';

interface VocabCardProps {
  theme: VocabulaireThemeSummary;
  onEdit?: (theme: VocabulaireThemeSummary) => void;
  onDelete?: (theme: VocabulaireThemeSummary) => void;
  onDuplicate: (theme: VocabulaireThemeSummary) => void;
  onView?: (theme: VocabulaireThemeSummary) => void;
  readOnly?: boolean;
}

export default function VocabCard({ theme, onEdit, onDelete, onDuplicate, onView, readOnly }: VocabCardProps) {
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(theme);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(theme);
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDuplicate(theme);
  };

  return (
    <article className={styles.card}>
      <div className={styles.cardIcon}>📝</div>
      <h3 className={styles.title}>
        {theme.name.charAt(0).toUpperCase() + theme.name.slice(1)}
      </h3>

      {theme.profName && readOnly && (
        <p className={styles.profName}>{theme.profName}</p>
      )}

      <div className={styles.metaRow}>
        <span className={styles.metaItem}>
          <span className={styles.metaIcon}>📚</span>
          <span>{theme.wordCount} mot{theme.wordCount > 1 ? 's' : ''}</span>
        </span>
      </div>

      {readOnly && onView && (
        <button
          className={styles.viewButton}
          onClick={(e) => { e.stopPropagation(); onView(theme); }}
          title="Voir la liste"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
          </svg>
        </button>
      )}

      {!readOnly && onEdit && (
        <button
          className={styles.editButton}
          onClick={handleEdit}
          title="Modifier la liste"
        >
          ✏️
        </button>
      )}

      <button
        className={styles.duplicateButton}
        onClick={handleDuplicate}
        title={readOnly ? 'Dupliquer dans mes listes' : 'Dupliquer la liste'}
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
          title="Supprimer la liste"
        >
          🗑️
        </button>
      )}
    </article>
  );
}
