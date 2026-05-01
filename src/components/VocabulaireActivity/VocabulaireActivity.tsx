'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import VocabulaireList from '@/components/VocabulaireList/VocabulaireList';
import VocabulaireExercises from '@/components/VocabulaireExercises/VocabulaireExercises';
import { useVocabulaireWords } from '@/hooks/useVocabulaireWords';
import { useVocabulaireExercises } from '@/hooks/useVocabulaireExercises';
import type { VocabulaireWord, VocabulaireProgress, WordMastery, ProductionValidation, VocabulaireActivityState } from '@/types/vocabulaire';
import styles from './VocabulaireActivity.module.css';

type FlipSide = 'recto' | 'verso';

interface VocabulaireActivityProps {
  forcedThemes?: string[];
  diagnosticMode?: boolean;
  savedState?: VocabulaireActivityState | null;
  onStateChange?: (state: VocabulaireActivityState) => void;
  disabled?: boolean;
}

export default function VocabulaireActivity({
  forcedThemes,
  diagnosticMode = false,
  savedState,
  onStateChange,
  disabled = false,
}: VocabulaireActivityProps) {
  // Theme impose par le prof (premier theme force)
  const selectedTheme = forcedThemes?.[0] || '';
  const themesToLoad = forcedThemes && forcedThemes.length > 0 ? forcedThemes : null;
  const { words, isLoading: wordsLoading } = useVocabulaireWords(themesToLoad);

  // Selection de mots
  const [selectedWords, setSelectedWords] = useState<VocabulaireWord[]>(
    savedState?.selectedWords || []
  );

  // Diagnostic progress
  const [diagnosticProgress, setDiagnosticProgress] = useState<VocabulaireProgress[]>(
    savedState?.diagnosticProgress || []
  );

  // Exercices IA
  const {
    exercises,
    isGenerating,
    error: exerciseError,
    generate,
    validateProduction,
    reset: resetExercises,
  } = useVocabulaireExercises();

  // Production validation
  const [productionValidation, setProductionValidation] = useState<ProductionValidation | null>(
    savedState?.productionValidation || null
  );
  const [isValidatingProduction, setIsValidatingProduction] = useState(false);

  // Flip recto/verso
  const [side, setSide] = useState<FlipSide>('recto');
  const [animPhase, setAnimPhase] = useState<'idle' | 'out' | 'in'>('idle');
  const [isAnimating, setIsAnimating] = useState(false);

  const flipTo = useCallback((target: FlipSide) => {
    if (target === side || isAnimating) return;
    setIsAnimating(true);
    setAnimPhase('out');
    setTimeout(() => {
      setSide(target);
      setAnimPhase('in');
      setTimeout(() => {
        setAnimPhase('idle');
        setIsAnimating(false);
      }, 280);
    }, 280);
  }, [side, isAnimating]);

  // Notifier le parent des changements d'etat (pour auto-save)
  // Utiliser un ref pour onStateChange afin d'eviter les boucles infinies
  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;
  const prevStateStrRef = useRef<string>('');
  useEffect(() => {
    if (!onStateChangeRef.current) return;
    // Comparer sans lastUpdated pour eviter les faux positifs
    const comparable = {
      selectedTheme,
      selectedWords,
      diagnosticProgress: diagnosticMode ? diagnosticProgress : undefined,
      exercises: exercises.length > 0 ? exercises : undefined,
      productionValidation: productionValidation || undefined,
    };
    const stateStr = JSON.stringify(comparable);
    if (stateStr !== prevStateStrRef.current) {
      prevStateStrRef.current = stateStr;
      onStateChangeRef.current({
        ...comparable,
        lastUpdated: new Date().toISOString(),
      });
    }
  }, [selectedTheme, selectedWords, diagnosticProgress, exercises, productionValidation, diagnosticMode]);

  // Handlers
  const handleWordSelect = useCallback((word: VocabulaireWord) => {
    setSelectedWords((prev) => {
      const exists = prev.some((w) => w.word === word.word);
      if (exists) {
        return prev.filter((w) => w.word !== word.word);
      }
      return [...prev, word];
    });
    resetExercises();
  }, [resetExercises]);

  const handleDiagnosticMark = useCallback((wordText: string, status: WordMastery) => {
    setDiagnosticProgress((prev) => {
      const existing = prev.findIndex((p) => p.word === wordText);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { word: wordText, status };
        return updated;
      }
      return [...prev, { word: wordText, status }];
    });
  }, []);

  const handleGenerate = useCallback(async () => {
    if (selectedWords.length === 0) return;
    const mode = diagnosticMode ? 'diagnostic' : 'apprentissage';
    await generate(selectedWords, mode, [selectedTheme]);
    flipTo('verso');
  }, [selectedWords, diagnosticMode, selectedTheme, generate, flipTo]);

  const handleValidateProduction = useCallback(async (text: string) => {
    const exercise = exercises.find((e) => e.type === 'production_challenge');
    if (!exercise || exercise.type !== 'production_challenge') return;

    setIsValidatingProduction(true);
    const result = await validateProduction(text, exercise.selected_words, exercise.constraint);
    setProductionValidation(result);
    setIsValidatingProduction(false);
  }, [exercises, validateProduction]);

  // Determiner le contenu visible selon le cote
  const flipClass =
    animPhase === 'out' ? styles.flipOut :
    animPhase === 'in' ? styles.flipIn : '';

  return (
    <div className={styles.wrapper}>
      {/* Barre de bascule recto/verso */}
      <div className={styles.flipBar}>
        <div className={styles.flipToggle}>
          <button
            type="button"
            className={`${styles.flipButton} ${side === 'recto' ? styles.flipButtonActive : ''}`}
            onClick={() => flipTo('recto')}
            disabled={isAnimating}
          >
            <span className={styles.flipIcon}>📋</span>
            <span className={styles.flipLabel}>Liste de vocabulaire</span>
          </button>
          <button
            type="button"
            className={`${styles.flipButton} ${side === 'verso' ? styles.flipButtonActive : ''}`}
            onClick={() => flipTo('verso')}
            disabled={isAnimating}
          >
            <span className={styles.flipIcon}>✏️</span>
            <span className={styles.flipLabel}>Exercices</span>
          </button>
        </div>
        <button
          type="button"
          className={styles.flipAction}
          onClick={() => flipTo(side === 'recto' ? 'verso' : 'recto')}
          disabled={isAnimating}
        >
          <span className={`${styles.flipActionIcon} ${isAnimating ? styles.spinning : ''}`}>🔄</span>
          <span className={styles.flipActionText}>Retourner</span>
        </button>
      </div>

      {/* Contenu avec animation flip */}
      <div className={styles.flipContainer}>
        <div className={`${styles.flipCard} ${flipClass}`}>
          <div className={styles.cardFace}>
            {side === 'recto' ? (
              <div className={styles.rectoContent}>
                <VocabulaireList
                  words={words}
                  selectedTheme={selectedTheme}
                  selectedWords={selectedWords}
                  onWordSelect={handleWordSelect}
                  maxSelection={6}
                  diagnosticMode={diagnosticMode}
                  diagnosticProgress={diagnosticProgress}
                  onDiagnosticMark={handleDiagnosticMark}
                  disabled={disabled}
                  isLoading={wordsLoading}
                />
                {/* Bouton generer en bas du recto */}
                {selectedWords.length > 0 && !disabled && (
                  <div className={styles.generateBar}>
                    <button
                      type="button"
                      className={styles.generateBtn}
                      onClick={handleGenerate}
                      disabled={isGenerating}
                    >
                      {isGenerating ? 'Génération en cours...' : `Générer les exercices (${selectedWords.length} mot${selectedWords.length > 1 ? 's' : ''})`}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <VocabulaireExercises
                exercises={exercises}
                selectedWords={selectedWords}
                isGenerating={isGenerating}
                error={exerciseError}
                onGenerate={handleGenerate}
                onValidateProduction={handleValidateProduction}
                productionValidation={productionValidation}
                isValidatingProduction={isValidatingProduction}
                canGenerate={selectedWords.length > 0 && !disabled}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
