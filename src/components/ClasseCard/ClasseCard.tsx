'use client';

import { useState } from 'react';
import Toggle from '@/components/Toggle/Toggle';
import { estClasseFle } from '@/types/classe';
import type { Classe } from '@/types/classe';
import styles from './ClasseCard.module.css';

interface ClasseCardProps {
  classe: Classe;
  onEdit?: (classe: Classe) => void;
  onDelete?: (classe: Classe) => void;
  onToggleArchive?: (id: string, archive: boolean) => void;
  // Titulaire : partager la classe avec un coprofesseur (2026-10-04)
  onPartager?: (classe: Classe) => void;
  onClick?: () => void;
}

export default function ClasseCard({
  classe,
  onEdit,
  onDelete,
  onToggleArchive,
  onPartager,
  onClick,
}: ClasseCardProps) {
  // Classe d'un collègue : ni code, ni archivage, ni modification — on y entre
  const partageeAvecMoi = !!classe.monAcces && classe.monAcces !== 'titulaire';
  const nbCoprofs = classe.partages?.length ?? 0;
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
    onToggleArchive?.(classe.id, value);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(classe);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(classe);
  };

  const handlePartager = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPartager?.(classe);
  };

  const handleCardClick = () => {
    if (onClick) {
      onClick();
    }
  };

  return (
    <article
      className={`${styles.card} ${styles.cardClickable} ${estClasseFle(classe) ? styles.cardFle : ''}`}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleCardClick()}
    >
      <h3 className={styles.title}>
        {classe.nom}
        {/* Une classe FLE se reconnaît d'un coup d'œil dans la grille */}
        {estClasseFle(classe) && <span className={styles.typeBadge}>FLE</span>}
      </h3>

      {partageeAvecMoi && (
        <p className={styles.coprof}>
          Classe de <strong>{classe.titulaireNom || 'un collègue'}</strong>
          <span className={styles.coprofMode}>
            {classe.monAcces === 'edition' ? 'Écriture' : 'Lecture'}
          </span>
        </p>
      )}

      {!partageeAvecMoi && classe.code && (
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

      {!partageeAvecMoi && (
        <>
          <div className={styles.togglesSection} onClick={(e) => e.stopPropagation()}>
            <Toggle
              checked={classe.archive}
              onChange={handleToggleArchive}
              labelOn="Archivé"
              labelOff="Archiver"
            />
          </div>

          {onPartager && (
            <button
              className={`${styles.shareButton} ${nbCoprofs > 0 ? styles.shareButtonActif : ''}`}
              onClick={handlePartager}
              title={
                nbCoprofs > 0
                  ? `Partagée avec ${nbCoprofs} coprofesseur${nbCoprofs > 1 ? 's' : ''}`
                  : 'Partager avec un coprofesseur'
              }
            >
              👥{nbCoprofs > 0 && <span className={styles.shareCount}>{nbCoprofs}</span>}
            </button>
          )}

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
        </>
      )}
    </article>
  );
}
