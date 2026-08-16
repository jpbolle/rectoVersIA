'use client';

// La carte « + » d'ouverture de grille, portée à la bibliothèque d'œuvres :
// même gabarit que CreateGrilleCard et CreateVocabCard, pour que les trois
// onglets de Mes Ressources s'ouvrent du même geste.

import styles from './CreateOeuvreCard.module.css';

interface Props {
  onClick: () => void;
}

export default function CreateOeuvreCard({ onClick }: Props) {
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
        <h3 className={styles.title}>Ajouter une œuvre</h3>
      </div>
    </article>
  );
}
