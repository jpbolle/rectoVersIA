'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import type { VocabulaireWord } from '@/types/vocabulaire';

export interface VocabulaireThemeSummary {
  id: string;
  name: string;
  wordCount: number;
  profId: string | null;
  profName?: string;
}

export function useVocabulaireThemes() {
  const { isAuthenticated, getAuthHeaders, user } = useAuth();
  const [allThemes, setAllThemes] = useState<VocabulaireThemeSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchThemes = useCallback(async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    const headers = await getAuthHeaders();
    if (!headers) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/vocabulaire/themes', { headers });
      const json = await res.json();

      if (json.success && Array.isArray(json.data)) {
        setAllThemes(json.data);
      } else {
        setError(json.message || 'Erreur');
      }
    } catch (err) {
      setError('Erreur lors du chargement des thèmes');
      console.error('useVocabulaireThemes:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, getAuthHeaders]);

  useEffect(() => {
    fetchThemes();
  }, [fetchThemes]);

  // Mes listes = celles ou profId === user.uid OU sans profId (anciennes listes)
  const myThemes = allThemes.filter((t) => !t.profId || t.profId === user?.uid);
  // Listes des autres profs (uniquement celles avec un profId different)
  const otherThemes = allThemes.filter((t) => t.profId && t.profId !== user?.uid);
  // Toutes les listes (pour le dropdown du formulaire de creation de devoirs)
  const themes = allThemes;

  const createTheme = useCallback(async (name: string): Promise<string | null> => {
    const headers = await getAuthHeaders();
    if (!headers) return null;

    const res = await fetch('/api/vocabulaire/themes', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Erreur');
    await fetchThemes();
    return json.id;
  }, [getAuthHeaders, fetchThemes]);

  const updateWords = useCallback(async (id: string, words: VocabulaireWord[]) => {
    const headers = await getAuthHeaders();
    if (!headers) return;

    const res = await fetch('/api/vocabulaire/themes', {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, words }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Erreur');
    await fetchThemes();
  }, [getAuthHeaders, fetchThemes]);

  const deleteTheme = useCallback(async (id: string) => {
    const headers = await getAuthHeaders();
    if (!headers) return;

    const res = await fetch(`/api/vocabulaire/themes?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers,
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Erreur');
    await fetchThemes();
  }, [getAuthHeaders, fetchThemes]);

  const duplicateTheme = useCallback(async (source: VocabulaireThemeSummary): Promise<string | null> => {
    const headers = await getAuthHeaders();
    if (!headers) return null;

    // Charger les mots de la source
    const wordsRes = await fetch(
      `/api/vocabulaire/words?themes=${encodeURIComponent(source.id)}`,
      { headers }
    );
    const wordsJson = await wordsRes.json();
    const words: VocabulaireWord[] = wordsJson.success ? (wordsJson.data[source.id] || []) : [];

    // Creer la copie
    const res = await fetch('/api/vocabulaire/themes', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `${source.name} (copie)`, words }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Erreur');
    await fetchThemes();
    return json.id;
  }, [getAuthHeaders, fetchThemes]);

  return {
    themes,
    myThemes,
    otherThemes,
    isLoading,
    error,
    refetch: fetchThemes,
    createTheme,
    updateWords,
    deleteTheme,
    duplicateTheme,
  };
}
