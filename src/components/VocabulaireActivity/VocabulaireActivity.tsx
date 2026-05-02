'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import VocabulaireList from '@/components/VocabulaireList/VocabulaireList';
import VocabulaireExercises from '@/components/VocabulaireExercises/VocabulaireExercises';
import { useVocabulaireWords } from '@/hooks/useVocabulaireWords';
import { useVocabulaireExercises } from '@/hooks/useVocabulaireExercises';
import type {
  VocabulaireWord,
  VocabulaireActivityState,
  WordMasteryEntry,
  WordAttempt,
  ExerciseResult,
  ProductionValidation,
  WordFamiliesExercise,
  DefinitionsExercise,
  SynonymsExercise,
  AntonymsExercise,
  DiagnosticScore,
  VocabulaireExercise,
} from '@/types/vocabulaire';
import { categorizeWords, getSpacedRepetitionWords, getWordCategory } from '@/types/vocabulaire';
import styles from './VocabulaireActivity.module.css';

type FlipSide = 'recto' | 'verso';

interface VocabulaireActivityProps {
  forcedThemes?: string[];
  savedState?: VocabulaireActivityState | null;
  onStateChange?: (state: VocabulaireActivityState) => void;
  disabled?: boolean;
}

// --- Helpers pour construire des exercices SANS IA ---

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Exercice 1 : appariement definitions (cote client)
function buildDefinitionsExercise(words: VocabulaireWord[]): DefinitionsExercise {
  const selected = words.slice(0, Math.min(10, words.length));
  return {
    type: 'definitions',
    title: `Exercice 1 : Associez chaque mot à sa définition (${selected.length} associations)`,
    instructions: `Associez chaque définition au terme correspondant. ${selected.length} associations à trouver.`,
    points: 4,
    definitions: selected.map((w, i) => ({
      id: i + 1,
      definition: w.definition,
      correctTerm: w.word,
    })),
    terms: shuffle(selected.map((w) => w.word)),
    answers: selected.map((w, i) => ({
      definitionId: i + 1,
      correctTerm: w.word,
    })),
  };
}

// Exercice 2 : synonymes (cote client, depuis Firestore)
function buildSynonymsExercise(words: VocabulaireWord[]): SynonymsExercise | null {
  // Extraire les mots avec synonymes
  const withSynonyms = words.filter((w) => w.synonyms && w.synonyms !== '—' && w.synonyms.trim());
  if (withSynonyms.length < 3) return null;

  const pairs: { pair: [string, string] }[] = [];
  const pairWords: string[] = [];

  for (const w of withSynonyms) {
    if (pairs.length >= 4) break;
    const syns = w.synonyms!.split(',').map((s) => s.trim()).filter(Boolean);
    if (syns.length > 0) {
      pairs.push({ pair: [w.word, syns[0]] });
      pairWords.push(w.word, syns[0]);
    }
  }

  if (pairs.length < 2) return null;

  // Distracteurs : mots qui ne sont PAS dans les paires
  const distractors = shuffle(
    words.filter((w) => !pairWords.includes(w.word)).map((w) => w.word)
  ).slice(0, 8);

  return {
    type: 'synonyms',
    title: `Exercice 2 : Trouvez les ${pairs.length} paires de synonymes`,
    instructions: `Sélectionnez deux mots pour former une paire de synonymes. Vous devez trouver ${pairs.length} paires.`,
    points: 3,
    words: shuffle([...pairWords, ...distractors]),
    answers: pairs,
  };
}

// Exercice 3 : antonymes (cote client, depuis Firestore)
function buildAntonymsExercise(words: VocabulaireWord[]): AntonymsExercise | null {
  const withAntonyms = words.filter((w) => w.antonyms && w.antonyms !== '—' && w.antonyms.trim());
  if (withAntonyms.length < 2) return null;

  const pairs: { pair: [string, string] }[] = [];
  const pairWords: string[] = [];

  for (const w of withAntonyms) {
    if (pairs.length >= 3) break;
    const ants = w.antonyms!.split(',').map((s) => s.trim()).filter(Boolean);
    if (ants.length > 0) {
      pairs.push({ pair: [w.word, ants[0]] });
      pairWords.push(w.word, ants[0]);
    }
  }

  if (pairs.length < 2) return null;

  const distractors = shuffle(
    words.filter((w) => !pairWords.includes(w.word)).map((w) => w.word)
  ).slice(0, 8);

  return {
    type: 'antonyms',
    title: `Exercice 3 : Trouvez les ${pairs.length} paires d'antonymes`,
    instructions: `Sélectionnez deux mots pour former une paire d'antonymes. Vous devez trouver ${pairs.length} paires.`,
    points: 3,
    words: shuffle([...pairWords, ...distractors]),
    answers: pairs,
  };
}

// Exercice word_families (cote client)
function buildWordFamiliesExercise(words: VocabulaireWord[]): WordFamiliesExercise {
  return {
    type: 'word_families',
    title: 'Familles de mots et relations',
    instructions: 'Explorez les liens entre les mots : familles, synonymes et antonymes',
    word_schemas: words.slice(0, 4).map((w) => ({
      central_word: w.word,
      family_branch: w.wordFamily?.split(',').map((s) => s.trim()).filter(Boolean) || ['—'],
      synonyms_branch: w.synonyms?.split(',').map((s) => s.trim()).filter(Boolean) || ['—'],
      antonyms_branch: w.antonyms?.split(',').map((s) => s.trim()).filter(Boolean) || ['—'],
    })),
  };
}

export default function VocabulaireActivity({
  forcedThemes,
  savedState,
  onStateChange,
  disabled = false,
}: VocabulaireActivityProps) {
  const selectedTheme = forcedThemes?.[0] || '';
  const themesToLoad = forcedThemes && forcedThemes.length > 0 ? forcedThemes : null;
  const { allWords: allThemeWords, isLoading: wordsLoading } = useVocabulaireWords(themesToLoad);

  // State persistant
  const [phase, setPhase] = useState<'diagnostic' | 'learning' | 'evaluation'>(
    savedState?.phase || 'diagnostic'
  );
  const [diagnosticSelections, setDiagnosticSelections] = useState<string[]>(
    savedState?.diagnosticSelections || []
  );
  const [diagnosticCount, setDiagnosticCount] = useState(savedState?.diagnosticCount || 0);
  const [diagnosticScores, setDiagnosticScores] = useState<DiagnosticScore[]>(
    savedState?.diagnosticScores || []
  );
  const [wordMastery, setWordMastery] = useState<WordMasteryEntry[]>(
    savedState?.wordMastery || []
  );
  const [learningSessions, setLearningSessions] = useState(savedState?.learningSessions || 0);
  const [currentSelection, setCurrentSelection] = useState<string[]>(
    savedState?.currentSelection || []
  );
  const [activityOpened, setActivityOpened] = useState(savedState?.activityOpened || 0);
  const [exerciseResults, setExerciseResults] = useState<ExerciseResult[]>([]);
  const [productionValidation, setProductionValidation] = useState<ProductionValidation | null>(
    savedState?.productionValidation || null
  );

  // Exercices construits localement (diagnostic) ou via IA
  const [localExercises, setLocalExercises] = useState<VocabulaireExercise[]>([]);

  // Incrementer activityOpened au premier montage
  const hasOpenedRef = useRef(false);
  useEffect(() => {
    if (!hasOpenedRef.current) {
      hasOpenedRef.current = true;
      setActivityOpened((prev) => prev + 1);
    }
  }, []);

  // Si premier diagnostic pas encore fait, forcer phase diagnostic
  useEffect(() => {
    if (diagnosticCount === 0 && phase !== 'diagnostic') {
      setPhase('diagnostic');
    }
  }, [diagnosticCount, phase]);

  // Exercices IA (pour fill_in_blanks_dropdown + context_sentences)
  const {
    exercises: iaExercises,
    isGenerating,
    error: exerciseError,
    generate,
    validateProduction,
    reset: resetExercises,
  } = useVocabulaireExercises();

  // Les exercices affiches sont soit locaux (diagnostic) soit IA + locaux (learning)
  const displayedExercises = localExercises.length > 0 ? localExercises : iaExercises;

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

  // Categorisation des mots
  const allWordTexts = allThemeWords.map((w) => w.word);
  const categories = categorizeWords(allWordTexts, wordMastery);

  // Notifier le parent (auto-save)
  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;
  const prevStateStrRef = useRef<string>('');

  useEffect(() => {
    if (!onStateChangeRef.current) return;
    const state: VocabulaireActivityState = {
      phase,
      diagnosticSelections,
      diagnosticCount,
      diagnosticScores,
      wordMastery,
      learningSessions,
      currentSelection,
      exercises: displayedExercises.length > 0 ? displayedExercises : undefined,
      exerciseResults: exerciseResults.length > 0 ? exerciseResults : undefined,
      activityOpened,
      productionValidation: productionValidation || undefined,
      lastUpdated: new Date().toISOString(),
    };
    const stateStr = JSON.stringify({ ...state, lastUpdated: undefined });
    if (stateStr !== prevStateStrRef.current) {
      prevStateStrRef.current = stateStr;
      onStateChangeRef.current(state);
    }
  }, [phase, diagnosticSelections, diagnosticCount, diagnosticScores, wordMastery, learningSessions, currentSelection, displayedExercises, exerciseResults, activityOpened, productionValidation]);

  // --- Handlers diagnostic initial ---
  const handleDiagnosticSelect = useCallback((wordText: string) => {
    setDiagnosticSelections((prev) =>
      prev.includes(wordText) ? prev.filter((w) => w !== wordText) : [...prev, wordText]
    );
  }, []);

  // --- Handler selection learning (6-10 mots) ---
  const handleLearningSelect = useCallback((wordText: string) => {
    setCurrentSelection((prev) => {
      if (prev.includes(wordText)) return prev.filter((w) => w !== wordText);
      if (prev.length >= 10) return prev;
      return [...prev, wordText];
    });
    setLocalExercises([]);
    resetExercises();
  }, [resetExercises]);

  // --- Generation exercices diagnostic (principalement cote client) ---
  const generateDiagnosticExercises = useCallback(async (wordsToTest: VocabulaireWord[]) => {
    // Exercices client : definitions, synonymes, antonymes
    const exercises: VocabulaireExercise[] = [];

    exercises.push(buildDefinitionsExercise(wordsToTest));

    const synEx = buildSynonymsExercise(wordsToTest);
    if (synEx) exercises.push(synEx);

    const antEx = buildAntonymsExercise(wordsToTest);
    if (antEx) exercises.push(antEx);

    // Exercices IA : texte a trous dropdown + emploi en contexte
    const result = await generate(wordsToTest, 'diagnostic', [selectedTheme]);
    if (result && result.exercises) {
      // Ne garder que les types IA (fill_in_blanks_dropdown + context_sentences)
      for (const ex of result.exercises) {
        if (ex.type === 'fill_in_blanks_dropdown' || ex.type === 'context_sentences') {
          exercises.push(ex);
        }
      }
    }

    setLocalExercises(exercises);
    setExerciseResults([]);
    flipTo('verso');
  }, [generate, selectedTheme, flipTo]);

  // --- Generation exercices ---
  const handleGenerate = useCallback(async () => {
    if (phase === 'diagnostic') {
      if (diagnosticCount === 0) {
        // Diagnostic initial : tester les mots selectionnes "je connais"
        if (diagnosticSelections.length === 0) return;
        const wordsToTest = allThemeWords.filter((w) => diagnosticSelections.includes(w.word));
        await generateDiagnosticExercises(wordsToTest);
      } else {
        // Diagnostic intermediaire : tester connus + meconnus (automatique)
        const wordsToTest = allThemeWords.filter((w) => {
          const cat = getWordCategory(wordMastery.find((m) => m.word === w.word));
          return cat === 'known' || cat === 'misconceived';
        });
        if (wordsToTest.length === 0) return;
        await generateDiagnosticExercises(wordsToTest);
      }
    } else if (phase === 'learning') {
      if (currentSelection.length < 6) return;
      const selectedWordObjects = allThemeWords.filter((w) => currentSelection.includes(w.word));
      const spacedWordTexts = getSpacedRepetitionWords(wordMastery, currentSelection, 5);
      const spacedWordObjects = allThemeWords.filter((w) => spacedWordTexts.includes(w.word));
      const allLearningWords = [...selectedWordObjects, ...spacedWordObjects];

      const result = await generate(selectedWordObjects, 'apprentissage', [selectedTheme], spacedWordObjects);

      // Construire les exercices finaux : IA + word_families client
      const exercises: VocabulaireExercise[] = [];
      if (result && result.exercises) {
        for (const ex of result.exercises) {
          exercises.push(ex);
          // Inserer word_families apres drag_and_drop
          if (ex.type === 'drag_and_drop') {
            exercises.push(buildWordFamiliesExercise(allLearningWords));
          }
        }
      }
      if (exercises.length > 0) {
        setLocalExercises(exercises);
      }
      setExerciseResults([]);
      setLearningSessions((prev) => prev + 1);
      flipTo('verso');
    } else if (phase === 'evaluation') {
      await generate(allThemeWords, 'evaluation', [selectedTheme]);
      setLocalExercises([]);
      setExerciseResults([]);
      flipTo('verso');
    }
  }, [phase, diagnosticCount, diagnosticSelections, currentSelection, allThemeWords, wordMastery, selectedTheme, generate, flipTo, generateDiagnosticExercises]);

  // --- Diagnostic intermediaire ---
  const handleIntermediateDiagnostic = useCallback(() => {
    setPhase('diagnostic');
    setLocalExercises([]);
    resetExercises();
    setExerciseResults([]);
    // La generation se fera quand l'utilisateur clique "Lancer le diagnostic"
    // (ou on peut le lancer automatiquement)
  }, [resetExercises]);

  // --- Evaluation ---
  const handleEvaluation = useCallback(() => {
    setPhase('evaluation');
    setCurrentSelection([]);
    setLocalExercises([]);
    resetExercises();
  }, [resetExercises]);

  // --- Retour en mode learning ---
  const handleBackToLearning = useCallback(() => {
    setPhase('learning');
    setCurrentSelection([]);
    setLocalExercises([]);
    resetExercises();
  }, [resetExercises]);

  // --- Enregistrement resultats exercices ---
  const handleExerciseResult = useCallback((result: ExerciseResult) => {
    setExerciseResults((prev) => [...prev, result]);

    // Mettre a jour wordMastery
    const now = new Date().toISOString();
    const context = phase === 'diagnostic' ? 'diagnostic' as const :
      phase === 'evaluation' ? 'evaluation' as const : 'learning' as const;

    setWordMastery((prev) => {
      const updated = [...prev];
      for (const { word, correct } of result.results) {
        const attempt: WordAttempt = { date: now, context, correct };
        const existing = updated.find((m) => m.word === word);
        if (existing) {
          existing.attempts = [...existing.attempts, attempt];
        } else {
          updated.push({ word, attempts: [attempt] });
        }
      }
      return updated;
    });
  }, [phase]);

  // --- Fin du diagnostic (tout est une seule session) ---
  const handleDiagnosticComplete = useCallback(() => {
    // Calculer le score du diagnostic complet
    const allResults = exerciseResults.flatMap((r) => r.results);
    const correct = allResults.filter((r) => r.correct).length;
    const total = allResults.length;
    const wordsTested = [...new Set(allResults.map((r) => r.word))];

    const score: DiagnosticScore = {
      date: new Date().toISOString(),
      correct,
      total,
      wordsTested,
    };

    setDiagnosticScores((prev) => [...prev, score]);
    setDiagnosticCount((prev) => prev + 1);
    setPhase('learning');
    setCurrentSelection([]);
    setLocalExercises([]);
    resetExercises();
    setExerciseResults([]);
    flipTo('recto');
  }, [exerciseResults, resetExercises, flipTo]);

  // --- Production validation ---
  const handleValidateProduction = useCallback(async (text: string) => {
    const exercise = displayedExercises.find((e) => e.type === 'production_challenge');
    if (!exercise || exercise.type !== 'production_challenge') return;
    setIsValidatingProduction(true);
    const result = await validateProduction(text, exercise.selected_words, exercise.constraint);
    setProductionValidation(result);
    setIsValidatingProduction(false);
  }, [displayedExercises, validateProduction]);

  // --- Render ---
  const flipClass =
    animPhase === 'out' ? styles.flipOut :
    animPhase === 'in' ? styles.flipIn : '';

  const getGenerateLabel = () => {
    if (phase === 'diagnostic') {
      if (diagnosticCount === 0) {
        return `Vérifier mes connaissances (${diagnosticSelections.length} mot${diagnosticSelections.length > 1 ? 's' : ''})`;
      }
      return 'Lancer le diagnostic intermédiaire';
    }
    if (phase === 'evaluation') {
      return `Lancer l'évaluation (${allThemeWords.length} mots)`;
    }
    return `Générer les exercices (${currentSelection.length} mot${currentSelection.length > 1 ? 's' : ''})`;
  };

  const canGenerate = () => {
    if (disabled) return false;
    if (phase === 'diagnostic') {
      if (diagnosticCount === 0) return diagnosticSelections.length > 0;
      // Diagnostic intermediaire : auto, juste besoin de mots connus/meconnus
      return categories.known.length + categories.misconceived.length > 0;
    }
    if (phase === 'evaluation') return allThemeWords.length > 0;
    return currentSelection.length >= 6;
  };

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
            <span className={styles.flipLabel}>
              {phase === 'diagnostic' && diagnosticCount === 0 ? 'Diagnostic' : 'Mots'}
            </span>
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
                {/* Phase info */}
                <div className={styles.phaseInfo}>
                  {phase === 'diagnostic' && diagnosticCount === 0 && (
                    <p className={styles.phaseDescription}>
                      Clique sur les mots que tu penses connaître, puis vérifie tes connaissances.
                    </p>
                  )}
                  {phase === 'diagnostic' && diagnosticCount > 0 && (
                    <p className={styles.phaseDescription}>
                      Diagnostic intermédiaire : les mots connus et méconnus seront testés.
                    </p>
                  )}
                  {phase === 'learning' && (
                    <p className={styles.phaseDescription}>
                      Sélectionne 6 à 10 mots à apprendre pour cette session.
                    </p>
                  )}
                  {phase === 'evaluation' && (
                    <p className={styles.phaseDescription}>
                      Évaluation complète sur tous les mots de la liste.
                    </p>
                  )}
                </div>

                <VocabulaireList
                  words={allThemeWords}
                  selectedTheme={selectedTheme}
                  phase={phase}
                  diagnosticSelections={diagnosticSelections}
                  onDiagnosticSelect={diagnosticCount === 0 ? handleDiagnosticSelect : undefined}
                  currentSelection={currentSelection}
                  onLearningSelect={handleLearningSelect}
                  wordMastery={wordMastery}
                  disabled={disabled}
                  isLoading={wordsLoading}
                />

                {/* Bouton generer */}
                {canGenerate() && !disabled && (
                  <div className={styles.generateBar}>
                    <button
                      type="button"
                      className={styles.generateBtn}
                      onClick={handleGenerate}
                      disabled={isGenerating}
                    >
                      {isGenerating ? 'Génération en cours...' : getGenerateLabel()}
                    </button>
                  </div>
                )}

                {/* Boutons mode learning */}
                {phase === 'learning' && !disabled && (
                  <div className={styles.actionBar}>
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={handleIntermediateDiagnostic}
                      disabled={isGenerating || categories.known.length + categories.misconceived.length === 0}
                    >
                      Diagnostic intermédiaire
                    </button>
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={handleEvaluation}
                      disabled={isGenerating}
                    >
                      Évaluation
                    </button>
                  </div>
                )}

                {/* Bouton retour si en evaluation */}
                {phase === 'evaluation' && !disabled && (
                  <div className={styles.actionBar}>
                    <button
                      type="button"
                      className={styles.actionBtnSecondary}
                      onClick={handleBackToLearning}
                    >
                      Retour à l&apos;apprentissage
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <VocabulaireExercises
                exercises={displayedExercises}
                isGenerating={isGenerating}
                error={exerciseError}
                onGenerate={handleGenerate}
                onValidateProduction={handleValidateProduction}
                productionValidation={productionValidation}
                isValidatingProduction={isValidatingProduction}
                canGenerate={canGenerate()}
                onExerciseResult={handleExerciseResult}
                onDiagnosticComplete={phase === 'diagnostic' ? handleDiagnosticComplete : undefined}
                phase={phase}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
