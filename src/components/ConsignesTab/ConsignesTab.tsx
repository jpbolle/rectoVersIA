'use client';

import type { Devoir } from '@/types/devoir';
import styles from './ConsignesTab.module.css';

interface ConsignesTabProps {
  devoir: Devoir;
}

// Fonction pour transformer les URLs en liens cliquables
function linkifyText(text: string): React.ReactNode[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      // Reset lastIndex car le regex est global
      urlRegex.lastIndex = 0;
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.link}
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

export default function ConsignesTab({ devoir }: ConsignesTabProps) {
  return (
    <div className={styles.container}>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Consignes</h3>
        <div className={styles.content}>
          {devoir.consignes ? (
            <p className={styles.text}>{linkifyText(devoir.consignes)}</p>
          ) : (
            <p className={styles.empty}>Aucune consigne spécifique pour ce devoir.</p>
          )}
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Informations</h3>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Date de remise</span>
            <span className={styles.infoValue}>
              {devoir.dateRemise
                ? new Date(devoir.dateRemise).toLocaleDateString('fr-BE', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })
                : 'non fixée'}
            </span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Grille d&apos;évaluation</span>
            <span className={styles.infoValue}>{devoir.grille}</span>
          </div>
          {devoir.accesIA && (
            <div className={styles.infoItem}>
              <span className={styles.iaBadge}>
                <span>🤖</span>
                <span>Assistance IA disponible</span>
              </span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
