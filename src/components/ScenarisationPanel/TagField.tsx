'use client';

// Champ à pastilles éditable sur place : les valeurs s'affichent comme du
// texte, un clic ouvre la liste à cocher. Pas d'icône crayon, pas de fenêtre :
// c'est la règle de l'écran d'encodage.

import { useEffect, useRef, useState } from 'react';
import styles from './ScenarisationPanel.module.css';

interface Option {
  id: string;
  label: string;
}

interface Props {
  value: string[];
  options: Option[];
  onChange: (value: string[]) => void;
  // Libellé court affiché dans la pastille (défaut : le label de l'option)
  labelCourt?: (id: string, label: string) => string;
  // Au-delà de 2 valeurs, on résume plutôt que d'empiler les pastilles
  resume?: (n: number) => string;
  variant?: 'methode';
  footer?: string;
}

export default function TagField({
  value,
  options,
  onChange,
  labelCourt,
  resume,
  variant,
  footer,
}: Props) {
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ouvert) return;
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [ouvert]);

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  const libelle = (id: string) => {
    const opt = options.find((o) => o.id === id);
    return labelCourt ? labelCourt(id, opt?.label ?? id) : (opt?.label ?? id);
  };

  const trop = resume && value.length > 2;

  return (
    <div className={styles.tagWrap} ref={ref}>
      <div
        className={`${styles.tagField} ${ouvert ? styles.tagFieldOpen : ''}`}
        onClick={() => setOuvert((v) => !v)}
      >
        {trop ? (
          <span className={`${styles.tg} ${variant === 'methode' ? styles.tgMeth : ''}`}>
            {resume!(value.length)}
          </span>
        ) : (
          value.map((id) => (
            <span
              key={id}
              className={`${styles.tg} ${variant === 'methode' ? styles.tgMeth : ''}`}
              title={libelle(id)}
            >
              {libelle(id)}
            </span>
          ))
        )}
        <span className={styles.tgAdd}>＋</span>
      </div>

      {ouvert && (
        <div className={styles.tagMenu}>
          {options.length === 0 && (
            <span className={styles.tagEmpty}>
              Aucune valeur disponible — à gérer dans Administration du site.
            </span>
          )}
          {options.map((o) => (
            <label key={o.id} className={styles.tagItem}>
              <input type="checkbox" checked={value.includes(o.id)} onChange={() => toggle(o.id)} />
              {o.label}
            </label>
          ))}
          {footer && <span className={styles.tagFooter}>{footer}</span>}
        </div>
      )}
    </div>
  );
}
