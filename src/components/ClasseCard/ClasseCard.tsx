'use client';

import { useState } from 'react';
import Toggle from '@/components/Toggle/Toggle';
import type { Classe } from '@/types/classe';
import styles from './ClasseCard.module.css';

interface ClasseCardProps {
  classe: Classe;
  onEdit: (classe: Classe) => void;
  onDelete: (classe: Classe) => void;
  onToggleArchive: (id: string, archive: boolean) => void;
  onClick?: () => void;
}

export default function ClasseCard({
  classe,
  onEdit,
  onDelete,
  onToggleArchive,
  onClick,
}: ClasseCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (classe.code) {
      navigator.clipboard.writeText(classe.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleToggleArchive = (value: boolean) => {
    onToggleArchive(classe.id, value);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(classe);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(classe);
  };

  const handleCardClick = () => {
    if (onClick) {
      onClick();
    }
  };

  return (
    <article
      className={`${styles.card} ${styles.cardClickable}`}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleCardClick()}
    >
      <h3 className={styles.title}>{classe.nom}</h3>

      {classe.code && (
        <div className={styles.codeRow} onClick={(e) => e.stopPropagation()}>
          <span className={styles.codeBadge}>{classe.code}</span>
          <button className={styles.copyBtn} onClick={handleCopyCode} title="Copier le code">
            {copied ? '✅' : '📋'}
          </button>
        </div>
      )}

      {classe.description && (
        <p className={styles.description}>{classe.description}</p>
      )}

      <div className={styles.metaRow}>
        <span className={styles.metaItem}>
          <span className={styles.metaIcon}>📅</span>
          <span>{classe.anneeScolaire}</span>
        </span>
      </div>

      <div className={styles.togglesSection} onClick={(e) => e.stopPropagation()}>
        <Toggle
          checked={classe.archive}
          onChange={handleToggleArchive}
          labelOn="Archivé"
          labelOff="Archiver"
        />
      </div>

      <button
        className={styles.editButton}
        onClick={handleEdit}
        title="Modifier la classe"
      >
        ✏️
      </button>

      <button
        className={styles.deleteButton}
        onClick={handleDelete}
        title="Supprimer la classe"
      >
        🗑️
      </button>
    </article>
  );
}
