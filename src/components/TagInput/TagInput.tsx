'use client';

// Saisie d'une liste de mots-clés en pastilles : chaque valeur est un tag
// qu'on retire d'un clic, et le champ propose les valeurs déjà utilisées
// ailleurs (datalist). Entrée ou virgule valide la saisie.
//
// Utilisé pour les objets d'une habileté (Gestion didactique) : « contraction
// de texte », « CRC »… — une habileté peut en porter plusieurs.

import { useState } from 'react';
import styles from './TagInput.module.css';

interface Props {
  value: string[];
  onChange: (value: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  disabled?: boolean;
  // Identifiant de la datalist partagée (évite d'en créer une par cellule)
  listId?: string;
}

export default function TagInput({
  value,
  onChange,
  suggestions = [],
  placeholder = 'ajouter…',
  disabled,
  listId,
}: Props) {
  const [draft, setDraft] = useState('');

  const add = (raw: string) => {
    const tag = raw.trim();
    if (!tag || value.includes(tag)) {
      setDraft('');
      return;
    }
    onChange([...value, tag]);
    setDraft('');
  };

  const remove = (tag: string) => onChange(value.filter((t) => t !== tag));

  return (
    <div className={styles.wrap}>
      {value.map((tag) => (
        <span key={tag} className={styles.tag}>
          {tag}
          {!disabled && (
            <button
              type="button"
              className={styles.remove}
              onClick={() => remove(tag)}
              title={`Retirer « ${tag} »`}
              aria-label={`Retirer ${tag}`}
            >
              ×
            </button>
          )}
        </span>
      ))}
      <input
        className={styles.input}
        value={draft}
        list={listId}
        placeholder={value.length ? '' : placeholder}
        disabled={disabled}
        onChange={(e) => {
          // Coller « a, b » crée deux tags d'un coup
          const v = e.target.value;
          if (v.includes(',')) {
            v.split(',').forEach(add);
          } else {
            setDraft(v);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add(draft);
          } else if (e.key === 'Backspace' && !draft && value.length) {
            remove(value[value.length - 1]);
          }
        }}
        onBlur={() => add(draft)}
      />
      {suggestions.length > 0 && !listId && (
        <datalist id="taginput-suggestions">
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </div>
  );
}
