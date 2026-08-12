'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import VocabulaireList from '@/components/VocabulaireList/VocabulaireList';
import VocabulaireExercises from '@/components/VocabulaireExercises/VocabulaireExercises';
import VocabulaireEvaluation from '@/components/VocabulaireEvaluation/VocabulaireEvaluation';
import EvalAttemptView from '@/components/VocabulaireEvaluation/EvalAttemptView';
import { useVocabulaireWords } from '@/hooks/useVocabulaireWords';
import { useVocabulaireExercises } from '@/hooks/useVocabulaireExercises';
import { useAuth } from '@/hooks/useAuth';
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
  CrosswordExercise,
  SynonymAntonymTextExercise,
  EvaluationCompositionExercise,
  EvaluationScore,
} from '@/types/vocabulaire';
import { categorizeWords, getSpacedRepetitionWords, getWordCategory, removeAccents } from '@/types/vocabulaire';
import styles from './VocabulaireActivity.module.css';

type FlipSide = 'recto' | 'verso';

interface VocabulaireActivityProps {
  forcedThemes?: string[];
  savedState?: VocabulaireActivityState | null;
  onStateChange?: (state: VocabulaireActivityState) => void;
  disabled?: boolean;
  // Visualisation d'une evaluation passee (declenche depuis la colonne de droite)
  viewingEvalAttempt?: import('@/types/vocabulaire').EvaluationAttempt | null;
  viewingEvalIndex?: number | null;
  onCloseEvalView?: () => void;
  // Permet a l'eleve de basculer vers l'onglet "Evaluation" de la sidebar
  // (utilise par le bouton "Etat de mes connaissances" en fin de diagnostic intermediaire)
  onShowEvaluationTab?: () => void;
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

// Construire l'exercice de mots croises (cote client, async car import dynamique)
async function buildCrosswordExercise(words: VocabulaireWord[]): Promise<CrosswordExercise> {
  // Limiter a 15 mots maximum (melanger pour varier)
  const shuffled = [...words].sort(() => Math.random() - 0.5);
  const limited = shuffled.slice(0, Math.min(15, shuffled.length));

  // Preparer les mots pour le generateur (sans accents, majuscules)
  const input = limited.map((w) => ({
    answer: removeAccents(w.word).toUpperCase().replace(/[\s-]/g, ''),
    clue: w.definition,
    displayWord: w.word,
  }));

  // Import dynamique du generateur de grille
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { generateLayout } = require('crossword-layout-generator') as {
    generateLayout: (words: { answer: string; clue: string }[]) => {
      result: Array<{ answer: string; clue: string; startx?: number; starty?: number; orientation: string; position?: number }>;
      rows: number;
      cols: number;
    };
  };

  const layout = generateLayout(input.map((i) => ({ answer: i.answer, clue: i.clue })));

  const placedWords: CrosswordExercise['words'] = [];
  const unplacedWords: CrosswordExercise['unplacedWords'] = [];

  for (let i = 0; i < layout.result.length; i++) {
    const item = layout.result[i];
    const original = input[i];
    if (item.orientation === 'across' || item.orientation === 'down') {
      placedWords.push({
        answer: item.answer,
        displayWord: original.displayWord,
        clue: item.clue,
        startx: item.startx!,
        starty: item.starty!,
        orientation: item.orientation,
        position: item.position!,
      });
    } else {
      unplacedWords.push({ word: original.displayWord, clue: item.clue });
    }
  }

  return {
    type: 'crossword',
    title: 'Activité 1 : Mots croisés',
    instructions: 'Complète la grille à l\'aide des définitions. Utilise les flèches du clavier pour naviguer.',
    words: placedWords,
    unplacedWords: unplacedWords.length > 0 ? unplacedWords : undefined,
    gridRows: layout.rows,
    gridCols: layout.cols,
  };
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
    word_schemas: words.map((w) => ({
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
  viewingEvalAttempt = null,
  viewingEvalIndex = null,
  onCloseEvalView,
  onShowEvaluationTab,
}: VocabulaireActivityProps) {
  const selectedTheme = forcedThemes?.[0] || '';
  const themesToLoad = forcedThemes && forcedThemes.length > 0 ? forcedThemes : null;
  const { allWords: allThemeWords, isLoading: wordsLoading } = useVocabulaireWords(themesToLoad);
  const { getAuthHeaders } = useAuth();

  // State persistant
  // Au retour, toujours repartir en learning (sauf si diagnostic initial jamais fait)
  const [phase, setPhase] = useState<'diagnostic' | 'learning' | 'evaluation'>(
    (savedState?.diagnosticCount || 0) === 0 ? 'diagnostic' : 'learning'
  );
  const [diagnosticSelections, setDiagnosticSelections] = useState<string[]>([]);
  const [diagnosticCount, setDiagnosticCount] = useState(savedState?.diagnosticCount || 0);
  const [diagnosticScores, setDiagnosticScores] = useState<DiagnosticScore[]>(
    savedState?.diagnosticScores || []
  );
  const [wordMastery, setWordMastery] = useState<WordMasteryEntry[]>(
    savedState?.wordMastery || []
  );
  const [learningSessions, setLearningSessions] = useState(savedState?.learningSessions || 0);
  const [currentSelection, setCurrentSelection] = useState<string[]>([]);
  const [activityOpened, setActivityOpened] = useState(savedState?.activityOpened || 0);
  const [exerciseResults, setExerciseResults] = useState<ExerciseResult[]>([]);
  const [productionValidation, setProductionValidation] = useState<ProductionValidation | null>(
    savedState?.productionValidation || null
  );

  // Evaluation (interro)
  const [evaluationScores, setEvaluationScores] = useState<EvaluationScore[]>(
    savedState?.evaluationScores || []
  );
  const [evaluationExercises, setEvaluationExercises] = useState<{
    crossword: CrosswordExercise;
    synonymAntonymText: SynonymAntonymTextExercise;
    composition: EvaluationCompositionExercise;
  } | null>(null);
  const [evaluationAttempts, setEvaluationAttempts] = useState<import('@/types/vocabulaire').EvaluationAttempt[]>(
    savedState?.evaluationAttempts || []
  );
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [showEvalBlockPopup, setShowEvalBlockPopup] = useState(false);
  const [isGeneratingEval, setIsGeneratingEval] = useState(false);

  // Exercices construits localement (diagnostic) ou via IA
  const [localExercises, setLocalExercises] = useState<VocabulaireExercise[]>([]);

  // Flashcards d'etude
  // difficultWords = liste persistante des mots mis en favoris par l'eleve
  // showFlashcards = visibilite (transitoire) du panneau
  const [difficultWords, setDifficultWords] = useState<string[]>(savedState?.difficultWords || []);
  const [showFlashcards, setShowFlashcards] = useState((savedState?.difficultWords || []).length > 0);
  const [flashcardsDefinitionFirst, setFlashcardsDefinitionFirst] = useState(savedState?.flashcardsDefinitionFirst ?? true);
  const [flashcardsLarge, setFlashcardsLarge] = useState(false);
  const [flashcardIndex, setFlashcardIndex] = useState(0);

  // Incrementer activityOpened au premier montage
  const hasOpenedRef = useRef(false);
  useEffect(() => {
    if (!hasOpenedRef.current) {
      hasOpenedRef.current = true;
      setActivityOpened((prev) => prev + 1);
    }
  }, []);

  // Chronometre : temps actif cumule (une seconde comptee seulement si l'onglet
  // est visible). timeTick force une sauvegarde toutes les 30 s d'activite pour
  // que le temps persiste meme sans autre changement d'etat.
  const baseTimeRef = useRef(savedState?.timeSpentSeconds || 0);
  const sessionSecondsRef = useRef(0);
  const [timeTick, setTimeTick] = useState(0);
  useEffect(() => {
    if (disabled) return;
    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      sessionSecondsRef.current += 1;
      if (sessionSecondsRef.current % 30 === 0) setTimeTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [disabled]);

  // Si premier diagnostic pas encore fait, forcer phase diagnostic
  useEffect(() => {
    if (diagnosticCount === 0 && phase !== 'diagnostic') {
      setPhase('diagnostic');
    }
  }, [diagnosticCount, phase]);

  // Auto-fermer les flashcards et la popup quand la liste des favoris devient vide
  useEffect(() => {
    if (difficultWords.length === 0) {
      if (showFlashcards) setShowFlashcards(false);
      if (flashcardsLarge) setFlashcardsLarge(false);
    }
  }, [difficultWords.length, showFlashcards, flashcardsLarge]);

  // Clamp l'index si la liste de favoris retrecit
  useEffect(() => {
    if (flashcardIndex >= difficultWords.length && difficultWords.length > 0) {
      setFlashcardIndex(0);
    }
  }, [difficultWords.length, flashcardIndex]);

  // Navigation clavier en mode popup
  useEffect(() => {
    if (!flashcardsLarge) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFlashcardsLarge(false);
      } else if (e.key === 'ArrowLeft') {
        setFlashcardIndex((i) => Math.max(0, i - 1));
      } else if (e.key === 'ArrowRight') {
        setFlashcardIndex((i) => Math.min(difficultWords.length - 1, i + 1));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [flashcardsLarge, difficultWords.length]);

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
  const [exercisesAllCompleted, setExercisesAllCompleted] = useState(false);

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
      timeSpentSeconds: baseTimeRef.current + sessionSecondsRef.current,
      productionValidation: productionValidation || undefined,
      evaluationScores: evaluationScores.length > 0 ? evaluationScores : undefined,
      evaluationAttempts: evaluationAttempts.length > 0 ? evaluationAttempts : undefined,
      difficultWords: difficultWords.length > 0 ? difficultWords : undefined,
      flashcardsDefinitionFirst,
      lastUpdated: new Date().toISOString(),
    };
    const stateStr = JSON.stringify({ ...state, lastUpdated: undefined });
    if (stateStr !== prevStateStrRef.current) {
      prevStateStrRef.current = stateStr;
      onStateChangeRef.current(state);
    }
  }, [phase, diagnosticSelections, diagnosticCount, diagnosticScores, wordMastery, learningSessions, currentSelection, displayedExercises, exerciseResults, activityOpened, timeTick, productionValidation, evaluationScores, evaluationAttempts, difficultWords, flashcardsDefinitionFirst]);

  // --- Handlers diagnostic initial ---
  const handleDiagnosticSelect = useCallback((wordText: string) => {
    setDiagnosticSelections((prev) =>
      prev.includes(wordText) ? prev.filter((w) => w !== wordText) : [...prev, wordText]
    );
  }, []);

  // --- Handler selection learning (6-10 mots) ---
  const [selectionHint, setSelectionHint] = useState<string | null>(null);
  const selectionHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLearningSelect = useCallback((wordText: string) => {
    setCurrentSelection((prev) => {
      if (prev.includes(wordText)) {
        // Deselection — cacher le hint s'il est visible
        setSelectionHint(null);
        return prev.filter((w) => w !== wordText);
      }
      if (prev.length >= 10) {
        // Limite atteinte — afficher un hint
        setSelectionHint('Tu as atteint la limite de 10 mots. Désélectionne d\'abord des mots pour en choisir de nouveaux.');
        if (selectionHintTimer.current) clearTimeout(selectionHintTimer.current);
        selectionHintTimer.current = setTimeout(() => setSelectionHint(null), 4000);
        return prev;
      }
      return [...prev, wordText];
    });
    setLocalExercises([]);
    resetExercises();
  }, [resetExercises]);

  // Retrait d'une flashcard = retrait du mot des favoris persistants
  const handleRemoveFlashcard = useCallback((wordText: string) => {
    setDifficultWords((prev) => prev.filter((w) => w !== wordText));
  }, []);

  // Bouton "Afficher les mots difficiles" : promeut la selection courante en favoris persistants,
  // vide la selection (pour ne pas melanger avec "Generer"), et ouvre le panneau.
  const handleToggleDifficult = useCallback(() => {
    if (currentSelection.length > 0) {
      setDifficultWords((prev) => {
        const next = [...prev];
        for (const w of currentSelection) {
          if (!next.includes(w)) next.push(w);
        }
        return next;
      });
      setCurrentSelection([]);
      setLocalExercises([]);
      resetExercises();
    }
    setShowFlashcards(true);
  }, [currentSelection, resetExercises]);

  // --- Generation exercices diagnostic (principalement cote client) ---
  const generateDiagnosticExercises = useCallback(async (wordsToTest: VocabulaireWord[]) => {
    const exercises: VocabulaireExercise[] = [];

    // 1. Definitions (client)
    exercises.push(buildDefinitionsExercise(wordsToTest));

    // 2. Synonymes (client)
    const synEx = buildSynonymsExercise(wordsToTest);
    if (synEx) exercises.push(synEx);

    // Exercices IA : texte a trous dropdown + emploi en contexte
    const result = await generate(wordsToTest, 'diagnostic', [selectedTheme]);

    // 3. Texte a trous avec menu deroulant (IA)
    if (result && result.exercises) {
      for (const ex of result.exercises) {
        if (ex.type === 'fill_in_blanks_dropdown') {
          exercises.push(ex);
        }
      }
    }

    // 4. Antonymes (client)
    const antEx = buildAntonymsExercise(wordsToTest);
    if (antEx) exercises.push(antEx);

    // 5. Emploi en contexte (IA)
    if (result && result.exercises) {
      for (const ex of result.exercises) {
        if (ex.type === 'context_sentences') {
          exercises.push(ex);
        }
      }
    }

    setLocalExercises(exercises);
    setExerciseResults([]);
    setExercisesAllCompleted(false);
    setProductionValidation(null);
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

      // Mots du dictionnaire personnel de l'eleve : 3 a 5 au hasard, hors doublons.
      // Liste vide ou indisponible : on genere sans.
      let personalWordObjects: VocabulaireWord[] = [];
      try {
        const headers = await getAuthHeaders();
        if (headers) {
          const res = await fetch('/api/vocabulaire/personnel', { headers });
          const json = await res.json();
          if (json.success) {
            const alreadyUsed = new Set(
              [...currentSelection, ...spacedWordTexts].map((w) => w.toLowerCase())
            );
            const candidates = ((json.data?.words || []) as { word?: string; definition?: string; example?: string }[])
              .filter((w) => w.word && w.definition && !alreadyUsed.has(w.word.toLowerCase()));
            const target = 3 + Math.floor(Math.random() * 3); // 3 a 5
            personalWordObjects = shuffle(candidates)
              .slice(0, target)
              .map((w) => ({ word: w.word!, definition: w.definition!, example: w.example || '' }));
          }
        }
      } catch (err) {
        console.error('Vocabulaire personnel indisponible:', err);
      }

      const allLearningWords = [...selectedWordObjects, ...spacedWordObjects, ...personalWordObjects];

      const result = await generate(selectedWordObjects, 'apprentissage', [selectedTheme], spacedWordObjects, personalWordObjects);

      // Ordre : 1. texte (IA), 2. dropdown (IA), 3. definitions (client), 4. word_families (client), 5. fill_in_blanks (IA), 6. production (IA)
      const exercises: VocabulaireExercise[] = [];
      if (result && result.exercises) {
        const iaExs = result.exercises;
        const textEx = iaExs.find((e) => e.type === 'text_with_definitions');
        const dropdownEx = iaExs.find((e) => e.type === 'fill_in_blanks_dropdown');
        const fillEx = iaExs.find((e) => e.type === 'fill_in_blanks');
        const prodEx = iaExs.find((e) => e.type === 'production_challenge');

        if (textEx) exercises.push(textEx);
        if (dropdownEx) exercises.push(dropdownEx);
        // Melange avant le plafond a 10 mots, pour que revision et personnels soient testes
        exercises.push(buildDefinitionsExercise(shuffle(allLearningWords))); // client
        // Pas les mots personnels : ils n'ont ni famille, ni synonymes, ni antonymes
        exercises.push(buildWordFamiliesExercise([...selectedWordObjects, ...spacedWordObjects])); // client
        if (fillEx) exercises.push(fillEx);
        if (prodEx) exercises.push(prodEx);
      }
      // Renumeroter les titres
      for (let i = 0; i < exercises.length; i++) {
        exercises[i] = { ...exercises[i], title: exercises[i].title.replace(/^Exercice \d+/, `Exercice ${i + 1}`) };
      }
      if (exercises.length > 0) {
        setLocalExercises(exercises);
      }
      setExerciseResults([]);
      setExercisesAllCompleted(false);
      setProductionValidation(null);
      setLearningSessions((prev) => prev + 1);
      flipTo('verso');
    }
    // L'evaluation n'utilise plus handleGenerate — elle a son propre flux
  }, [phase, diagnosticCount, diagnosticSelections, currentSelection, allThemeWords, wordMastery, selectedTheme, generate, flipTo, generateDiagnosticExercises, getAuthHeaders]);

  // --- Diagnostic intermediaire — generation directe (pas de page intermediaire) ---
  const handleIntermediateDiagnostic = useCallback(async () => {
    setPhase('diagnostic');
    setLocalExercises([]);
    resetExercises();
    setExerciseResults([]);
    setExercisesAllCompleted(false);
    setProductionValidation(null);

    const wordsToTest = allThemeWords.filter((w) => {
      const cat = getWordCategory(wordMastery.find((m) => m.word === w.word));
      return cat === 'known' || cat === 'misconceived';
    });
    if (wordsToTest.length === 0) return;
    await generateDiagnosticExercises(wordsToTest);
  }, [resetExercises, allThemeWords, wordMastery, generateDiagnosticExercises]);

  // --- Evaluation : verification condition d'acces puis generation ---
  const handleEvaluation = useCallback(async () => {
    const total = allWordTexts.length;
    if (total === 0) return;

    // Condition 1 : 70% des mots dans connus ou meconnus
    const knownAndMisconceived = categories.known.length + categories.misconceived.length;
    const pctKnownMisconceived = knownAndMisconceived / total;

    // Condition 2 : parmi ces 70%, 50% doivent etre connus
    const pctKnownAmongTested = knownAndMisconceived > 0
      ? categories.known.length / knownAndMisconceived
      : 0;

    if (pctKnownMisconceived < 0.7 || pctKnownAmongTested < 0.5) {
      setShowEvalBlockPopup(true);
      return;
    }

    // Condition verifiee : generer l'evaluation
    setIsGeneratingEval(true);

    try {
      // 1. Mots croises (client) — uniquement mots connus + meconnus
      const evalWords = allThemeWords.filter((w) => {
        const cat = getWordCategory(wordMastery.find((m) => m.word === w.word));
        return cat === 'known' || cat === 'misconceived';
      });
      const crossword = await buildCrosswordExercise(evalWords);

      // 2. Exercices IA (synonymes/antonymes texte + composition)
      const headers = await getAuthHeaders();
      const response = await fetch('/api/vocabulaire/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          words: evalWords,
          mode: 'evaluation',
          themes: [selectedTheme],
        }),
      });
      const data = await response.json();

      if (!data.success) {
        console.error('Erreur generation evaluation:', data.message);
        setIsGeneratingEval(false);
        return;
      }

      const iaExercises = data.data.exercises || [];
      const synAntEx = iaExercises.find((e: VocabulaireExercise) => e.type === 'synonym_antonym_text') as SynonymAntonymTextExercise | undefined;
      const compEx = iaExercises.find((e: VocabulaireExercise) => e.type === 'evaluation_composition') as EvaluationCompositionExercise | undefined;

      if (!synAntEx || !compEx) {
        console.error('Exercices evaluation incomplets');
        setIsGeneratingEval(false);
        return;
      }

      setEvaluationExercises({ crossword, synonymAntonymText: synAntEx, composition: compEx });
      setShowEvaluation(true);
      setPhase('evaluation');
    } finally {
      setIsGeneratingEval(false);
    }
  }, [allWordTexts, categories, allThemeWords, wordMastery, selectedTheme, getAuthHeaders]);

  // --- Tentative evaluation soumise ---
  const handleEvalSubmitAttempt = useCallback((attempt: import('@/types/vocabulaire').EvaluationAttempt) => {
    setEvaluationScores((prev) => [...prev, attempt.score]);
    setEvaluationAttempts((prev) => [...prev, attempt]);
  }, []);

  // --- Retour apprentissage depuis evaluation ---
  const handleEvalBackToLearning = useCallback(() => {
    setShowEvaluation(false);
    setEvaluationExercises(null);
    setPhase('learning');
    setCurrentSelection([]);
    setLocalExercises([]);
    resetExercises();
  }, [resetExercises]);

  // L'eleve ne peut pas recommencer directement — il doit repasser par l'apprentissage

  // handleBackToLearning est gere par handleEvalBackToLearning pour l'evaluation

  // --- Enregistrement resultats exercices ---
  const handleExerciseResult = useCallback((result: ExerciseResult) => {
    setExerciseResults((prev) => [...prev, result]);

    // Mettre a jour wordMastery
    const now = new Date().toISOString();
    const context = phase === 'diagnostic' ? 'diagnostic' as const :
      phase === 'evaluation' ? 'evaluation' as const : 'learning' as const;

    setWordMastery((prev) => {
      const updated = [...prev];
      for (const { word, correct, credit } of result.results) {
        const attempt: WordAttempt = { date: now, context, correct, ...(credit !== undefined ? { credit } : {}) };
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
    setExercisesAllCompleted(false);
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
      if (diagnosticCount === 0) return 'Vérifier mes connaissances';
      return 'Lancer le diagnostic intermédiaire';
    }
    if (phase === 'evaluation') return 'Lancer l’évaluation';
    return 'Générer une session d’apprentissage';
  };

  const plural = (n: number, s = 'mot') => `${n} ${s}${n > 1 ? 's' : ''}`;

  const getGenerateHint = () => {
    if (phase === 'diagnostic') {
      if (diagnosticCount === 0) return plural(diagnosticSelections.length) + ' sélectionné' + (diagnosticSelections.length > 1 ? 's' : '');
      const n = categories.known.length + categories.misconceived.length;
      return plural(n) + ' à retester';
    }
    return `${currentSelection.length}/6-10 mots`;
  };

  const studyCount = currentSelection.length;
  const diagnosticAvailable = categories.known.length + categories.misconceived.length;
  // Le diagnostic intermediaire necessite qu'au moins 50% des mots soient connus ou meconnus
  const diagnosticPct = allThemeWords.length > 0 ? diagnosticAvailable / allThemeWords.length : 0;
  const diagnosticReady = diagnosticPct >= 0.5;

  const canGenerate = () => {
    if (disabled) return false;
    // Bloquer tant que les exercices en cours ne sont pas tous verifies
    if (displayedExercises.length > 0 && !exercisesAllCompleted) return false;
    if (phase === 'diagnostic') {
      if (diagnosticCount === 0) return diagnosticSelections.length > 0;
      return categories.known.length + categories.misconceived.length > 0;
    }
    return currentSelection.length >= 6;
  };

  // --- Popup de blocage evaluation ---
  const evalBlockStats = {
    total: allWordTexts.length,
    knownAndMisconceived: categories.known.length + categories.misconceived.length,
    known: categories.known.length,
    pctKM: allWordTexts.length > 0 ? Math.round(((categories.known.length + categories.misconceived.length) / allWordTexts.length) * 100) : 0,
    pctKnown: (categories.known.length + categories.misconceived.length) > 0
      ? Math.round((categories.known.length / (categories.known.length + categories.misconceived.length)) * 100)
      : 0,
  };

  // --- Si l'eleve clique sur une evaluation passee dans le panneau de droite ---
  if (viewingEvalAttempt) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.evalReviewHeader}>
          <button
            type="button"
            className={styles.evalReviewBackBtn}
            onClick={onCloseEvalView}
          >
            ← Retour à la liste d&apos;apprentissage
          </button>
          <h3 className={styles.evalReviewTitle}>
            Correction de l&apos;évaluation {(viewingEvalIndex ?? 0) + 1}
            {' — '}
            {new Date(viewingEvalAttempt.date).toLocaleDateString()}
          </h3>
        </div>
        <div className={styles.evalReviewBody}>
          <EvalAttemptView attempt={viewingEvalAttempt} />
        </div>
      </div>
    );
  }

  // --- Si evaluation en cours, afficher le composant dedie ---
  if (showEvaluation && evaluationExercises) {
    return (
      <div className={styles.wrapper}>
        <VocabulaireEvaluation
          crossword={evaluationExercises.crossword}
          synonymAntonymText={evaluationExercises.synonymAntonymText}
          composition={evaluationExercises.composition}
          onSubmitAttempt={handleEvalSubmitAttempt}
          onBackToLearning={handleEvalBackToLearning}
        />
      </div>
    );
  }

  // --- Si generation evaluation en cours ---
  if (isGeneratingEval) {
    return (
      <div className={styles.wrapper}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '48px 16px', flex: 1 }}>
          <div className={styles.generateSpinner} />
          <p style={{ color: 'var(--c-text-dim)', fontSize: '0.9rem' }}>Génération de l&apos;évaluation en cours...</p>
          <p style={{ color: 'var(--c-text-dim)', fontSize: '0.75rem' }}>Mots croisés + exercices IA — cela peut prendre quelques secondes</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      {/* Popup de blocage evaluation */}
      {showEvalBlockPopup && (
        <div className={styles.evalPopupOverlay}>
          <div className={styles.evalPopupCard}>
            <div className={styles.evalPopupIcon}>🔒</div>
            <h3 className={styles.evalPopupTitle}>Évaluation non disponible</h3>
            <p className={styles.evalPopupText}>
              Pour accéder à l&apos;évaluation, tu dois avoir étudié au moins <strong>70%</strong> des mots
              de la liste, et parmi ceux-ci, au moins <strong>50%</strong> doivent être maîtrisés (connus).
            </p>
            <div className={styles.evalPopupStats}>
              <div className={styles.evalPopupStat}>
                <div className={`${styles.evalPopupStatValue} ${evalBlockStats.pctKM >= 70 ? styles.evalPopupStatOk : styles.evalPopupStatKo}`}>
                  {evalBlockStats.pctKM}%
                </div>
                <div className={styles.evalPopupStatLabel}>Étudiés (objectif : 70%)</div>
              </div>
              <div className={styles.evalPopupStat}>
                <div className={`${styles.evalPopupStatValue} ${evalBlockStats.pctKnown >= 50 ? styles.evalPopupStatOk : styles.evalPopupStatKo}`}>
                  {evalBlockStats.pctKnown}%
                </div>
                <div className={styles.evalPopupStatLabel}>Connus (objectif : 50%)</div>
              </div>
            </div>
            <button
              type="button"
              className={styles.evalPopupBtn}
              onClick={() => setShowEvalBlockPopup(false)}
            >
              Compris, je continue à m&apos;entraîner
            </button>
          </div>
        </div>
      )}

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

      {/* Contenu avec animation flip — les deux cotes sont toujours montes */}
      <div className={styles.flipContainer}>
        <div className={`${styles.flipCard} ${flipClass}`}>
          <div className={styles.cardFace}>
            {/* Recto */}
            <div className={styles.rectoContent} style={{ display: side === 'recto' ? 'flex' : 'none' }}>
              {/* Bandeau consigne */}
              <div className={styles.phaseBar}>
                <p className={styles.phaseDescription}>
                  {phase === 'diagnostic' && diagnosticCount === 0 &&
                    'Clique sur les mots que tu penses connaître, puis vérifie tes connaissances.'}
                  {phase === 'diagnostic' && diagnosticCount > 0 &&
                    'Diagnostic intermédiaire : les mots connus et méconnus seront testés.'}
                  {phase === 'learning' &&
                    'Sélectionne 6 à 10 mots à apprendre pour cette session.'}
                </p>
              </div>

              {/* Hint de selection */}
              {selectionHint && (
                <div className={styles.selectionHint}>
                  <span>{selectionHint}</span>
                  <button type="button" className={styles.selectionHintClose} onClick={() => setSelectionHint(null)}>✕</button>
                </div>
              )}

              <VocabulaireList
                words={allThemeWords}
                selectedTheme={selectedTheme}
                phase={phase === 'evaluation' ? 'learning' : phase}
                diagnosticSelections={diagnosticSelections}
                onDiagnosticSelect={diagnosticCount === 0 ? handleDiagnosticSelect : undefined}
                currentSelection={currentSelection}
                onLearningSelect={handleLearningSelect}
                wordMastery={wordMastery}
                disabled={disabled}
                isLoading={wordsLoading}
                flashcardsSlot={(() => {
                  if (disabled || phase !== 'learning') return undefined;
                  if (!showFlashcards || difficultWords.length === 0) return undefined;
                  const difficultWordObjects = allThemeWords.filter((w) => difficultWords.includes(w.word));
                  return (
                    <div className={styles.flashcardsContainer}>
                      <button
                        type="button"
                        className={styles.flashcardsContainerClose}
                        onClick={() => setShowFlashcards(false)}
                        aria-label="Masquer le panneau de flashcards"
                        title="Masquer le panneau"
                      >
                        ×
                      </button>
                      <div className={styles.flashcardsGrid}>
                        {difficultWordObjects.map((w) => (
                          <Flashcard
                            key={w.word}
                            word={w}
                            definitionFirst={flashcardsDefinitionFirst}
                            onRemove={() => handleRemoveFlashcard(w.word)}
                          />
                        ))}
                      </div>
                      <div className={styles.flashcardsControls}>
                        <div className={styles.flashcardsOrderToggle} role="group" aria-label="Recto par défaut">
                          <button
                            type="button"
                            className={`${styles.flashcardsOrderBtn} ${flashcardsDefinitionFirst ? styles.flashcardsOrderBtnActive : ''}`}
                            onClick={() => setFlashcardsDefinitionFirst(true)}
                          >
                            Définition
                          </button>
                          <button
                            type="button"
                            className={`${styles.flashcardsOrderBtn} ${!flashcardsDefinitionFirst ? styles.flashcardsOrderBtnActive : ''}`}
                            onClick={() => setFlashcardsDefinitionFirst(false)}
                          >
                            Mot
                          </button>
                        </div>
                        <button
                          type="button"
                          className={styles.flashcardsLargeBtn}
                          onClick={() => { setFlashcardIndex(0); setFlashcardsLarge(true); }}
                        >
                          Voir en grand
                        </button>
                      </div>
                    </div>
                  );
                })()}
                generateButton={(() => {
                  if (disabled) return undefined;
                  // En diagnostic : seulement le bouton Generer (quand canGenerate)
                  if (phase === 'diagnostic') {
                    if (!canGenerate() && !isGenerating) return undefined;
                    return (
                      <div className={styles.bottomActions}>
                        <span className={styles.bottomActionsLine} />
                        <div className={styles.bottomActionsRow}>
                          <span className={styles.actionBtnWrap}>
                            <button
                              type="button"
                              className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                              onClick={handleGenerate}
                              disabled={isGenerating}
                            >
                              {isGenerating ? 'Génération en cours...' : (
                                exercisesAllCompleted ? 'Régénérer les exercices' : getGenerateLabel()
                              )}
                            </button>
                            <span className={styles.actionBtnHint}>{getGenerateHint()}</span>
                          </span>
                          {isGenerating && <div className={styles.generateSpinner} />}
                        </div>
                        <span className={styles.bottomActionsLine} />
                      </div>
                    );
                  }
                  // En learning : les 4 boutons toujours visibles, disabled selon les conditions
                  if (phase !== 'learning') return undefined;
                  const generateDisabled = isGenerating || !canGenerate();
                  // Le bouton est utile : (1) pour ajouter des mots, (2) pour ouvrir le panneau si ferme et qu'il existe deja des favoris.
                  const studyDisabled = studyCount === 0 && (showFlashcards || difficultWords.length === 0);
                  const diagnosticDisabled = isGenerating || isGeneratingEval || !diagnosticReady;
                  const evalReady = evalBlockStats.pctKM >= 70 && evalBlockStats.pctKnown >= 50;
                  const evaluationDisabled = isGenerating || isGeneratingEval || !evalReady;
                  return (
                    <div className={styles.bottomActions}>
                      <span className={styles.bottomActionsLine} />
                      <div className={styles.bottomActionsRow}>
                        {/* Verts (genere du contenu) */}
                        <span className={styles.actionBtnWrap}>
                          <button
                            type="button"
                            className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                            onClick={handleGenerate}
                            disabled={generateDisabled}
                          >
                            {isGenerating ? 'Génération en cours...' : (
                              exercisesAllCompleted ? 'Régénérer les exercices' : getGenerateLabel()
                            )}
                          </button>
                          <span className={styles.actionBtnHint}>{getGenerateHint()}</span>
                        </span>
                        <span className={styles.actionBtnWrap}>
                          <button
                            type="button"
                            className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                            onClick={handleIntermediateDiagnostic}
                            disabled={diagnosticDisabled}
                          >
                            Diagnostic intermédiaire
                          </button>
                          <span className={styles.actionBtnHint}>
                            {diagnosticReady
                              ? `${Math.round(diagnosticPct * 100)} % étudiés · ${plural(diagnosticAvailable)} à retester`
                              : `${Math.round(diagnosticPct * 100)} % étudiés / 50 % requis`}
                          </span>
                        </span>
                        <span className={styles.actionBtnWrap}>
                          <button
                            type="button"
                            className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                            onClick={handleEvaluation}
                            disabled={evaluationDisabled}
                          >
                            Évaluation
                          </button>
                          <span className={styles.actionBtnHint}>
                            {evalReady
                              ? `${evalBlockStats.pctKM} % étudiés · ${evalBlockStats.pctKnown} % connus · ${plural(allThemeWords.length)}`
                              : `${evalBlockStats.pctKM} % étudiés / 70 % requis · ${evalBlockStats.pctKnown} % connus / 50 % requis`}
                          </span>
                        </span>
                        {/* Ambers (affiche du contenu) */}
                        <span className={styles.actionBtnWrap}>
                          <button
                            type="button"
                            className={`${styles.actionBtn} ${styles.actionBtnAmber}`}
                            onClick={handleToggleDifficult}
                            disabled={studyDisabled}
                          >
                            Afficher les mots difficiles
                          </button>
                          <span className={styles.actionBtnHint}>
                            {studyCount > 0
                              ? `Ajouter ${plural(studyCount)} aux favoris`
                              : difficultWords.length === 0
                                ? 'Sélectionne d’abord des mots'
                                : showFlashcards
                                  ? 'Déjà affichées'
                                  : `${plural(difficultWords.length)} en favoris`}
                          </span>
                        </span>
                        {isGenerating && <div className={styles.generateSpinner} />}
                      </div>
                      <span className={styles.bottomActionsLine} />
                    </div>
                  );
                })()}
              />
            </div>

            {/* Verso — toujours monte pour conserver l'etat */}
            <div style={{ display: side === 'verso' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
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
                onAllCompleted={setExercisesAllCompleted}
                onBackToRecto={() => flipTo('recto')}
                onIntermediateDiagnostic={phase === 'learning' ? handleIntermediateDiagnostic : undefined}
                onEvaluation={
                  phase === 'learning' || (phase === 'diagnostic' && diagnosticCount > 0)
                    ? handleEvaluation
                    : undefined
                }
                intermediateDiagnosticMode={phase === 'diagnostic' && diagnosticCount > 0}
                onShowKnowledgeTab={onShowEvaluationTab}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Popup grand format pour les flashcards */}
      {flashcardsLarge && difficultWords.length > 0 && (() => {
        const difficultWordObjects = allThemeWords.filter((w) => difficultWords.includes(w.word));
        if (difficultWordObjects.length === 0) return null;
        const safeIndex = Math.min(flashcardIndex, difficultWordObjects.length - 1);
        const currentWord = difficultWordObjects[safeIndex];
        return (
          <div className={styles.flashcardsModalOverlay}>
            <div className={styles.flashcardsModalHeader}>
              <span className={styles.flashcardsModalCounter}>
                {safeIndex + 1} / {difficultWordObjects.length}
              </span>
              <button
                type="button"
                className={styles.flashcardsModalClose}
                onClick={() => setFlashcardsLarge(false)}
                aria-label="Fermer"
              >
                ×
              </button>
            </div>
            <div className={styles.flashcardsModalBody}>
              <button
                type="button"
                className={styles.flashcardsModalNav}
                onClick={() => setFlashcardIndex((i) => Math.max(0, i - 1))}
                disabled={safeIndex === 0}
                aria-label="Carte précédente"
              >
                ‹
              </button>
              <div className={styles.flashcardsModalCardWrap}>
                <Flashcard
                  key={currentWord.word}
                  word={currentWord}
                  definitionFirst={flashcardsDefinitionFirst}
                  onRemove={() => handleRemoveFlashcard(currentWord.word)}
                  large
                />
              </div>
              <button
                type="button"
                className={styles.flashcardsModalNav}
                onClick={() => setFlashcardIndex((i) => Math.min(difficultWordObjects.length - 1, i + 1))}
                disabled={safeIndex === difficultWordObjects.length - 1}
                aria-label="Carte suivante"
              >
                ›
              </button>
            </div>
            <div className={styles.flashcardsModalHint}>
              Utilise les flèches ← → ou Échap pour fermer
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// --- Flashcard avec ordre recto/verso configurable + bouton de retrait ---
function Flashcard({
  word,
  definitionFirst,
  onRemove,
  large = false,
}: {
  word: VocabulaireWord;
  definitionFirst: boolean;
  onRemove?: () => void;
  large?: boolean;
}) {
  const [flipped, setFlipped] = useState(false);

  // Reinitialiser l'etat de flip quand l'ordre par defaut change
  useEffect(() => {
    setFlipped(false);
  }, [definitionFirst, word.word]);

  const definitionFace = (
    <>
      <div className={styles.flashcardLabel}>Définition</div>
      <div className={styles.flashcardDefinition}>{word.definition}</div>
    </>
  );
  const wordFace = (
    <>
      <div className={styles.flashcardWord}>{word.word}</div>
      {word.example && (
        <div className={styles.flashcardExample}>{word.example}</div>
      )}
    </>
  );

  const front = definitionFirst ? definitionFace : wordFace;
  const back = definitionFirst ? wordFace : definitionFace;

  return (
    <div className={`${styles.flashcard} ${large ? styles.flashcardLarge : ''} ${flipped ? styles.flashcardFlipped : ''}`}>
      {onRemove && (
        <button
          type="button"
          className={styles.flashcardRemove}
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          aria-label={`Retirer ${word.word}`}
        >
          ×
        </button>
      )}
      <button
        type="button"
        className={styles.flashcardFlip}
        onClick={() => setFlipped((prev) => !prev)}
        aria-label={flipped ? 'Retourner la carte' : 'Retourner la carte'}
      >
        <div className={styles.flashcardInner}>
          <div className={styles.flashcardFace}>{front}</div>
          <div className={`${styles.flashcardFace} ${styles.flashcardBack}`}>{back}</div>
        </div>
      </button>
    </div>
  );
}
