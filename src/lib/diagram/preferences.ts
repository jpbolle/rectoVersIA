/**
 * Préférences d'affichage de l'éditeur de schéma (quadrillage…) — lues dans le
 * navigateur, jamais dans le schéma lui-même. Reprise de la maquette SchémaKit
 * (`local-store.ts`), dont seule cette partie survit : les schémas eux-mêmes
 * vivent désormais dans Firestore (travaux, schémas personnels).
 */
export function readPreference(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(`diagram.pref.${key}`);
    return raw === null ? fallback : raw === '1';
  } catch {
    return fallback;
  }
}

const PREF_EVENT = 'diagram:pref';

export function writePreference(key: string, value: boolean) {
  try {
    localStorage.setItem(`diagram.pref.${key}`, value ? '1' : '0');
  } catch {
    /* ignoré */
  }
  window.dispatchEvent(new Event(PREF_EVENT));
}

/** Pour `useSyncExternalStore` : prévient quand une préférence change (ici ou dans un autre onglet). */
export function subscribePreferences(callback: () => void): () => void {
  window.addEventListener(PREF_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(PREF_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}
