'use client';

// ═══ QUELLE FACE L'ÉLÈVE TROUVE EN ARRIVANT ═══
//
// Deux faces côte à côte, un bouton ⇄ entre elles. La forme vient de la
// création d'activité d'écriture (rédaction / planification) ; elle est
// remontée ici le 2026-08-17 pour servir aussi à la lecture d'une œuvre
// (espace textuel / espace multimédia).
//
// LE MÉCANISME EST PARTAGÉ, LES CONTENUS NE LE SONT PAS : chaque dispositif
// nomme ses deux faces comme il l'entend et pose son propre libellé. Ce qui
// serait fautif, ce sont trois sélecteurs qui se ressemblent « à peu près ».
//
// Pourquoi cette forme plutôt qu'un menu déroulant : le prof doit VOIR ce que
// l'élève verra en premier, et l'inversion est un geste — pas un réglage à
// lire dans une liste.

import styles from './FlipChoice.module.css';

interface Props {
  /** Ce que le réglage règle — « Espace d'écriture », « Espaces de la scène »… */
  label: string;
  /** Les deux faces, dans leur ordre NATUREL (non inversé) */
  faces: [string, string];
  /** Vrai : la seconde face passe devant */
  inverse: boolean;
  onChange: (inverse: boolean) => void;
  /** Une ligne d'explication sous le sélecteur */
  hint?: string;
  disabled?: boolean;
}

export default function FlipChoice({
  label,
  faces,
  inverse,
  onChange,
  hint = 'Le recto est la face affichée à l’ouverture de l’activité par l’élève.',
  disabled = false,
}: Props) {
  const [devant, derriere] = inverse ? [faces[1], faces[0]] : faces;

  return (
    <div className={styles.flipChoice}>
      <span className={styles.flipChoiceLabel}>{label}</span>
      <div className={styles.flipChoiceRow}>
        <div className={styles.flipChoiceFace}>
          <span className={styles.flipChoiceTag}>Recto</span>
          <span className={styles.flipChoiceContent}>{devant}</span>
        </div>
        <button
          type="button"
          className={styles.flipChoiceSwap}
          onClick={() => onChange(!inverse)}
          disabled={disabled}
          title="Inverser recto et verso"
          aria-label="Inverser recto et verso"
        >
          ⇄
        </button>
        <div className={styles.flipChoiceFace}>
          <span className={styles.flipChoiceTag}>Verso</span>
          <span className={styles.flipChoiceContent}>{derriere}</span>
        </div>
      </div>
      <p className={styles.flipChoiceHint}>{hint}</p>
    </div>
  );
}
