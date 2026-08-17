'use client';

// Créer ou dupliquer un parcours.
//
// Remplace les `prompt()` du navigateur, qui s'ouvrent au bord de l'écran et ne
// savent afficher qu'un seul champ — or il en faut deux : le NOM et l'ANNÉE
// SCOLAIRE. « Français — 4e générale » revient chaque année ; sans l'année, deux
// parcours homonymes sont indiscernables sur leurs cartes.
//
// En duplication, la popup dit AVANT de copier ce que la copie n'emporte pas.
// Le prof l'apprenait jusqu'ici par une alerte, une fois le geste fait.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { anneesVoisines } from '@/types/scenarisation';
import styles from './ScenarisationFormModal.module.css';

interface Props {
  mode: 'creation' | 'duplication';
  // Valeurs de départ — le nom de la source suffixé en duplication
  nomInitial: string;
  anneeInitiale: string;
  onValider: (nom: string, anneeScolaire: string) => void;
  onClose: () => void;
}

export default function ScenarisationFormModal({
  mode,
  nomInitial,
  anneeInitiale,
  onValider,
  onClose,
}: Props) {
  const [nom, setNom] = useState(nomInitial);
  const [annee, setAnnee] = useState(anneeInitiale);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const duplication = mode === 'duplication';
  const valider = () => {
    if (nom.trim()) onValider(nom.trim(), annee);
  };

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={styles.modal} role="dialog" aria-modal="true">
        <div className={styles.head}>
          <h3 className={styles.title}>
            {duplication ? 'Dupliquer le parcours' : 'Nouveau parcours'}
          </h3>
          <button type="button" className={styles.close} onClick={onClose} title="Fermer">
            ✕
          </button>
        </div>

        <div className={styles.body}>
          <label className={styles.field}>
            <span className={styles.label}>Nom du cours</span>
            <input
              className={styles.input}
              value={nom}
              autoFocus
              placeholder="Français — 4e générale"
              onChange={(e) => setNom(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && valider()}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Année scolaire</span>
            <select
              className={styles.input}
              value={annee}
              onChange={(e) => setAnnee(e.target.value)}
            >
              {anneesVoisines(anneeInitiale).map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <span className={styles.hint}>
              Un même cours revient chaque année : c’est l’année qui distingue deux parcours
              de même nom.
            </span>
          </label>

          {duplication && (
            <div className={styles.copyNote}>
              <strong>Ce que la copie emporte</strong>
              <p>
                Chapitres, modules, activités, objectifs, gestes, concepts, <em>critiques</em>{' '}
                et la déclaration des certifications (UAA, ceinture, poids).
              </p>
              <strong>Ce qu’elle laisse</strong>
              <p>
                Les classes, et les liens vers les activités Recto-versIA — une activité
                n’appartient qu’à un seul parcours.
              </p>
            </div>
          )}
        </div>

        <div className={styles.foot}>
          <button type="button" className={styles.btnGhost} onClick={onClose}>
            Annuler
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={valider}
            disabled={!nom.trim()}
          >
            {duplication ? 'Dupliquer' : 'Créer le parcours'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
