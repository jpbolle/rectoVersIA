'use client';

// Une barre d'onglets avec un compte par onglet — celle du bloc « Activités
// classées », partagée entre la page des activités de l'élève et le tableau de
// bord du prof (2026-10-09). Même mécanisme des deux côtés : seules les listes
// qu'elle filtre diffèrent.

import styles from './OngletsBarre.module.css';

export interface Onglet<T extends string> {
  id: T;
  label: string;
  n: number;
}

interface Props<T extends string> {
  onglets: Onglet<T>[];
  actif: T;
  onChange: (id: T) => void;
}

export default function OngletsBarre<T extends string>({ onglets, actif, onChange }: Props<T>) {
  return (
    <div className={styles.barre} role="tablist">
      {onglets.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={actif === o.id}
          className={`${styles.onglet} ${actif === o.id ? styles.ongletActif : ''}`}
          onClick={() => onChange(o.id)}
        >
          {o.label}
          <span className={styles.compte}>{o.n}</span>
        </button>
      ))}
    </div>
  );
}
