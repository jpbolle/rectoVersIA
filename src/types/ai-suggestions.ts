export type AiSuggestionType = 'ortho' | 'ponctu' | 'synt' | 'lex';

export interface AiSuggestionItem {
  id: string;               // "item-0", "item-1", etc.
  paragraphIndex: number;   // index 0-based du paragraphe
  content: string;          // texte de la suggestion IA
  dismissed: boolean;       // élève a cliqué ✓
  targetText?: string;      // pour synt/lex : le passage problématique exact
}

export interface AiSuggestion {
  id: string;               // AI-{travailId}-{type}
  travailId: string;
  devoirId: string;
  studentId: string;
  type: AiSuggestionType;
  textSnapshot: string;     // HTML du texte au moment de l'appel IA
  suggestions: AiSuggestionItem[];
  createdAt: string;
}
