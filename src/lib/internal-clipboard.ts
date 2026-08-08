// Presse-papiers interne de l'espace de travail élève.
// Trace du dernier texte copié/coupé dans la rédaction OU la planification :
// seul ce texte peut être collé dans l'espace de rédaction (anti-triche).

let internalClip = '';

// Normalisation : les sauts de ligne/espaces diffèrent entre l'éditeur,
// le presse-papiers système et les textareas — on compare des espaces simples.
export function normalizeClipText(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

export function setInternalClip(text: string): void {
  internalClip = normalizeClipText(text);
}

export function getInternalClip(): string {
  return internalClip;
}

// Récupère le texte sélectionné au moment d'un copier/coupé DOM,
// y compris dans un textarea/input (où getSelection() peut être vide).
export function selectionTextFromEvent(e: { target: EventTarget | null }): string {
  const el = e.target as HTMLElement | null;
  if (el && (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement)) {
    return el.value.substring(el.selectionStart ?? 0, el.selectionEnd ?? 0);
  }
  return window.getSelection()?.toString() || '';
}
