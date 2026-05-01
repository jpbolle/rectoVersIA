'use client';

import styles from './CreateVocabCard.module.css';

interface CreateVocabCardProps {
  onClick: () => void;
}

export default function CreateVocabCard({ onClick }: CreateVocabCardProps) {
  return (
    <article
      className={styles.card}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div className={styles.content}>
        <span className={styles.icon}>+</span>
        <h3 className={styles.title}>Créer une nouvelle liste</h3>
      </div>
    </article>
  );
}
