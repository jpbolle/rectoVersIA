'use client';

import type { NavigKidResume } from '@/types/navigkid';
import styles from './RechercheResume.module.css';

interface RechercheResumeProps {
  resume: NavigKidResume;
  soumisLe?: string;
  /** Le détail (bonne/mauvaise réponse question par question) n'est visible
      qu'une fois le corrigé rendu disponible par le professeur */
  corrigeDisponible?: boolean;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fr-BE', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function RechercheResume({
  resume,
  soumisLe,
  corrigeDisponible = false,
}: RechercheResumeProps) {
  const dateStr = soumisLe ? formatDate(soumisLe) : '';
  const autoCorrigees = resume.correctes + resume.erreurs;

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Tes réponses ont bien été envoyées</h3>
      {dateStr && <p className={styles.date}>Envoyées le {dateStr}</p>}

      <div className={styles.stats}>
        <div className={`${styles.stat} ${styles.correctes}`}>
          <span className={styles.statValue}>{resume.correctes}</span>
          <span className={styles.statLabel}>
            {resume.correctes > 1 ? 'bonnes réponses' : 'bonne réponse'}
          </span>
        </div>
        <div className={`${styles.stat} ${styles.erreurs}`}>
          <span className={styles.statValue}>{resume.erreurs}</span>
          <span className={styles.statLabel}>
            {resume.erreurs > 1 ? 'erreurs' : 'erreur'}
          </span>
        </div>
        <div className={`${styles.stat} ${styles.attente}`}>
          <span className={styles.statValue}>{resume.aCorrigerParProf}</span>
          <span className={styles.statLabel}>
            à corriger par ton professeur
          </span>
        </div>
      </div>

      <p className={styles.note}>
        {autoCorrigees > 0 && !corrigeDisponible && (
          <>
            Le détail question par question s&apos;affichera dans le questionnaire quand ton
            professeur rendra le corrigé disponible.{' '}
          </>
        )}
        {resume.aCorrigerParProf > 0 && (
          <>
            Les questions ouvertes sont lues et évaluées par ton professeur : elles
            n&apos;apparaissent pas dans les deux premiers compteurs.
          </>
        )}
      </p>
    </div>
  );
}
