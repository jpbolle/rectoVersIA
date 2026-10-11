'use client';

// Un GROUPE DU VERSO d'une activité (création et modification, JP 2026-10-11) :
// une CASE À COCHER devant l'intitulé — « Ressources pour l'élève »,
// « Corrigé de l'activité », « Contenus de l'activité » ; cochée, l'encadré
// s'ouvre. Décocher REPLIE seulement : rien n'est effacé (ce qui est rempli
// reste enregistré, l'étiquette « rempli » le rappelle).

import type { ReactNode } from 'react';
import styles from './VersoGroupe.module.css';

interface Props {
  titre: string;
  ouvert: boolean;
  onBascule: (ouvert: boolean) => void;
  // Une ligne sous l'intitulé (ex. « Visibles par l'élève dans l'onglet Ressources »)
  aide?: string;
  // La pastille « i » et son info-bulle
  info?: string;
  // Le groupe contient déjà quelque chose : rappelé quand il est replié
  rempli?: boolean;
  disabled?: boolean;
  children: ReactNode;
}

export default function VersoGroupe({ titre, ouvert, onBascule, aide, info, rempli = false, disabled = false, children }: Props) {
  return (
    <section className={`${styles.groupe} ${ouvert ? styles.groupeOuvert : ''}`}>
      <label className={styles.tete}>
        <input
          type="checkbox"
          className={styles.case}
          checked={ouvert}
          onChange={(e) => onBascule(e.target.checked)}
          disabled={disabled}
        />
        <span className={styles.titre}>{titre}</span>
        {info && (
          <span className={styles.info} title={info} aria-label={info}>
            i
          </span>
        )}
        {!ouvert && rempli && <span className={styles.rempli}>rempli</span>}
      </label>
      {aide && ouvert && <p className={styles.aide}>{aide}</p>}
      {ouvert && <div className={styles.corps}>{children}</div>}
    </section>
  );
}
