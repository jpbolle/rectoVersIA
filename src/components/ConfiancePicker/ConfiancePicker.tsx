'use client';

// Les trois smileys de degré d'assurance, posés sous une réponse.
//
// Partagé par le questionnaire de lecture et — via son portage en JS — le
// panneau de l'extension NavigKid : c'est le même geste, il doit avoir la même
// tête des deux côtés (cf. règle « familles de composants »).
//
// Facultatif par construction : un second clic sur le smiley déjà choisi le
// retire. Personne n'est contraint de se prononcer, et une question sans
// smiley sort simplement du calcul de lucidité.

import { ECHELLE_CONFIANCE } from '@/types/confiance';
import type { NiveauConfiance } from '@/types/confiance';
import styles from './ConfiancePicker.module.css';

interface Props {
  value?: NiveauConfiance;
  onChange: (niveau: NiveauConfiance | undefined) => void;
  disabled?: boolean;
  /** Masque l'intitulé quand le contexte le rend inutile (récapitulatif) */
  compact?: boolean;
}

export default function ConfiancePicker({ value, onChange, disabled, compact }: Props) {
  return (
    <div className={`${styles.wrap} ${compact ? styles.compact : ''}`}>
      {/* Intitulé explicite : « Et toi, tu en penses quoi ? » seul laissait
          l'élève deviner de QUOI on parle */}
      {!compact && (
        <span className={styles.label}>Et toi, tu en penses quoi, de ta réponse ?</span>
      )}
      <div className={styles.choices}>
        {ECHELLE_CONFIANCE.map((e) => {
          const actif = value === e.niveau;
          return (
            <button
              key={e.niveau}
              type="button"
              className={`${styles.choice} ${actif ? styles.choiceOn : ''}`}
              onClick={() => onChange(actif ? undefined : e.niveau)}
              disabled={disabled}
              title={actif ? `${e.label} — cliquer à nouveau pour retirer` : e.label}
              aria-pressed={actif}
            >
              <span className={styles.emoji}>{e.emoji}</span>
              <span className={styles.text}>{e.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
