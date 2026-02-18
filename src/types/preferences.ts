export interface EditorPreferences {
  font: string;
  fontSize: string;
  lineHeight: number;
  theme: string;
}

export const DEFAULT_PREFERENCES: EditorPreferences = {
  font: '',
  fontSize: '',
  lineHeight: 1.5,
  theme: 'classic',
};
