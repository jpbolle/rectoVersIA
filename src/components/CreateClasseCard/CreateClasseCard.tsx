'use client';

import styles from './CreateClasseCard.module.css';

interface CreateClasseCardProps {
  onClick: () => void;
}

export default function CreateClasseCard({ onClick }: CreateClasseCardProps) {
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
        <h3 className={styles.title}>Créer une nouvelle classe</h3>
      </div>
    </article>
  );
}
