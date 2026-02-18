export interface FontOption {
  name: string;
  value: string;
}

export interface FontSizeOption {
  name: string;
  value: string;
}

export interface PageTheme {
  id: string;
  name: string;
  bg: string;
  text: string;
}

export const FONTS: FontOption[] = [
  { name: 'Police par défaut', value: '' },
  { name: 'OpenDyslexic (dyslexie)', value: 'OpenDyslexic, sans-serif' },
  { name: 'Arial', value: 'Arial, sans-serif' },
  { name: 'Comic Sans MS', value: 'Comic Sans MS, cursive' },
  { name: 'Verdana', value: 'Verdana, sans-serif' },
];

export const FONT_SIZES: FontSizeOption[] = [
  { name: 'Taille', value: '' },
  { name: '10', value: '10' },
  { name: '12', value: '12' },
  { name: '14', value: '14' },
  { name: '15', value: '15' },
  { name: '16', value: '16' },
  { name: '18', value: '18' },
  { name: '20', value: '20' },
  { name: '24', value: '24' },
  { name: '28', value: '28' },
];

export const PAGE_THEMES: PageTheme[] = [
  { id: 'classic', name: 'Classique', bg: '#FFFFFF', text: '#202124' },
  { id: 'dark', name: 'Sombre', bg: '#1a1a1a', text: '#F2F2F2' },
  { id: 'cream', name: 'Crème', bg: '#FDF6E3', text: '#3E3832' },
  { id: 'yellow', name: 'Jaune pastel', bg: '#FFF9E6', text: '#4A4540' },
  { id: 'blue', name: 'Bleu clair', bg: '#E3EDF7', text: '#1A2332' },
  { id: 'green', name: 'Vert pastel', bg: '#E4F0E6', text: '#1B3A1B' },
];

export const LINE_HEIGHT_MIN = 1.0;
export const LINE_HEIGHT_MAX = 5.0;
export const LINE_HEIGHT_STEP = 0.25;

export const THEME_STORAGE_KEY = 'recto-versia-editor-theme';
