'use client';

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
  // Etat
  disabled?: boolean;
  isLoading?: boolean;
}

export default function VocabulaireList({
  words,
  phase,
  diagnosticSelections,
  onDiagnosticSelect,
  currentSelection,
  onLearningSelect,
  wordMastery,
  disabled = false,
  isLoading = false,
}: VocabulaireListProps) {
  const masteryMap = new Map(wordMastery.map((m) => [m.word, m]));
  const unknownWords = words.filter((w) => getWordCategory(masteryMap.get(w.word)) === 'unknown');
  const misconceivedWords = words.filter((w) => getWordCategory(masteryMap.get(w.word)) === 'misconceived');
  const knownWords = words.filter((w) => getWordCategory(masteryMap.get(w.word)) === 'known');

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
        <div className={styles.info}>
          Clique sur les mots que tu penses connaître
        </div>
        <div className={styles.counter}>
          <span className={styles.counterHighlight}>{diagnosticSelections.length}</span>
          {' '} mot{diagnosticSelections.length > 1 ? 's' : ''} sélectionné{diagnosticSelections.length > 1 ? 's' : ''}
        </div>
        <div className={styles.tagGrid}>
          {words.map((word, idx) => {
            const selected = diagnosticSelections.includes(word.word);
            const tagClass = `${styles.wordTag} ${selected ? styles.tagSelected : ''}`;

            return (
              <div key={`${word.word}-${idx}`} className={styles.tagWrapper}>
                <button
                  type="button"
                  className={tagClass}
                  onClick={() => !disabled && onDiagnosticSelect(word.word)}
                  disabled={disabled}
                >
                  {word.word}
                  {selected && <span className={styles.tagBadge}>✓</span>}
                </button>
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

  // --- Phase diagnostic intermediaire (3 sections, non cliquable) ---
  if (phase === 'diagnostic' && !onDiagnosticSelect) {
    return (
      <div className={`${styles.container} ${disabled ? styles.disabled : ''}`}>
        <div className={styles.info}>
          Diagnostic intermédiaire — état actuel de tes connaissances
        </div>

        {unknownWords.length > 0 && (
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>
              <span className={styles.sectionDot} style={{ background: 'var(--c-text-dim)' }} />
              Inconnus ({unknownWords.length})
            </h4>
            <div className={styles.tagGrid}>
              {unknownWords.map((w, i) => (
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
              <span className={styles.sectionDot} style={{ background: '#e67e22' }} />
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
              <span className={styles.sectionDot} style={{ background: '#27ae60' }} />
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
      </div>
    );
  }

  // --- Phase evaluation ---
  if (phase === 'evaluation') {
    return (
      <div className={`${styles.container} ${disabled ? styles.disabled : ''}`}>
        <div className={styles.info}>
          Évaluation complète : tous les mots seront testés.
        </div>
        <div className={styles.tagGrid}>
          {words.map((word, idx) => (
            <div key={`${word.word}-${idx}`} className={styles.tagWrapper}>
              <span className={`${styles.wordTag} ${styles.tagEvaluation}`}>
                {word.word}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- Phase learning : 3 sections ---

  const renderWordTag = (word: VocabulaireWord, idx: number) => {
    const selected = currentSelection.includes(word.word);
    const category = getWordCategory(masteryMap.get(word.word));
    const canSelect = category !== 'known'; // On ne selectionne pas les mots deja connus

    let tagClass = styles.wordTag;
    if (selected) tagClass += ` ${styles.tagSelected}`;
    if (category === 'known') tagClass += ` ${styles.tagKnown}`;
    if (category === 'misconceived' && !selected) tagClass += ` ${styles.tagMisconceived}`;

    return (
      <div key={`${word.word}-${idx}`} className={styles.tagWrapper}>
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
        <div className={styles.tooltip}>
          <div className={styles.tooltipWord}>{word.word}</div>
          <div className={styles.tooltipDefinition}>{word.definition}</div>
          {word.example && (
            <div className={styles.tooltipExample}>{word.example}</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`${styles.container} ${disabled ? styles.disabled : ''}`}>
      <div className={styles.info}>
        Sélectionne 6 à 10 mots à apprendre pour cette session.
      </div>
      <div className={styles.counter}>
        <span className={styles.counterHighlight}>{currentSelection.length}</span>
        {' / 6-10 mots sélectionnés'}
      </div>

      {/* Section Inconnus */}
      {unknownWords.length > 0 && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>
            <span className={styles.sectionDot} style={{ background: 'var(--c-text-dim)' }} />
            Inconnus ({unknownWords.length})
          </h4>
          <div className={styles.tagGrid}>
            {unknownWords.map((w, i) => renderWordTag(w, i))}
          </div>
        </div>
      )}

      {/* Section Meconnus */}
      {misconceivedWords.length > 0 && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>
            <span className={styles.sectionDot} style={{ background: '#e67e22' }} />
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
            <span className={styles.sectionDot} style={{ background: '#27ae60' }} />
            Connus ({knownWords.length})
          </h4>
          <div className={styles.tagGrid}>
            {knownWords.map((w, i) => renderWordTag(w, i))}
          </div>
        </div>
      )}
    </div>
  );
}
