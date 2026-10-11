'use client';

// LA carte « + » de Mes Ressources (plan 2026-10-11) : un seul gabarit pour
// tous les onglets, accordé à RessourceCard (même hauteur, même rayon) ; seul
// le libellé change (« Créer un/une … »).

import styles from './CreateOeuvreCard.module.css';

interface Props {
  onClick: () => void;
  libelle?: string;
}

export default function CreateOeuvreCard({ onClick, libelle = 'Créer une œuvre' }: Props) {
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
