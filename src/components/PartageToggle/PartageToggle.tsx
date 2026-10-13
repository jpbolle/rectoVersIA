'use client';

// Double bouton « Partagé / Privé » d'une ressource (plan 2026-10-13-ressources-privees).
// Partagé : les collègues la voient dans leur bloc « … des professeurs » et peuvent
// la dupliquer. Privé : elle n'y apparaît plus — les élèves y accèdent toujours.
// Champ `prive` sur la ressource : absent = partagé (tout l'existant).

import styles from './PartageToggle.module.css';

interface PartageToggleProps {
  prive: boolean;
  onChange: (prive: boolean) => void;
  // Exemple posé par l'admin : forcément partagé, le bouton Privé est grisé
  verrouillePartage?: boolean;
  disabled?: boolean;
}

export default function PartageToggle({ prive, onChange, verrouillePartage, disabled }: PartageToggleProps) {
  const estPrive = prive && !verrouillePartage;
  return (
    <div className={styles.wrap}>
      <div className={styles.toggle} role="radiogroup" aria-label="Partage avec les collègues">
        <button
          type="button"
          role="radio"
          aria-checked={!estPrive}
          className={`${styles.option} ${!estPrive ? styles.active : ''}`}
          onClick={() => onChange(false)}
          disabled={disabled}
        >
          <span aria-hidden="true">👥</span> Partagé
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={estPrive}
          className={`${styles.option} ${estPrive ? styles.active : ''}`}
          onClick={() => onChange(true)}
          disabled={disabled || verrouillePartage}
          title={verrouillePartage ? 'Un exemple partagé par l’administration reste visible de tous' : undefined}
        >
          <span aria-hidden="true">🔒</span> Privé
        </button>
      </div>
      <p className={styles.aide}>
        {verrouillePartage
          ? 'Exemple partagé par l’administration : visible de tous les professeurs.'
          : estPrive
            ? 'Toi seul la vois parmi les professeurs. Tes élèves y ont toujours accès.'
            : 'Tes collègues la voient dans « … des professeurs » et peuvent la dupliquer.'}
      </p>
    </div>
  );
}
