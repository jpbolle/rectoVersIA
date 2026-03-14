'use client';

import styles from './StudentClasseCard.module.css';

interface StudentClasseCardProps {
  nom: string;
  description: string;
  anneeScolaire: string;
}

export default function StudentClasseCard({ nom, description, anneeScolaire }: StudentClasseCardProps) {
  return (
    <article className={styles.card}>
      <h3 className={styles.title}>{nom}</h3>
      {description && <p className={styles.description}>{description}</p>}
      <div className={styles.meta}>
        <span>📅 {anneeScolaire}</span>
      </div>
    </article>
  );
}
