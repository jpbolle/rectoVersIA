'use client';

import type { VocabulaireWord, VocabulaireProgress, WordMastery } from '@/types/vocabulaire';
import styles from './VocabulaireList.module.css';

interface VocabulaireListProps {
  words: Record<string, VocabulaireWord[]>;
  selectedTheme: string;
  // Mode apprentissage
  selectedWords: VocabulaireWord[];
  onWordSelect: (word: VocabulaireWord) => void;
  maxSelection?: number;
  // Mode diagnostic
  diagnosticMode?: boolean;
  diagnosticProgress?: VocabulaireProgress[];
  onDiagnosticMark?: (word: string, status: WordMastery) => void;
  // Etat
  disabled?: boolean;
  isLoading?: boolean;
}

export default function VocabulaireList({
  words,
  selectedTheme,
  selectedWords,
  onWordSelect,
  maxSelection = 6,
  diagnosticMode = false,
  diagnosticProgress = [],
  onDiagnosticMark,
  disabled = false,
  isLoading = false,
}: VocabulaireListProps) {
  const currentWords = words[selectedTheme] || [];
  const isSelected = (word: VocabulaireWord) =>
    selectedWords.some((w) => w.word === word.word);

  const getDiagnosticStatus = (wordText: string): WordMastery | null => {
    const progress = diagnosticProgress.find((p) => p.word === wordText);
    return progress?.status || null;
  };

  if (isLoading) {
    return <div className={styles.loading}>Chargement des mots...</div>;
  }

  if (currentWords.length === 0) {
    return <div className={styles.loading}>Aucun mot dans cette série</div>;
  }

  return (
    <div className={`${styles.container} ${disabled ? styles.disabled : ''}`}>
      {/* Info */}
      <div className={styles.info}>
        {diagnosticMode ? (
          <>Cliquez sur les mots pour indiquer votre niveau de connaissance</>
        ) : (
          <>
            Sélectionnez jusqu&apos;à {maxSelection} mots pour générer des exercices
          </>
        )}
      </div>

      {/* Compteur */}
      {!diagnosticMode && (
        <div className={styles.counter}>
          <span className={styles.counterHighlight}>{selectedWords.length}</span>
          {' / '}{maxSelection} mots sélectionnés
        </div>
      )}

      {/* Grille de tags */}
      <div className={styles.tagGrid}>
        {currentWords.map((word, idx) => {
          const selected = isSelected(word);
          const diagStatus = diagnosticMode ? getDiagnosticStatus(word.word) : null;

          let tagClass = styles.wordTag;
          if (diagnosticMode) {
            if (diagStatus === 'known') tagClass += ` ${styles.tagKnown}`;
            else if (diagStatus === 'unknown') tagClass += ` ${styles.tagUnknown}`;
            else if (diagStatus === 'misconceived') tagClass += ` ${styles.tagMisconceived}`;
          } else if (selected) {
            tagClass += ` ${styles.tagSelected}`;
          }

          return (
            <div
              key={`${word.word}-${idx}`}
              className={styles.tagWrapper}
            >
              <button
                type="button"
                className={tagClass}
                onClick={() => {
                  if (disabled) return;
                  if (diagnosticMode && onDiagnosticMark) {
                    const next: WordMastery =
                      diagStatus === null ? 'known' : diagStatus === 'known' ? 'unknown' : 'known';
                    onDiagnosticMark(word.word, next);
                  } else {
                    if (!selected && selectedWords.length >= maxSelection) return;
                    onWordSelect(word);
                  }
                }}
                disabled={disabled}
              >
                {word.word}
                {diagnosticMode && diagStatus && (
                  <span className={styles.tagBadge}>
                    {diagStatus === 'known' ? '\u2713' : '\u2717'}
                  </span>
                )}
              </button>
              {/* Tooltip au survol */}
              <div className={styles.tooltip}>
                <div className={styles.tooltipWord}>{word.word}</div>
                <div className={styles.tooltipDefinition}>{word.definition}</div>
                {word.example && (
                  <div className={styles.tooltipExample}>{word.example}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
