// Types pour l'activite vocabulaire (migration vocab4ever)

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

export type VocabulaireExercise =
  | TextWithDefinitionsExercise
  | DragAndDropExercise
  | WordFamiliesExercise
  | FillInBlanksExercise
  | ProductionChallengeExercise
  | DefinitionsExercise
  | SynonymsExercise
  | AntonymsExercise;

// --- Etat de l'activite stocke dans travail.content ---

export type WordMastery = 'known' | 'misconceived' | 'unknown';

export interface VocabulaireProgress {
  word: string;
  status: WordMastery;
}

export interface ProductionValidation {
  isValid: boolean;
  wordsUsedCorrectly: boolean;
  constraintRespected: boolean;
  sentenceMakesSense: boolean;
  feedback: string;
}

export interface VocabulaireActivityState {
  // Theme et mots selectionnes
  selectedTheme: string;
  selectedWords: VocabulaireWord[];
  // Mode diagnostic : auto-evaluation
  diagnosticProgress?: VocabulaireProgress[];
  // Exercices generes
  exercises?: VocabulaireExercise[];
  // Reponses de l'eleve aux exercices
  exerciseResponses?: Record<number, unknown>;
  // Validation production personnelle (exercice 5)
  productionValidation?: ProductionValidation;
  // Score
  score?: number;
  totalPoints?: number;
  // Timestamp
  lastUpdated: string;
}
