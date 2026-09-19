'use client';

// La carte « + » d'ouverture de grille, portée à la bibliothèque d'œuvres :
// même gabarit que CreateGrilleCard et CreateVocabCard, pour que les
// onglets de Mes Ressources s'ouvrent du même geste. Depuis le 2026-09-19,
// c'est LA carte « + » des onglets récents (questionnaires, Modules FLE) :
// seul le libellé change.

import styles from './CreateOeuvreCard.module.css';

interface Props {
  onClick: () => void;
  libelle?: string;
}

export default function CreateOeuvreCard({ onClick, libelle = 'Ajouter une œuvre' }: Props) {
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
        <h3 className={styles.title}>{libelle}</h3>
      </div>
    </article>
  );
}
