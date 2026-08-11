'use client';

import { useRouter } from 'next/navigation';
import Toggle from '@/components/Toggle/Toggle';
import { formatDateShort } from '@/lib/devoir-utils';
import type { Devoir } from '@/types/devoir';
import styles from './DevoirCard.module.css';

interface DevoirCardProps {
  devoir: Devoir;
  variant: 'prof' | 'student';
  onEdit?: (devoir: Devoir) => void;
  onDelete?: (devoir: Devoir) => void;
  onDuplicate?: (devoir: Devoir) => void;
  onToggleDisponible?: (id: string, disponible: boolean) => void;
  onToggleArchive?: (id: string, archive: boolean) => void;
  onToggleCorrige?: (id: string, corrige: boolean) => void;
  onToggleCorrigeDisponible?: (id: string, corrigeDisponible: boolean) => void;
}

export default function DevoirCard({
  devoir,
  variant,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleDisponible,
  onToggleArchive,
  onToggleCorrige,
  onToggleCorrigeDisponible,
}: DevoirCardProps) {
  const router = useRouter();

  const handleToggleDisponible = (value: boolean) => {
    onToggleDisponible?.(devoir.id, value);
  };

  const handleToggleArchive = (value: boolean) => {
    onToggleArchive?.(devoir.id, value);
  };

  const handleToggleCorrige = (value: boolean) => {
    onToggleCorrige?.(devoir.id, value);
  };

  const handleToggleCorrigeDisponible = (value: boolean) => {
    onToggleCorrigeDisponible?.(devoir.id, value);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(devoir);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(devoir);
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDuplicate?.(devoir);
  };

  const handleCardClick = () => {
    if (variant === 'student') {
      router.push(`/activites/${devoir.id}`);
    } else if (variant === 'prof') {
      router.push(`/dashboard/travaux/${devoir.id}`);
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
      <h3 className={styles.title}>{devoir.intitule}</h3>

      {(devoir.evaluation ||
        devoir.typeTravail === 'vocabulaire' ||
        (devoir.uaa && devoir.uaa.length > 0)) && (
        <div className={styles.uaaTags}>
          {devoir.typeTravail === 'vocabulaire' ? (
            <span className={styles.uaaTag}>Voc</span>
          ) : (
            devoir.uaa?.map((n) => (
              <span key={n} className={styles.uaaTag}>UAA {n}</span>
            ))
          )}
          {devoir.evaluation && (
            <span
              className={
                devoir.evaluation === 'certificatif'
                  ? styles.evalTagCertificatif
                  : styles.evalTagFormatif
              }
            >
              {devoir.evaluation === 'certificatif' ? 'Certificatif' : 'Formatif'}
            </span>
          )}
        </div>
      )}

      <div className={styles.metaRow}>
        <span className={styles.metaItem}>
          <span className={styles.metaIcon}>📚</span>
          <span>{devoir.grille}</span>
        </span>
        <span className={styles.metaItem}>
          <span className={styles.metaIcon}>📅</span>
          <span>{formatDateShort(devoir.dateRemise)}</span>
        </span>
        <span className={styles.metaItem}>
          <span className={styles.metaIcon}>🎓</span>
          <span>{devoir.classes.join(', ')}</span>
        </span>
        {variant === 'prof' && devoir.submittedCount !== undefined && (
          <span className={styles.metaItem}>
            <span className={styles.metaIcon}>📥</span>
            <span>
              {devoir.submittedCount} {devoir.submittedCount > 1 ? 'copies remises' : 'copie remise'}
            </span>
          </span>
        )}
      </div>

      {variant === 'prof' && (
        <div className={styles.togglesSection} onClick={(e) => e.stopPropagation()}>
          <div className={styles.toggleRow}>
            <Toggle
              checked={devoir.disponible}
              onChange={handleToggleDisponible}
              labelOn="Travail disponible"
              labelOff="Travail non disponible"
            />
            <Toggle
              checked={devoir.corrigeDisponible}
              onChange={handleToggleCorrigeDisponible}
              labelOn="Corrigé disponible"
              labelOff="Corrigé non disponible"
            />
          </div>
          <div className={styles.toggleRow}>
            <Toggle
              checked={devoir.archive}
              onChange={handleToggleArchive}
              labelOn="Archivé"
              labelOff="Archiver le travail"
            />
            <Toggle
              checked={devoir.corrige}
              onChange={handleToggleCorrige}
              labelOn="Travail classé"
              labelOff="Classer le travail corrigé"
            />
          </div>
        </div>
      )}

      {variant === 'student' && (
        <div className={styles.statusWrapper}>
          {devoir.corrigeDisponible ? (
            <span className={`${styles.statusBadge} ${styles.statusBadgeCorrige}`}>Corrigé disponible</span>
          ) : (
            <span className={styles.statusBadge}>À réaliser</span>
          )}
        </div>
      )}

      {variant === 'prof' && devoir.accesIA && (
        <div className={styles.iaBadge}>
          <span>🤖</span>
          <span>IA active</span>
        </div>
      )}

      {variant === 'prof' && (
        <button
          className={styles.editButton}
          onClick={handleEdit}
          title="Modifier le devoir"
        >
          ✏️
        </button>
      )}

      {variant === 'prof' && (
        <button
          className={styles.duplicateButton}
          onClick={handleDuplicate}
          title="Dupliquer le devoir"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="1" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            <rect x="1" y="4" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" fill="white"/>
          </svg>
        </button>
      )}

      {variant === 'prof' && (
        <button
          className={styles.deleteButton}
          onClick={handleDelete}
          title="Supprimer le devoir"
        >
          🗑️
        </button>
      )}
    </article>
  );
}
