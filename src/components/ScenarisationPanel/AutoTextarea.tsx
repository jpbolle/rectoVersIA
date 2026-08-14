'use client';

// Champ de texte qui grandit avec son contenu.
//
// Un titre de module ou un objectif ne tient presque jamais sur une ligne : un
// <input> en couperait la fin, et l'écran d'encodage doit TOUJOURS montrer le
// texte en entier (règle posée par JP le 2026-08-14). D'où un <textarea> sans
// barre de défilement, dont la hauteur suit le contenu.

import { useEffect, useRef } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  title?: string;
  rows?: number;
}

export default function AutoTextarea({
  value,
  onChange,
  placeholder,
  className,
  title,
  rows = 1,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // La hauteur se recalcule à chaque changement de valeur — y compris quand
  // elle vient du parent (chargement, duplication d'un module…)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      className={className}
      value={value}
      title={title}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      // Entrée valide au lieu d'insérer un retour à la ligne : dans un tableau
      // d'encodage, on passe au champ suivant
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          (e.target as HTMLTextAreaElement).blur();
        }
      }}
    />
  );
}
