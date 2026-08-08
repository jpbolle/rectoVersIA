// Types du dictionnaire élève (Wiktionnaire + proxémie Claude)

export type DictionaryAction = 'definition' | 'synonymes' | 'antonymes' | 'proxemie';

export interface DictionaryResult {
  word: string;
  action: DictionaryAction;
  // Définitions : phrases ; autres actions : listes de mots
  items: string[];
}
