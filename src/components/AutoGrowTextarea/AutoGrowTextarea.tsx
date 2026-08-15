'use client';

// Champ de texte qui prend exactement la hauteur de son contenu.
//
// Il existe parce que les trois constructeurs de questionnaires (lecture,
// recherche, auto-évaluation) posaient le même problème de trois façons :
// un `<input>` d'une seule ligne pour la lecture, et deux formules maison
// distinctes estimant `rows` d'après le NOMBRE DE CARACTÈRES pour les autres.
// Cette estimation ne peut pas être juste : elle ignore la largeur réelle du
// champ, la taille de police et les retours à la ligne saisis. Résultat, un
// énoncé long restait coupé.
//
// Ici la hauteur est MESURÉE (`scrollHeight`) après chaque changement, donc
// juste par construction. Au-delà de `maxRows`, le champ cesse de grandir et
// défile — sinon une consigne de vingt lignes chasserait tout le reste de
// l'écran.

import { useCallback, useEffect, useRef } from 'react';
import type { TextareaHTMLAttributes } from 'react';

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Hauteur minimale, en lignes */
  minRows?: number;
  /** Au-delà, le champ défile au lieu de grandir */
  maxRows?: number;
}

export default function AutoGrowTextarea({
  minRows = 2,
  maxRows = 14,
  value,
  onChange,
  ...rest
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    const cs = window.getComputedStyle(el);
    const fontSize = parseFloat(cs.fontSize) || 14;
    // `line-height: normal` n'est pas un nombre exploitable — repli à 1,4 em
    const lineHeight = parseFloat(cs.lineHeight) || fontSize * 1.4;
    const padding = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    // En box-sizing: border-box, `height` inclut la bordure, pas `scrollHeight`
    const border = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);

    const min = lineHeight * minRows + padding + border;
    const max = lineHeight * maxRows + padding + border;

    // Remettre à zéro d'abord : sans quoi le champ ne saurait que grandir
    el.style.height = 'auto';
    const naturelle = el.scrollHeight + border;
    el.style.height = `${Math.min(Math.max(naturelle, min), max)}px`;
    el.style.overflowY = naturelle > max ? 'auto' : 'hidden';
  }, [minRows, maxRows]);

  // À chaque frappe, mais aussi quand le contenu change de l'extérieur
  // (duplication d'une question, chargement d'un questionnaire existant)
  useEffect(resize, [resize, value]);

  // La largeur du champ change avec celle du panneau (rail redimensionnable) :
  // la hauteur juste hier ne l'est plus aujourd'hui
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [resize]);

  return (
    <textarea
      {...rest}
      ref={ref}
      value={value}
      onChange={(e) => {
        onChange?.(e);
        resize();
      }}
      rows={minRows}
    />
  );
}
