'use client';

// ATELIER DE CONCEPTUALISATION — verso « Contenus de l'activité » (2026-10-11) :
// le point de départ du schéma de l'élève. Le concept central apparaît dans
// son canevas ; les autres concepts l'attendent en étiquettes « À placer »,
// dans l'ordre donné ou mélangés. Partagé par CreationForm et EditDevoirModal.
// Deux colonnes sur une ligne (JP) : le concept central à gauche, les autres
// concepts en étiquettes à droite (Entrée ou virgule pour ajouter).

import { useState } from 'react';
import styles from './SchemaDepartInput.module.css';

export interface SchemaDepartValeur {
  conceptCentral: string;
  concepts: string[];
  melanger: boolean;
}

export const SCHEMA_DEPART_VIDE: SchemaDepartValeur = { conceptCentral: '', concepts: [], melanger: false };

interface Props {
  valeur: SchemaDepartValeur;
  onChange: (v: SchemaDepartValeur) => void;
  disabled?: boolean;
}

export default function SchemaDepartInput({ valeur, onChange, disabled }: Props) {
  const [saisie, setSaisie] = useState('');
  const set = (patch: Partial<SchemaDepartValeur>) => onChange({ ...valeur, ...patch });

  // Ajoute ce qui est tapé (plusieurs concepts d'un coup s'ils sont séparés par des virgules)
  const ajouter = (texte: string) => {
    const nouveaux = texte
      .split(',')
      .map((t) => t.trim().slice(0, 120))
      .filter(Boolean)
      .filter((t, i, tous) => tous.findIndex((u) => u.toLowerCase() === t.toLowerCase()) === i)
      .filter((t) => !valeur.concepts.some((c) => c.toLowerCase() === t.toLowerCase()));
    if (nouveaux.length) set({ concepts: [...valeur.concepts, ...nouveaux].slice(0, 40) });
    setSaisie('');
  };
  const retirer = (i: number) => {
    const concepts = valeur.concepts.filter((_, j) => j !== i);
    set({ concepts, melanger: concepts.length ? valeur.melanger : false });
  };

  return (
    <div className={styles.depart}>
      <div className={styles.colonnes}>
        <div className={styles.colonne}>
          <label className={styles.lab} htmlFor="schema-central">
            Concept central
          </label>
          <input
            id="schema-central"
            className={styles.input}
            type="text"
            value={valeur.conceptCentral}
            onChange={(e) => set({ conceptCentral: e.target.value })}
            placeholder="La comédie"
            maxLength={120}
            disabled={disabled}
          />
        </div>

        <div className={styles.colonne}>
          <label className={styles.lab} htmlFor="schema-concepts">
            Autres concepts <span className={styles.note}>— Entrée pour ajouter</span>
          </label>
          <div className={`${styles.tags} ${disabled ? styles.tagsInactif : ''}`}>
            {valeur.concepts.map((c, i) => (
              <span key={c} className={styles.tag}>
                {c}
                <button
                  type="button"
                  className={styles.tagRetirer}
                  onClick={() => retirer(i)}
                  disabled={disabled}
                  aria-label={`Retirer « ${c} »`}
                  title="Retirer"
                >
                  ×
                </button>
              </span>
            ))}
            <input
              id="schema-concepts"
              className={styles.tagSaisie}
              type="text"
              value={saisie}
              onChange={(e) => {
                const v = e.target.value;
                // Une virgule tapée valide le concept, comme Entrée
                if (v.endsWith(',')) ajouter(v);
                else setSaisie(v);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  ajouter(saisie);
                } else if (e.key === 'Backspace' && !saisie && valeur.concepts.length) {
                  retirer(valeur.concepts.length - 1);
                }
              }}
              onBlur={() => saisie.trim() && ajouter(saisie)}
              placeholder={valeur.concepts.length ? '' : 'Le quiproquo, le valet…'}
              disabled={disabled}
            />
          </div>
        </div>
      </div>

      <label className={`${styles.case} ${!valeur.concepts.length ? styles.caseInactive : ''}`}>
        <input
          type="checkbox"
          checked={valeur.melanger}
          onChange={(e) => set({ melanger: e.target.checked })}
          disabled={disabled || !valeur.concepts.length}
        />
        Mélanger les concepts (sinon, l’élève les reçoit dans l’ordre des étiquettes)
      </label>
      <p className={styles.aide}>
        Le concept central apparaît dans le canevas de l’élève ; les autres l’attendent dans l’onglet « À placer », sous son schéma.
      </p>
    </div>
  );
}
