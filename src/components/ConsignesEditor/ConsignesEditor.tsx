'use client';

import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { Dot, Plus, Square, Text, X } from 'lucide-react';
import styles from './ConsignesEditor.module.css';

/**
 * Éditeur des consignes d'une activité, LIGNE PAR LIGNE.
 *
 * La valeur reste le texte libre de `Devoir.consignes` (une ligne = une étape,
 * cf. `src/lib/consignes-etapes.ts`) : ce composant ne fait que montrer au
 * prof ce que l'élève verra — chaque ligne est une tâche, avec sa case.
 * Entrée ajoute la tâche suivante ; Retour arrière sur une ligne vide la
 * retire ; un collage de plusieurs lignes en fait autant de tâches.
 * Une ligne qui se termine par « : » est un titre (sans case chez l'élève).
 *
 * Partagé par le formulaire de création et la popup d'édition — un seul
 * comportement pour les deux (consigne « familles de composants »).
 */
interface ConsignesEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  // Ce que nomme chaque ligne : les objectifs d'une étape de portfolio
  // utilisent le même éditeur que les consignes.
  nature?: 'consigne' | 'objectif';
}

const LIBELLES = {
  consigne: {
    premiere: 'Première consigne… (Entrée pour la suivante)',
    suivante: 'Consigne suivante…',
    retirer: 'Retirer cette consigne',
    ajouter: 'Ajouter une consigne',
    aide: 'Une ligne = une case à cocher pour l’élève. Une ligne qui se termine par « : » sert de titre.',
  },
  objectif: {
    premiere: 'Premier objectif… (Entrée pour le suivant)',
    suivante: 'Objectif suivant…',
    retirer: 'Retirer cet objectif',
    ajouter: 'Ajouter un objectif',
    // Un objectif se lit, il ne se coche pas : une puce, pas une case
    aide: 'Une ligne = un objectif, affiché en liste à puces chez l’élève.',
  },
};

function versLignes(value: string): string[] {
  const lignes = value.split('\n');
  return lignes.length > 0 ? lignes : [''];
}

export default function ConsignesEditor({ value, onChange, disabled = false, nature = 'consigne' }: ConsignesEditorProps) {
  const libelles = LIBELLES[nature];
  const [lignes, setLignes] = useState<string[]>(() => versLignes(value));
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  // Ligne à mettre au clavier après le prochain rendu (ajout / suppression)
  const focusAVenir = useRef<number | null>(null);

  // La valeur vient de l'extérieur (ouverture de la popup d'édition,
  // réinitialisation du formulaire) : on se réaligne pendant le rendu, sans
  // effet — c'est le motif « état dérivé » de React, qui ne boucle pas.
  const [valeurPrecedente, setValeurPrecedente] = useState(value);
  if (value !== valeurPrecedente) {
    setValeurPrecedente(value);
    if (lignes.join('\n') !== value) setLignes(versLignes(value));
  }

  useEffect(() => {
    if (focusAVenir.current === null) return;
    const cible = inputs.current[focusAVenir.current];
    focusAVenir.current = null;
    if (cible) {
      cible.focus();
      cible.setSelectionRange(cible.value.length, cible.value.length);
    }
  }, [lignes]);

  const appliquer = (suivantes: string[], focus: number | null = null) => {
    const propres = suivantes.length > 0 ? suivantes : [''];
    focusAVenir.current = focus;
    setLignes(propres);
    onChange(propres.join('\n'));
  };

  const modifier = (index: number, texte: string) => {
    appliquer(lignes.map((l, i) => (i === index ? texte : l)));
  };

  const inserer = (index: number, nouvelles: string[] = ['']) => {
    const suivantes = [...lignes.slice(0, index + 1), ...nouvelles, ...lignes.slice(index + 1)];
    appliquer(suivantes, index + nouvelles.length);
  };

  const retirer = (index: number) => {
    if (lignes.length === 1) {
      appliquer([''], 0);
      return;
    }
    appliquer(lignes.filter((_, i) => i !== index), Math.max(0, index - 1));
  };

  const auClavier = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Entrée au milieu d'une ligne : la coupe en deux tâches
      const champ = e.currentTarget;
      const caret = champ.selectionStart ?? champ.value.length;
      const avant = champ.value.slice(0, caret);
      const apres = champ.value.slice(caret);
      const suivantes = [...lignes.slice(0, index), avant, apres, ...lignes.slice(index + 1)];
      appliquer(suivantes, index + 1);
      return;
    }
    if (e.key === 'Backspace' && e.currentTarget.value === '' && lignes.length > 1) {
      e.preventDefault();
      retirer(index);
      return;
    }
    if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault();
      inputs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowDown' && index < lignes.length - 1) {
      e.preventDefault();
      inputs.current[index + 1]?.focus();
    }
  };

  // Un collage de plusieurs lignes devient autant de tâches
  const auCollage = (index: number, e: ClipboardEvent<HTMLInputElement>) => {
    const texte = e.clipboardData.getData('text');
    if (!texte.includes('\n')) return;
    e.preventDefault();
    const morceaux = texte.split('\n').map((l) => l.trim()).filter(Boolean);
    if (morceaux.length === 0) return;
    const champ = e.currentTarget;
    const caret = champ.selectionStart ?? champ.value.length;
    const avant = champ.value.slice(0, caret);
    const apres = champ.value.slice(champ.selectionEnd ?? caret);
    const [premiere, ...reste] = morceaux;
    const suivantes = [
      ...lignes.slice(0, index),
      avant + premiere,
      ...reste.slice(0, -1),
      ...(reste.length > 0 ? [reste[reste.length - 1] + apres] : []),
      ...lignes.slice(index + 1),
    ];
    // Si une seule ligne collée, l'« après » reste sur la même ligne
    if (reste.length === 0) suivantes[index] = avant + premiere + apres;
    appliquer(suivantes, index + reste.length);
  };

  return (
    <div className={`${styles.editeur} ${disabled ? styles.editeurInactif : ''}`}>
      <ul className={styles.lignes}>
        {lignes.map((ligne, index) => {
          const estTitre = /:\s*$/.test(ligne);
          const estVide = ligne.trim() === '';
          return (
            <li
              key={index}
              className={`${styles.ligne} ${estTitre ? styles.ligneTitre : ''} ${estVide ? styles.ligneVide : ''}`}
            >
              <span
                className={styles.icone}
                aria-hidden="true"
                title={nature === 'objectif' ? 'Objectif' : estTitre ? 'Titre (sans case)' : 'Tâche à cocher'}
              >
                {nature === 'objectif' ? <Dot size={14} strokeWidth={6} /> : estTitre ? <Text size={14} /> : <Square size={14} />}
              </span>
              <input
                ref={(el) => {
                  inputs.current[index] = el;
                }}
                type="text"
                className={styles.champ}
                value={ligne}
                onChange={(e) => modifier(index, e.target.value)}
                onKeyDown={(e) => auClavier(index, e)}
                onPaste={(e) => auCollage(index, e)}
                placeholder={index === 0 && lignes.length === 1 ? libelles.premiere : libelles.suivante}
                disabled={disabled}
                spellCheck
              />
              <button
                type="button"
                className={styles.retirer}
                onClick={() => retirer(index)}
                disabled={disabled || (lignes.length === 1 && estVide)}
                aria-label={libelles.retirer}
                title="Retirer"
              >
                <X size={14} />
              </button>
            </li>
          );
        })}
      </ul>
      <div className={styles.pied}>
        <button
          type="button"
          className={styles.ajouter}
          onClick={() => inserer(lignes.length - 1)}
          disabled={disabled}
        >
          <Plus size={14} />
          {libelles.ajouter}
        </button>
        <span className={styles.aide}>
          {libelles.aide}
        </span>
      </div>
    </div>
  );
}
