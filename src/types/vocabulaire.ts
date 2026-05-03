// Types pour l'activite vocabulaire — flux unifie Diagnostic → Apprentissage → Evaluation

export interface VocabulaireWord {
  word: string;
  definition: string;
  example: string;
  synonyms?: string;
  antonyms?: string;
  wordFamily?: string;
}

export interface VocabulaireTheme {
  name: string;
  words: VocabulaireWord[];
}

// --- Exercices generes par IA ---

export interface TextWithDefinitionsExercise {
  type: 'text_with_definitions';
  title: string;
  instructions: string;
  text: string;
  highlighted_words: { word: string; definition: string }[];
}

export interface DragAndDropExercise {
  type: 'drag_and_drop';
  title: string;
  instructions: string;
  words: string[];
  definitions: { id: number; definition: string; correct_word: string }[];
  distractors: { definition: string; correct_term: string }[];
}

export interface WordFamiliesExercise {
  type: 'word_families';
  title: string;
  instructions: string;
  word_schemas: {
    central_word: string;
    family_branch: string[];
    synonyms_branch: string[];
    antonyms_branch: string[];
  }[];
}

export interface FillInBlanksExercise {
  type: 'fill_in_blanks';
  title: string;
  instructions: string;
  text_with_blanks: string;
  answers: string[];
}

export interface ProductionChallengeExercise {
  type: 'production_challenge';
  title: string;
  instructions: string;
  selected_words: string[];
  constraint: string;
}

// Exercices diagnostic (mode diagnostic)
export interface DefinitionsExercise {
  type: 'definitions';
  title: string;
  instructions: string;
  points: number;
  definitions: { id: number; definition: string; correctTerm: string }[];
  terms: string[];
  answers: { definitionId: number; correctTerm: string }[];
}

export interface SynonymsExercise {
  type: 'synonyms';
  title: string;
  instructions: string;
  points: number;
  words: string[];
  answers: { pair: [string, string] }[];
}

export interface AntonymsExercise {
  type: 'antonyms';
  title: string;
  instructions: string;
  points: number;
  words: string[];
  answers: { pair: [string, string] }[];
}

// --- Exercices evaluation (interro) ---

// Exercice 1 : mots croises interactifs (genere cote client)
export interface CrosswordExercise {
  type: 'crossword';
  title: string;
  instructions: string;
  // Mots places dans la grille
  words: {
    answer: string;          // mot en MAJUSCULES sans accents (pour la grille)
    displayWord: string;     // mot original avec accents (pour les indices)
    clue: string;            // definition = indice
    startx: number;
    starty: number;
    orientation: 'across' | 'down';
    position: number;        // numero dans la grille
  }[];
  // Mots non places (affiches a part si besoin)
  unplacedWords?: { word: string; clue: string }[];
  gridRows: number;
  gridCols: number;
}

// Exercice 2 : texte avec mots a remplacer par synonyme (ambre) ou antonyme (bleu)
export interface SynonymAntonymTextExercise {
  type: 'synonym_antonym_text';
  title: string;
  instructions: string;
  text: string;              // texte avec des balises {syn:mot} et {ant:mot}
  replacements: {
    original: string;        // mot dans le texte
    type: 'synonym' | 'antonym';
    acceptedAnswers: string[]; // reponses acceptees (plusieurs synonymes/antonymes possibles)
  }[];
}

// Exercice 3 : composition evaluee par Claude
export interface EvaluationCompositionExercise {
  type: 'evaluation_composition';
  title: string;
  instructions: string;
  theme: string;             // theme impose par Claude
  requiredWords: string[];   // 5 mots a utiliser
  constraint: string;        // contrainte d'ecriture
}

// Validation de la composition d'evaluation
export interface EvaluationCompositionValidation {
  wordsUsed: { word: string; found: boolean; form?: string }[];
  qualityScore: number;      // 0-10
  feedback: string;
}

// Score d'une evaluation complete
export interface EvaluationScore {
  date: string;              // ISO
  crosswordScore: { correct: number; total: number };
  synonymAntonymScore: { correct: number; total: number };
  compositionScore: { score: number; total: number };
  totalCorrect: number;
  totalPossible: number;
  percentage: number;
}

// Tentative d'evaluation complete (exercices + reponses eleve + corrections)
export interface EvaluationAttempt {
  date: string;
  score: EvaluationScore;
  // Exercices generes
  crossword: CrosswordExercise;
  synonymAntonymText: SynonymAntonymTextExercise;
  composition: EvaluationCompositionExercise;
  // Reponses de l'eleve
  crosswordAnswers: Record<string, string>;
  synAntAnswers: Record<string, string>;
  compositionText: string;
  // Corrections
  crosswordCorrections: Record<string, 'correct' | 'incorrect'>;
  synAntCorrections: Record<string, { correct: boolean; expected: string }>;
  compositionValidation: EvaluationCompositionValidation;
}

// Exercice : phrases en contexte (l'emploi est-il correct ?)
export interface ContextSentencesExercise {
  type: 'context_sentences';
  title: string;
  instructions: string;
  points: number;
  sentences: {
    word: string;
    sentence: string;
    isCorrect: boolean;
    explanation?: string;
  }[];
}

// Exercice : texte a trous avec menus deroulants
export interface FillInBlanksDropdownExercise {
  type: 'fill_in_blanks_dropdown';
  title: string;
  instructions: string;
  points: number;
  text: string;            // contient {0}, {1}, etc. pour les blancs
  blanks: {
    correctAnswer: string;
    options: string[];     // 3-4 choix dont le bon
  }[];
}

export type VocabulaireExercise =
  | TextWithDefinitionsExercise
  | DragAndDropExercise
  | WordFamiliesExercise
  | FillInBlanksExercise
  | ProductionChallengeExercise
  | DefinitionsExercise
  | SynonymsExercise
  | AntonymsExercise
  | ContextSentencesExercise
  | FillInBlanksDropdownExercise
  | CrosswordExercise
  | SynonymAntonymTextExercise
  | EvaluationCompositionExercise;

// --- Suivi de maitrise par mot ---

export interface WordAttempt {
  date: string;           // ISO
  context: 'diagnostic' | 'learning' | 'evaluation';
  correct: boolean;
}

export interface WordMasteryEntry {
  word: string;
  attempts: WordAttempt[];
}

// Categorie calculee a partir des attempts
export type WordCategory = 'unknown' | 'misconceived' | 'known';

// Calcul du niveau de maitrise d'un mot
export function getWordCategory(entry: WordMasteryEntry | undefined): WordCategory {
  if (!entry || entry.attempts.length === 0) return 'unknown';
  // Dernieres 3 tentatives (ou moins)
  const recent = entry.attempts.slice(-3);
  const correctCount = recent.filter((a) => a.correct).length;
  if (correctCount >= 2) return 'known';
  return 'misconceived';
}

// Resultat d'exercice pour le tracking
export interface ExerciseResult {
  exerciseIndex: number;
  wordsTested: string[];
  results: { word: string; correct: boolean }[];
}

export interface ProductionValidation {
  isValid: boolean;
  wordsUsedCorrectly: boolean;
  constraintRespected: boolean;
  sentenceMakesSense: boolean;
  feedback: string;
}

// --- Etat de l'activite stocke dans travail.content ---

// Score d'un diagnostic complet (serie d'exercices)
export interface DiagnosticScore {
  date: string;           // ISO
  correct: number;
  total: number;
  wordsTested: string[];
}

export interface VocabulaireActivityState {
  // Phase courante
  phase: 'diagnostic' | 'learning' | 'evaluation';

  // Diagnostic
  diagnosticSelections: string[];          // mots cliques "je pense connaitre" (premier diagnostic)
  diagnosticCount: number;                 // nb de diagnostics passes
  diagnosticScores: DiagnosticScore[];     // score de chaque diagnostic passe

  // Suivi de maitrise (unifie diagnostic + learning + evaluation)
  wordMastery: WordMasteryEntry[];

  // Apprentissage
  learningSessions: number;                // nb de sessions d'exercices generes
  currentSelection: string[];             // mots choisis pour la session en cours

  // Exercices en cours
  exercises?: VocabulaireExercise[];
  exerciseResults?: ExerciseResult[];

  // Stats
  activityOpened: number;                  // nb de fois que l'activite est ouverte

  // Production validation
  productionValidation?: ProductionValidation;

  // Evaluation (interro) — chaque tentative complete
  evaluationScores?: EvaluationScore[];
  evaluationAttempts?: EvaluationAttempt[];

  lastUpdated: string;
}

// Helper : supprimer les accents (pour grille mots croises)
export function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Helper : obtenir les mots par categorie
export function categorizeWords(
  allWords: string[],
  mastery: WordMasteryEntry[]
): { unknown: string[]; misconceived: string[]; known: string[] } {
  const masteryMap = new Map(mastery.map((m) => [m.word, m]));
  const result = { unknown: [] as string[], misconceived: [] as string[], known: [] as string[] };
  for (const word of allWords) {
    const category = getWordCategory(masteryMap.get(word));
    result[category].push(word);
  }
  return result;
}

// Helper : selectionner 4 mots meconnus + 1 mot connu pour ancrage
export function getSpacedRepetitionWords(
  mastery: WordMasteryEntry[],
  exclude: string[],
  count: number = 5
): string[] {
  const excludeSet = new Set(exclude);
  // 4 mots meconnus (les moins exerces d'abord)
  const misconceived = mastery
    .filter((m) => !excludeSet.has(m.word) && getWordCategory(m) === 'misconceived')
    .sort((a, b) => a.attempts.length - b.attempts.length);
  // 1 mot connu (aleatoire, pour consolider)
  const known = mastery
    .filter((m) => !excludeSet.has(m.word) && getWordCategory(m) === 'known')
    .sort(() => Math.random() - 0.5);

  const result: string[] = [];
  result.push(...misconceived.slice(0, Math.min(4, count - 1)).map((m) => m.word));
  if (known.length > 0) {
    result.push(known[0].word);
  }
  return result.slice(0, count);
}
