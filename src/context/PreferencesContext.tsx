'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { DEFAULT_PREFERENCES } from '@/types/preferences';
import { THEME_STORAGE_KEY, PAGE_THEMES } from '@/lib/editor-constants';
import type { EditorPreferences } from '@/types/preferences';

interface PreferencesContextValue {
  preferences: EditorPreferences;
  isLoading: boolean;
  preferencesSet: boolean;
  updatePreferences: (prefs: Partial<EditorPreferences>) => Promise<void>;
  markPreferencesSet: () => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, getAuthHeaders } = useAuth();
  const [preferences, setPreferences] = useState<EditorPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [preferencesSet, setPreferencesSet] = useState(true); // true par defaut pour eviter flash

  // Charge les prefs depuis l'API au login
  useEffect(() => {
    if (!isAuthenticated) {
      setPreferences(DEFAULT_PREFERENCES);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function loadPreferences() {
      try {
        const headers = await getAuthHeaders();
        if (!headers) {
          if (cancelled) return;
          setPreferences(DEFAULT_PREFERENCES);
          setIsLoading(false);
          return;
        }
        const res = await fetch('/api/preferences', { headers });
        if (!res.ok) {
          // Nouvel utilisateur ou token pas encore prêt — utiliser les défauts
          if (cancelled) return;
          setPreferences(DEFAULT_PREFERENCES);
          setIsLoading(false);
          return;
        }
        const json = await res.json();
        if (cancelled) return;

        const serverPrefs: EditorPreferences = json.data;
        setPreferencesSet(json.preferencesSet === true);

        // Migration localStorage: si theme en localStorage et prefs par defaut -> adopte
        const localTheme = localStorage.getItem(THEME_STORAGE_KEY);
        if (localTheme && PAGE_THEMES.some(t => t.id === localTheme) && serverPrefs.theme === DEFAULT_PREFERENCES.theme) {
          serverPrefs.theme = localTheme;
          // Ecrire dans Firestore
          const putHeaders = await getAuthHeaders();
          if (putHeaders) {
            fetch('/api/preferences', {
              method: 'PUT',
              headers: putHeaders,
              body: JSON.stringify(serverPrefs),
            });
          }
          localStorage.removeItem(THEME_STORAGE_KEY);
        } else {
          // Supprimer localStorage dans tous les cas si prefs existent
          localStorage.removeItem(THEME_STORAGE_KEY);
        }

        setPreferences(serverPrefs);
      } catch (error) {
        console.error('Erreur chargement preferences:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadPreferences();
    return () => { cancelled = true; };
  }, [isAuthenticated, getAuthHeaders]);

  const updatePreferences = useCallback(async (partial: Partial<EditorPreferences>) => {
    const newPrefs = { ...preferences, ...partial };
    // Update optimiste
    setPreferences(newPrefs);

    try {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error('Not authenticated');
      const res = await fetch('/api/preferences', {
        method: 'PUT',
        headers,
        body: JSON.stringify(newPrefs),
      });
      if (!res.ok) throw new Error('Failed to save preferences');
    } catch (error) {
      console.error('Erreur sauvegarde preferences:', error);
      // Revert on failure
      setPreferences(preferences);
    }
  }, [preferences, getAuthHeaders]);

  const markPreferencesSet = useCallback(() => {
    setPreferencesSet(true);
  }, []);

  return (
    <PreferencesContext.Provider value={{ preferences, isLoading, preferencesSet, updatePreferences, markPreferencesSet }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferencesContext(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferencesContext must be used within a PreferencesProvider');
  }
  return context;
}
