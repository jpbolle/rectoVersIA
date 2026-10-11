'use client';

// Le petit badge de la GESTION DE L'AFFICHAGE (plan 2026-10-11) sur un atelier,
// un onglet ou un outil : « Nouveau — en test » pour tous, ou « masqué aux
// profs » pour l'admin et les testeurs (qui voient l'élément normalement).
// Rien quand l'élément est simplement visible ou bloqué (le grisé suffit).

import type { VueAffichage } from '@/types/affichage';
import styles from './AffichageBadge.module.css';

export default function AffichageBadge({ vue, compact = false }: { vue: VueAffichage; compact?: boolean }) {
  if (vue.enTest) {
    return (
      <span className={`${styles.badge} ${styles.test} ${compact ? styles.compact : ''}`} title={vue.note === 'Bientôt disponible' ? undefined : vue.note}>
        {compact ? 'en test' : 'Nouveau — en test'}
      </span>
    );
  }
  if (vue.masqueAuxProfs) {
    return (
      <span className={`${styles.badge} ${styles.masque} ${compact ? styles.compact : ''}`} title="Masqué aux autres professeurs (Gestion de l’affichage)">
        masqué aux profs
      </span>
    );
  }
  return null;
}
