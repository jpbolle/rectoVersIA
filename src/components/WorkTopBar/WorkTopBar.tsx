'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import UserAvatar from '@/components/UserAvatar';
import styles from './WorkTopBar.module.css';

interface WorkTopBarProps {
  title: string;
  status: 'draft' | 'submitted';
  isSaving: boolean;
  lastSaved: Date | null;
  onSubmit: () => void;
  isSubmitting?: boolean;
  isPreviewMode?: boolean;
  // Correction rendue (corrigé disponible, correction visible ou non rendu) :
  // la remise est fermée, le bouton « Remettre le devoir » disparaît
  submissionClosed?: boolean;
}

export default function WorkTopBar({
  title,
  status,
  isSaving,
  lastSaved,
  onSubmit,
  isSubmitting = false,
  isPreviewMode = false,
  submissionClosed = false,
}: WorkTopBarProps) {
  const router = useRouter();

  const handleBack = () => {
    // En mode preview, la fleche retourne a la liste des devoirs (vue eleve)
    // Pour les eleves, retourne au dashboard
    router.push(isPreviewMode ? '/activites' : '/dashboard');
  };

  const formatLastSaved = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);

    if (seconds < 60) {
      return 'à l\'instant';
    } else if (minutes < 60) {
      return `il y a ${minutes} min`;
    } else {
      return date.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });
    }
  };

  const isSubmitted = status === 'submitted';

  return (
    <header className={styles.container}>
      <div className={styles.left}>
        <Link href="/" className={styles.logoLink}>
          <img src="/logoRecto.png" alt="Recto-VersIA" className={styles.logoImg} />
        </Link>
        <button
          type="button"
          className={styles.backButton}
          onClick={handleBack}
          title={isPreviewMode ? "Retour a la liste" : "Retour au tableau de bord"}
        >
          ←
        </button>
        <h1 className={styles.title}>{title}</h1>
      </div>

      <div className={styles.right}>
        <div className={styles.status}>
          {isSubmitted ? (
            <span className={styles.statusSubmitted}>
              <span>✓</span>
              <span>Remis</span>
            </span>
          ) : submissionClosed ? (
            <span className={styles.statusDraft}>🔒 Remise clôturée</span>
          ) : isSaving ? (
            <span className={styles.statusSaving}>
              <span className={styles.savingDot} />
              <span>Sauvegarde...</span>
            </span>
          ) : lastSaved ? (
            <span className={styles.statusSaved}>
              <span>✓</span>
              <span>Sauvegarde {formatLastSaved(lastSaved)}</span>
            </span>
          ) : (
            <span className={styles.statusDraft}>Brouillon</span>
          )}
        </div>

        {!isSubmitted && !submissionClosed && (
          <button
            type="button"
            className={styles.submitButton}
            onClick={isPreviewMode ? undefined : onSubmit}
            disabled={isPreviewMode || isSubmitting || isSaving}
          >
            {isSubmitting ? 'Envoi...' : 'Remettre le devoir'}
          </button>
        )}
        
        <UserAvatar />
      </div>
    </header>
  );
}
