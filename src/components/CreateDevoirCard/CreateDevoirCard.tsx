'use client';

import styles from './CreateDevoirCard.module.css';

interface CreateDevoirCardProps {
  onClick: () => void;
}

export default function CreateDevoirCard({ onClick }: CreateDevoirCardProps) {
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
        <h3 className={styles.title}>Créer un nouveau travail</h3>
      </div>
    </article>
  );
}
