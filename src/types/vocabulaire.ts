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
  | FillInBlanksDropdownExercise;

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

  lastUpdated: string;
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

// Helper : selectionner les mots meconnus pour l'espacement
export function getSpacedRepetitionWords(
  mastery: WordMasteryEntry[],
  exclude: string[],
  count: number = 5
): string[] {
  const excludeSet = new Set(exclude);
  // Mots meconnus tries par nombre de tentatives (les moins exerces d'abord)
  const misconceived = mastery
    .filter((m) => !excludeSet.has(m.word) && getWordCategory(m) === 'misconceived')
    .sort((a, b) => a.attempts.length - b.attempts.length);
  return misconceived.slice(0, count).map((m) => m.word);
}
