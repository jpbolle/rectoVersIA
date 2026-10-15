'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { VocabulaireWord, WordMasteryEntry } from '@/types/vocabulaire';
import { getWordCategory } from '@/types/vocabulaire';
import styles from './VocabulaireList.module.css';

interface VocabulaireListProps {
  words: VocabulaireWord[];
  selectedTheme: string;
  // Phase courante
  phase: 'diagnostic' | 'learning' | 'evaluation';
  // Diagnostic : mots que l'eleve pense connaitre
  diagnosticSelections: string[];
  onDiagnosticSelect?: (wordText: string) => void;
  // Learning : mots choisis pour la session
  currentSelection: string[];
  onLearningSelect?: (wordText: string) => void;
  // Suivi de maitrise
  wordMastery: WordMasteryEntry[];
  // Mots que l'élève a décochés au diagnostic initial (« je ne connais pas »)
  motsInconnus?: string[];
  // Diagnostic lancé : les lots des manches sont tirés, la sélection ne bouge plus
  selectionFigee?: boolean;
  // Etat
  disabled?: boolean;
  isLoading?: boolean;
  // Bouton generer (injecte par le parent)
  generateButton?: React.ReactNode;
  // Flashcards (injecte par le parent, affiche au dessus des sections)
  flashcardsSlot?: React.ReactNode;
}

export default function VocabulaireList({
  words,
  phase,
  diagnosticSelections,
  onDiagnosticSelect,
  currentSelection,
  onLearningSelect,
  wordMastery,
  motsInconnus = [],
  selectionFigee = false,
  disabled = false,
  isLoading = false,
  generateButton,
  flashcardsSlot,
}: VocabulaireListProps) {
  const masteryMap = new Map(wordMastery.map((m) => [m.word, m]));
  const unknownWords = words.filter((w) => getWordCategory(masteryMap.get(w.word)) === 'unknown');
  const misconceivedWords = words.filter((w) => getWordCategory(masteryMap.get(w.word)) === 'misconceived');
  const knownWords = words.filter((w) => getWordCategory(masteryMap.get(w.word)) === 'known');
  // Quatre états, quatre couleurs (JP, 2026-10-15) : connu = vert, méconnu =
  // orange, inconnu = rouge (décoché au diagnostic, jamais testé depuis),
  // non traité = blanc (jamais testé, jamais déclaré)
  const declares = new Set(motsInconnus);
  const inconnusDeclares = unknownWords.filter((w) => declares.has(w.word));
  const nonTraites = unknownWords.filter((w) => !declares.has(w.word));

  // ── Bulle de définition (cadre noir) ──
  // Rendue dans <body>, en position fixe : la liste est une zone qui défile
  // (overflow), qui coupait les bulles de la première rangée sous le bandeau
  // (signalé par un prof le 2026-10-15). Au ras du haut, elle passe dessous.
  const [bulle, setBulle] = useState<{ word: VocabulaireWord; x: number; y: number; dessous: boolean } | null>(null);

  useEffect(() => {
    if (!bulle) return;
    const cacher = () => setBulle(null);
    window.addEventListener('scroll', cacher, true);
    return () => window.removeEventListener('scroll', cacher, true);
  }, [bulle]);

  const survol = (word: VocabulaireWord) => ({
    onMouseEnter: (e: React.MouseEvent<HTMLDivElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      const dessous = r.top < 200;
      const x = Math.min(Math.max(r.left + r.width / 2, 160), window.innerWidth - 160);
      setBulle({ word, x, y: dessous ? r.bottom + 8 : r.top - 8, dessous });
    },
    onMouseLeave: () => setBulle(null),
  });

  const bulleFlottante =
    bulle && typeof document !== 'undefined'
      ? createPortal(
          <div
            className={`${styles.tooltip} ${bulle.dessous ? styles.tooltipDessous : ''}`}
            style={{ left: bulle.x, top: bulle.y }}
          >
            <div className={styles.tooltipWord}>{bulle.word.word}</div>
            <div className={styles.tooltipDefinition}>{bulle.word.definition}</div>
            {bulle.word.example && <div className={styles.tooltipExample}>{bulle.word.example}</div>}
          </div>,
          document.body
        )
      : null;

  if (isLoading) {
    return <div className={styles.loading}>Chargement des mots...</div>;
  }

  if (words.length === 0) {
    return <div className={styles.loading}>Aucun mot dans cette série</div>;
  }

  // --- Phase diagnostic initial (premier diagnostic, cliquable) ---
  if (phase === 'diagnostic' && onDiagnosticSelect) {
    return (
      <div className={`${styles.container} ${disabled ? styles.disabled : ''}`}>
        {(() => {
          // Sélection figée : elle se relit dans les mots déclarés inconnus au
          // lancement (diagnosticSelections, elle, repart à « tout coché »)
          const aVerifier = selectionFigee ? words.length - inconnusDeclares.length : diagnosticSelections.length;
          const decoches = words.length - aVerifier;
          return (
            <div className={styles.counter}>
              {selectionFigee && 'Diagnostic en cours, sélection figée : '}
              <span className={styles.counterHighlight}>{aVerifier}</span>
              {' '}mot{aVerifier > 1 ? 's' : ''} à vérifier
              {decoches > 0 && ` · ${decoches} décoché${decoches > 1 ? 's' : ''} (je ne connais pas)`}
            </div>
          );
        })()}
        <div className={styles.tagGrid}>
          {words.map((word, idx) => {
            const selected = selectionFigee ? !declares.has(word.word) : diagnosticSelections.includes(word.word);
            // Coché = « connu, à vérifier » ; décoché = l'élève dit ne pas le
            // connaître → couleur des mots inconnus (JP, 2026-10-15)
            const tagClass = `${styles.wordTag} ${selected ? styles.tagAVerifier : styles.tagUnknown}`;

            return (
              <div key={`${word.word}-${idx}`} className={styles.tagWrapper} {...survol(word)}>
                {selectionFigee ? (
                  <span className={`${tagClass} ${styles.tagFige}`}>
                    {word.word}
                    {selected && <span className={styles.tagBadge}>✓</span>}
                  </span>
                ) : (
                  <button
                    type="button"
                    className={tagClass}
                    onClick={() => !disabled && onDiagnosticSelect(word.word)}
                    disabled={disabled}
                  >
                    {word.word}
                    {selected && <span className={styles.tagBadge}>✓</span>}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {generateButton}
        {bulleFlottante}
      </div>
    );
  }

  // --- Phase diagnostic intermediaire (3 sections, non cliquable) ---
  if (phase === 'diagnostic' && !onDiagnosticSelect) {
    return (
      <div className={`${styles.container} ${disabled ? styles.disabled : ''}`}>
        <div className={styles.info}>
          Diagnostic intermédiaire — état actuel de tes connaissances
        </div>

        {inconnusDeclares.length > 0 && (
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>
              <span className={`${styles.sectionDot} ${styles.dotInconnu}`} />
              Inconnus ({inconnusDeclares.length})
            </h4>
            <div className={styles.tagGrid}>
              {inconnusDeclares.map((w, i) => (
                <div key={`${w.word}-${i}`} className={styles.tagWrapper}>
                  <span className={`${styles.wordTag} ${styles.tagUnknown}`}>{w.word}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {nonTraites.length > 0 && (
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>
              <span className={`${styles.sectionDot} ${styles.dotNonTraite}`} />
              Non traités ({nonTraites.length})
            </h4>
            <div className={styles.tagGrid}>
              {nonTraites.map((w, i) => (
                <div key={`${w.word}-${i}`} className={styles.tagWrapper}>
                  <span className={`${styles.wordTag} ${styles.tagDisabled}`}>{w.word}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {misconceivedWords.length > 0 && (
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>
              <span className={`${styles.sectionDot} ${styles.dotMeconnu}`} />
              Méconnus ({misconceivedWords.length})
            </h4>
            <div className={styles.tagGrid}>
              {misconceivedWords.map((w, i) => (
                <div key={`${w.word}-${i}`} className={styles.tagWrapper}>
                  <span className={`${styles.wordTag} ${styles.tagMisconceived}`}>{w.word}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {knownWords.length > 0 && (
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>
              <span className={`${styles.sectionDot} ${styles.dotConnu}`} />
              Connus ({knownWords.length})
            </h4>
            <div className={styles.tagGrid}>
              {knownWords.map((w, i) => (
                <div key={`${w.word}-${i}`} className={styles.tagWrapper}>
                  <span className={`${styles.wordTag} ${styles.tagKnown}`}>{w.word}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {generateButton}
      </div>
    );
  }

  // --- Phase evaluation ---
  if (phase === 'evaluation') {
    return (
      <div className={`${styles.container} ${disabled ? styles.disabled : ''}`}>
        <div className={styles.tagGrid}>
          {words.map((word, idx) => (
            <div key={`${word.word}-${idx}`} className={styles.tagWrapper}>
              <span className={`${styles.wordTag} ${styles.tagEvaluation}`}>
                {word.word}
              </span>
            </div>
          ))}
        </div>
        {generateButton}
      </div>
    );
  }

  // --- Phase learning : 3 sections ---

  const renderWordTag = (word: VocabulaireWord, idx: number) => {
    const selected = currentSelection.includes(word.word);
    const category = getWordCategory(masteryMap.get(word.word));
    const canSelect = true; // Tous les mots sont selectionnables (y compris connus, pour consolider)

    let tagClass = styles.wordTag;
    if (selected) tagClass += ` ${styles.tagSelected}`;
    if (category === 'known') tagClass += ` ${styles.tagKnown}`;
    if (category === 'misconceived' && !selected) tagClass += ` ${styles.tagMisconceived}`;
    if (category === 'unknown' && declares.has(word.word) && !selected) tagClass += ` ${styles.tagUnknown}`;

    return (
      <div key={`${word.word}-${idx}`} className={styles.tagWrapper} {...survol(word)}>
        <button
          type="button"
          className={tagClass}
          onClick={() => {
            if (disabled || !canSelect) return;
            onLearningSelect?.(word.word);
          }}
          disabled={disabled || !canSelect}
        >
          {word.word}
          {selected && <span className={styles.tagBadge}>✓</span>}
        </button>
      </div>
    );
  };

  return (
    <div className={`${styles.container} ${disabled ? styles.disabled : ''}`}>
      <div className={styles.counter}>
        <span className={styles.counterHighlight}>{currentSelection.length}</span>
        {' / 6-10 mots sélectionnés'}
      </div>

      {/* Flashcards (affichage des mots difficiles) — au-dessus des 3 sections */}
      {flashcardsSlot}

      {/* Section Inconnus (décochés au diagnostic) */}
      {inconnusDeclares.length > 0 && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>
            <span className={`${styles.sectionDot} ${styles.dotInconnu}`} />
            Inconnus ({inconnusDeclares.length})
          </h4>
          <div className={styles.tagGrid}>
            {inconnusDeclares.map((w, i) => renderWordTag(w, i))}
          </div>
        </div>
      )}

      {/* Section Non traités (jamais testés, jamais déclarés) */}
      {nonTraites.length > 0 && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>
            <span className={`${styles.sectionDot} ${styles.dotNonTraite}`} />
            Non traités ({nonTraites.length})
          </h4>
          <div className={styles.tagGrid}>
            {nonTraites.map((w, i) => renderWordTag(w, i))}
          </div>
        </div>
      )}

      {/* Section Meconnus */}
      {misconceivedWords.length > 0 && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>
            <span className={`${styles.sectionDot} ${styles.dotMeconnu}`} />
            Méconnus ({misconceivedWords.length})
          </h4>
          <div className={styles.tagGrid}>
            {misconceivedWords.map((w, i) => renderWordTag(w, i))}
          </div>
        </div>
      )}

      {/* Section Connus */}
      {knownWords.length > 0 && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>
            <span className={`${styles.sectionDot} ${styles.dotConnu}`} />
            Connus ({knownWords.length})
          </h4>
          <div className={styles.tagGrid}>
            {knownWords.map((w, i) => renderWordTag(w, i))}
          </div>
        </div>
      )}
      {generateButton}
      {bulleFlottante}
    </div>
  );
}
