'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import type { VocabulaireWord } from '@/types/vocabulaire';

export function useVocabulaireWords(themes: string[] | null) {
  const { isAuthenticated, getAuthHeaders } = useAuth();
  const [words, setWords] = useState<Record<string, VocabulaireWord[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWords = useCallback(async (themeList: string[]) => {
    if (!isAuthenticated || themeList.length === 0) return;

    const headers = await getAuthHeaders();
    if (!headers) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/vocabulaire/words?themes=${encodeURIComponent(themeList.join(','))}`,
        { headers }
      );
      const json = await res.json();

      if (json.success && json.data) {
        setWords(json.data);
      } else {
        setError(json.message || 'Erreur');
      }
    } catch (err) {
      setError('Erreur lors du chargement des mots');
      console.error('useVocabulaireWords:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, getAuthHeaders]);

  useEffect(() => {
    if (themes && themes.length > 0 && isAuthenticated) {
      fetchWords(themes);
    }
  }, [themes?.join(','), isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tous les mots aplatis
  const allWords = Object.values(words).flat();

  return { words, allWords, isLoading, error, refetch: fetchWords };
}
