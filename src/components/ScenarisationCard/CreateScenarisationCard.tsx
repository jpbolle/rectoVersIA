'use client';

// La carte « + » de la famille — même gabarit que CreateGrilleCard,
// CreateVocabCard et CreateOeuvreCard : les quatre onglets de Mes Ressources
// s'ouvrent du même geste.

import styles from './CreateScenarisationCard.module.css';

interface Props {
  onClick: () => void;
}

export default function CreateScenarisationCard({ onClick }: Props) {
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
        <h3 className={styles.title}>Nouveau parcours</h3>
      </div>
    </article>
  );
}
