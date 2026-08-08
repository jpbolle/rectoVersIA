'use client';

import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import type { VocabulaireWord, VocabulaireExercise, ProductionValidation } from '@/types/vocabulaire';

interface GenerateResult {
  title: string;
  exercises: VocabulaireExercise[];
  totalPoints?: number;
}

export function useVocabulaireExercises() {
  const { getAuthHeaders } = useAuth();
  const [exercises, setExercises] = useState<VocabulaireExercise[]>([]);
  const [title, setTitle] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (
      words: VocabulaireWord[],
      mode: 'apprentissage' | 'diagnostic' | 'evaluation',
      themes: string[],
      spacedWords?: VocabulaireWord[],
      personalWords?: VocabulaireWord[]
    ) => {
      const headers = await getAuthHeaders();
      if (!headers) return null;

      setIsGenerating(true);
      setError(null);

      try {
        const res = await fetch('/api/vocabulaire/generate', {
          method: 'POST',
          headers,
          body: JSON.stringify({ words, mode, themes, spacedWords, personalWords }),
        });

        const json = await res.json();

        if (json.success && json.data) {
          const result = json.data as GenerateResult;
          setExercises(result.exercises || []);
          setTitle(result.title || '');
          return result;
        } else {
          setError(json.message || 'Erreur de generation');
          return null;
        }
      } catch (err) {
        setError('Erreur lors de la generation des exercices');
        console.error('useVocabulaireExercises:', err);
        return null;
      } finally {
        setIsGenerating(false);
      }
    },
    [getAuthHeaders]
  );

  const validateProduction = useCallback(
    async (text: string, requiredWords: string[], constraint: string): Promise<ProductionValidation | null> => {
      const headers = await getAuthHeaders();
      if (!headers) return null;

      try {
        const res = await fetch('/api/vocabulaire/validate', {
          method: 'POST',
          headers,
          body: JSON.stringify({ text, requiredWords, constraint }),
        });

        const json = await res.json();
        return json.success ? json.data : null;
      } catch (err) {
        console.error('validateProduction:', err);
        return null;
      }
    },
    [getAuthHeaders]
  );

  const reset = useCallback(() => {
    setExercises([]);
    setTitle('');
    setError(null);
  }, []);

  return {
    exercises,
    title,
    isGenerating,
    error,
    generate,
    validateProduction,
    reset,
  };
}
