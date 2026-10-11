'use client';

/**
 * PASTILLES DE CORRECTION (RectoVerso, 2026-10-11) — sur le schéma de l'élève,
 * le prof marque une boîte ou un lien : vert = juste, rouge = faux. Un clic
 * fait tourner : rien → ✓ → ✗ → rien. L'élève les voit, sans pouvoir y toucher,
 * quand la correction lui est rendue visible.
 *
 * Le contexte est posé par DiagramWorkspace ; sans lui (Mes schémas, éditeur
 * de corrigés), les pastilles n'existent pas.
 */
import { createContext, useContext, type MouseEvent } from 'react';
import type { MarqueSchema, SchemaMarques } from '@/types/correction';
import styles from './Pastilles.module.css';

export type GenreMarque = 'boites' | 'liens';

/** Une proposition de l'aide IA sur un élément (prof seulement). */
export interface SuggestionMarque {
  valeur: MarqueSchema;
  /** La justification, au survol */
  texte: string;
  ligneId: string;
  /** Déjà validée par le prof (✓) : la pastille est pleine */
  acceptee: boolean;
}

export type SuggestionsMarques = Record<GenreMarque, Record<string, SuggestionMarque>>;

export interface MarquesValue {
  marques: SchemaMarques;
  /** Présent = le prof corrige : les pastilles se cliquent */
  onMarque?: (genre: GenreMarque, id: string) => void;
  /** Les propositions de l'aide IA : pastilles PÂLES tant que non validées */
  suggestions?: SuggestionsMarques;
  /** Clic sur une pastille pâle : le prof valide la proposition */
  onSuggestion?: (ligneId: string) => void;
}

export const MarquesContext = createContext<MarquesValue | null>(null);

/** Le cycle d'un clic : rien → juste → faux → rien. */
export function marqueSuivante(m: MarqueSchema | undefined): MarqueSchema | undefined {
  return m === undefined ? 'ok' : m === 'ok' ? 'faux' : undefined;
}

/** Les pastilles après un clic sur l'élément `id`. */
export function basculerMarque(marques: SchemaMarques, genre: GenreMarque, id: string): SchemaMarques {
  const dico = { ...(marques[genre] ?? {}) };
  const suivante = marqueSuivante(dico[id]);
  if (suivante) dico[id] = suivante;
  else delete dico[id];
  return { ...marques, [genre]: dico };
}

interface Props {
  genre: GenreMarque;
  id: string;
  /** Où la poser : coin de la boîte, ou centrée (sur un lien) */
  place?: 'coin' | 'centre' | 'mot';
}

export function Pastille({ genre, id, place = 'coin' }: Props) {
  const ctx = useContext(MarquesContext);
  if (!ctx) return null;
  const marque = ctx.marques[genre]?.[id];
  const cliquable = !!ctx.onMarque;
  const suggestion = ctx.suggestions?.[genre]?.[id];

  // PROPOSITION de l'IA pas encore validée : pastille pâle, justification au
  // survol, un clic la valide (= ✓ dans le tableau)
  if (!marque && suggestion && !suggestion.acceptee && ctx.onSuggestion) {
    const valider = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      ctx.onSuggestion!(suggestion.ligneId);
    };
    return (
      <button
        type="button"
        className={`nodrag nopan ${styles.pastille} ${styles[place]} ${styles.proposee} ${styles[`propose_${suggestion.valeur}`]} ${styles.cliquable}`}
        onClick={valider}
        onDoubleClick={(e) => e.stopPropagation()}
        title={`${suggestion.texte}\n(proposition — cliquer pour valider)`}
        aria-label={`Proposition de l’IA : ${suggestion.texte}`}
        data-pastille
      >
        {suggestion.valeur === 'ok' ? '✓' : '✗'}
      </button>
    );
  }
  if (!marque && !cliquable) return null;

  const justification = suggestion?.texte ? ` — ${suggestion.texte}` : '';
  const titre =
    (marque === 'ok' ? 'Juste' : marque === 'faux' ? 'Faux' : genre === 'liens' ? 'Marquer ce lien' : 'Marquer cette boîte') +
    (marque ? justification : '');
  const contenu = marque === 'ok' ? '✓' : marque === 'faux' ? '✗' : '';
  const classe = `nodrag nopan ${styles.pastille} ${styles[place]} ${marque ? styles[marque] : styles.vide}`;

  if (!cliquable) {
    return (
      <span className={classe} title={titre} aria-label={titre} data-pastille>
        {contenu}
      </span>
    );
  }
  const onClick = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    ctx.onMarque!(genre, id);
  };
  return (
    <button
      type="button"
      className={`${classe} ${styles.cliquable}`}
      data-pastille
      onClick={onClick}
      onDoubleClick={(e) => e.stopPropagation()}
      title={`${titre} — cliquer : juste, faux, rien`}
      aria-label={titre}
    >
      {contenu}
    </button>
  );
}
