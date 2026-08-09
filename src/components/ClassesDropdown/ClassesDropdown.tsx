'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './ClassesDropdown.module.css';

interface ClassesDropdownProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Menu déroulant multi-sélection à cases à cocher (sélection des classes
 * dans les formulaires de création/édition d'activité).
 */
export default function ClassesDropdown({
  options,
  selected,
  onChange,
  disabled = false,
  placeholder = 'Sélectionnez...',
}: ClassesDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Fermer au clic hors du composant
  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  const toggleOption = (option: string) => {
    onChange(
      selected.includes(option)
        ? selected.filter((c) => c !== option)
        : [...selected, option]
    );
  };

  return (
    <div
      className={styles.root}
      ref={rootRef}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false);
      }}
    >
      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span
          className={`${styles.triggerText} ${
            selected.length === 0 ? styles.triggerPlaceholder : ''
          }`}
        >
          {selected.length === 0 ? placeholder : [...selected].sort().join(', ')}
        </span>
        {selected.length > 0 && (
          <span className={styles.count}>{selected.length}</span>
        )}
        <span className={styles.chevron} aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className={styles.panel} role="listbox" aria-multiselectable="true">
          {options.length === 0 && (
            <p className={styles.empty}>Aucune classe disponible</p>
          )}
          {options.map((option) => (
            <label key={option} className={styles.option}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={selected.includes(option)}
                onChange={() => toggleOption(option)}
              />
              <span className={styles.optionLabel}>{option}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
