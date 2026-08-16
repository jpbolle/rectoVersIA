'use client';

// ═══ SOULIGNER DU TEXTE — par catégories ═══
//
// « Le sujet en fluo rouge, les verbes en fluo vert » (JP, 2026-08-16).
// Le prof définit des catégories (un libellé + une couleur de la palette) ;
// l'élève choisit une catégorie, puis clique les mots.
//
// SANS CATÉGORIE, ce composant n'est pas utilisé : le fluorage garde alors
// son comportement historique (une seule couleur, `FluoExtrait`). C'est ce qui
// laisse intacts tous les questionnaires déjà écrits.
//
// Un mot n'appartient qu'à UNE catégorie à la fois : cliquer un mot déjà
// marqué d'une autre couleur le change de catégorie plutôt que de le marquer
// deux fois. Un mot bicolore ne voudrait rien dire dans la correction.

import { useState } from 'react';
import type { LectureFluoCategorie } from '@/types/lecture';
import { fluoHex } from '@/types/lecture';
import styles from './QuestionInteractions.module.css';

const GOMME = '__gomme__';

interface Props {
  texte: string;
  categories: LectureFluoCategorie[];
  /** idCategorie -> indices de mots */
  valeurs: Record<string, number[]>;
  onChange: (valeurs: Record<string, number[]>) => void;
  disabled?: boolean;
  /** Le marquage attendu, quand la correction est rendue. */
  attendu?: Record<string, number[]> | null;
}

export default function FluoCategoriesField({
  texte,
  categories,
  valeurs,
  onChange,
  disabled,
  attendu,
}: Props) {
  const [active, setActive] = useState<string>(categories[0]?.id ?? '');
  const mots = texte.split(/\s+/).filter(Boolean);

  // Index inversé : quel mot porte quelle catégorie ? Recalculé à chaque
  // rendu, mais sur une phrase — pas de quoi mémoïser.
  const categorieDe = (source: Record<string, number[]>) => {
    const map = new Map<number, string>();
    Object.entries(source).forEach(([cat, indices]) =>
      indices.forEach((i) => map.set(i, cat))
    );
    return map;
  };
  const marque = categorieDe(valeurs);
  const cible = attendu ? categorieDe(attendu) : null;

  const cliquer = (i: number) => {
    if (disabled || !active) return;
    const suivant: Record<string, number[]> = {};
    Object.entries(valeurs).forEach(([cat, indices]) => {
      suivant[cat] = indices.filter((x) => x !== i);
    });
    // Recliquer dans la même couleur efface : c'est la gomme naturelle,
    // celle qu'on essaie d'instinct avant de chercher un bouton.
    if (active !== GOMME && marque.get(i) !== active) {
      suivant[active] = [...(suivant[active] ?? []), i].sort((a, b) => a - b);
    }
    Object.keys(suivant).forEach((k) => {
      if (suivant[k].length === 0) delete suivant[k];
    });
    onChange(suivant);
  };

  const couleurDe = (id: string | undefined) => {
    if (!id) return undefined;
    const cat = categories.find((c) => c.id === id);
    return cat ? fluoHex(cat.couleur) : undefined;
  };

  return (
    <div>
      {!disabled && (
        <div className={styles.fluoLegend}>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActive(c.id)}
              className={`${styles.fluoCat} ${active === c.id ? styles.active : ''}`}
            >
              <span className={styles.swatch} style={{ background: fluoHex(c.couleur) }} />
              {c.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setActive(GOMME)}
            className={`${styles.fluoCat} ${active === GOMME ? styles.active : ''}`}
          >
            <span className={styles.swatch} style={{ background: 'var(--c-bg-card)' }} />
            Gomme
          </button>
        </div>
      )}

      {disabled && (
        <div className={styles.fluoLegend}>
          {categories.map((c) => (
            <span key={c.id} className={styles.fluoCat}>
              <span className={styles.swatch} style={{ background: fluoHex(c.couleur) }} />
              {c.label}
            </span>
          ))}
        </div>
      )}

      <p className={styles.fluoText}>
        {mots.map((mot, i) => {
          const catEleve = marque.get(i);
          const catAttendue = cible?.get(i);
          // Correction : le mot que l'élève a manqué se souligne de la
          // couleur due, sans se remplir — on distingue « pas marqué » de
          // « mal marqué » d'un coup d'œil.
          const manque = !!cible && !!catAttendue && catEleve !== catAttendue;
          return (
            <span key={i}>
              <span
                className={`${styles.w} ${disabled ? styles.fige : ''} ${manque ? styles.manque : ''}`}
                style={{
                  background: couleurDe(catEleve),
                  // Le soulignement porte la couleur attendue ; le texte
                  // garde la sienne — un mot écrit en jaune pâle ne se lit pas
                  borderBottom: manque ? `3px solid ${couleurDe(catAttendue)}` : undefined,
                }}
                onClick={() => cliquer(i)}
              >
                {mot}
              </span>{' '}
            </span>
          );
        })}
      </p>
    </div>
  );
}
