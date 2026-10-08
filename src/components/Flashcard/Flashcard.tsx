'use client';

// Carte à retourner — composant PARTAGÉ (2026-10-08), né pour le vocabulaire
// d'une lecture de cours FLE. Recto et verso sont libres (du contenu React) :
// la carte ne sait que se retourner.
//
// ⚠ `VocabulaireActivity` porte encore sa propre `Flashcard` locale (mot /
// définition) : à faire converger vers celle-ci (famille de composants).

import { useState } from 'react';
import type { ReactNode } from 'react';
import styles from './Flashcard.module.css';

interface Props {
  recto: ReactNode;
  verso: ReactNode;
  large?: boolean;
  ariaLabel?: string;
}

export default function Flashcard({ recto, verso, large = false, ariaLabel = 'Retourner la carte' }: Props) {
  const [retournee, setRetournee] = useState(false);
  return (
    <div className={`${styles.carte} ${large ? styles.carteLarge : ''} ${retournee ? styles.retournee : ''}`}>
      <button type="button" className={styles.flip} onClick={() => setRetournee((r) => !r)} aria-label={ariaLabel}>
        <div className={styles.inner}>
          <div className={styles.face}>{recto}</div>
          <div className={`${styles.face} ${styles.dos}`}>{verso}</div>
        </div>
      </button>
    </div>
  );
}
