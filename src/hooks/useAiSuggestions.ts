'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import type { AiSuggestion, AiSuggestionType } from '@/types/ai-suggestions';

type SuggestionsMap = Record<AiSuggestionType, AiSuggestion | null>;

export function useAiSuggestions(travailId: string | undefined, devoirId: string | undefined) {
  const { isAuthenticated, getAuthHeaders } = useAuth();
  const [suggestions, setSuggestions] = useState<SuggestionsMap>({
    ortho: null,
    ponctu: null,
    synt: null,
    lex: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [activeRequest, setActiveRequest] = useState<AiSuggestionType | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Charger les suggestions existantes au mount
  const fetchSuggestions = useCallback(async () => {
    if (!travailId) {
      setIsLoading(false);
      return;
    }
    const headers = await getAuthHeaders();
    if (!headers) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/ai/writing-help?travailId=${travailId}`, { headers });
      const json = await res.json();
      if (json.success && json.data) {
        const map: Partial<SuggestionsMap> = {};
        for (const s of json.data as AiSuggestion[]) {
          map[s.type] = s;
        }
        setSuggestions(prev => ({ ...prev, ...map }));
      }
    } catch (err) {
      console.error('Erreur fetch AI suggestions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [travailId, getAuthHeaders]);

  useEffect(() => {
    if (isAuthenticated && travailId) {
      fetchSuggestions();
    } else {
      setIsLoading(false);
    }
  }, [isAuthenticated, travailId, fetchSuggestions]);

  // Demander une analyse IA
  const requestAnalysis = useCallback(async (
    type: AiSuggestionType,
    content: string,
  ): Promise<AiSuggestion | null> => {
    if (!travailId || !devoirId) return null;
    const headers = await getAuthHeaders();
    if (!headers) return null;

    // Déjà utilisé ?
    if (suggestions[type]) return suggestions[type];

    setActiveRequest(type);
    setError(null);

    try {
      const res = await fetch('/api/ai/writing-help', {
        method: 'POST',
        headers,
        body: JSON.stringify({ travailId, devoirId, type, content }),
      });
      const json = await res.json();

      if (json.success && json.data) {
        const suggestion = json.data as AiSuggestion;
        setSuggestions(prev => ({ ...prev, [type]: suggestion }));
        return suggestion;
      } else {
        setError(json.error || 'Erreur lors de l\'analyse IA');
        return null;
      }
    } catch (err) {
      console.error('Erreur requestAnalysis:', err);
      setError('Erreur de connexion');
      return null;
    } finally {
      setActiveRequest(null);
    }
  }, [travailId, devoirId, suggestions, getAuthHeaders]);

  // Marquer une suggestion comme traitée
  const dismissSuggestion = useCallback(async (
    type: AiSuggestionType,
    itemId: string,
  ) => {
    const suggestion = suggestions[type];
    if (!suggestion) return;

    const headers = await getAuthHeaders();
    if (!headers) return;

    // Mise à jour optimiste
    const updatedItems = suggestion.suggestions.map(s =>
      s.id === itemId ? { ...s, dismissed: true } : s
    );
    const updatedSuggestion = { ...suggestion, suggestions: updatedItems };
    setSuggestions(prev => ({ ...prev, [type]: updatedSuggestion }));

    // Persister
    try {
      await fetch(`/api/ai/writing-help/${suggestion.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ itemId, dismissed: true }),
      });
    } catch (err) {
      console.error('Erreur dismiss:', err);
      // Revert en cas d'échec
      setSuggestions(prev => ({ ...prev, [type]: suggestion }));
    }
  }, [suggestions, getAuthHeaders]);

  // Types déjà utilisés
  const usedTypes: Set<AiSuggestionType> = new Set();
  for (const [type, value] of Object.entries(suggestions)) {
    if (value) usedTypes.add(type as AiSuggestionType);
  }

  return {
    suggestions,
    isLoading,
    activeRequest,
    error,
    requestAnalysis,
    dismissSuggestion,
    usedTypes,
  };
}
