'use client';

import styles from './CreateGrilleCard.module.css';

interface CreateGrilleCardProps {
  onClick: () => void;
}

export default function CreateGrilleCard({ onClick }: CreateGrilleCardProps) {
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
        <h3 className={styles.title}>Créer une nouvelle grille</h3>
      </div>
    </article>
  );
}
