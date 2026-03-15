'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import type { AiGridResult } from '@/types/ai-grid';

export function useAiGridEvaluation(
  travailId: string | undefined,
  devoirId: string | undefined,
  grilleId: string | undefined,
) {
  const { isAuthenticated, getAuthHeaders } = useAuth();
  const [result, setResult] = useState<AiGridResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charger le résultat existant au mount
  const fetchResult = useCallback(async () => {
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
      const res = await fetch(`/api/ai/grid-eval?travailId=${travailId}`, { headers });
      const json = await res.json();
      if (json.success && json.data) {
        setResult(json.data as AiGridResult);
      }
    } catch (err) {
      console.error('Erreur fetch AI grid evaluation:', err);
    } finally {
      setIsLoading(false);
    }
  }, [travailId, getAuthHeaders]);

  useEffect(() => {
    if (isAuthenticated && travailId) {
      fetchResult();
    } else {
      setIsLoading(false);
    }
  }, [isAuthenticated, travailId, fetchResult]);

  // Demander une évaluation IA
  const requestEvaluation = useCallback(async (
    content: string,
  ): Promise<AiGridResult | null> => {
    if (!travailId || !devoirId || !grilleId) return null;
    const headers = await getAuthHeaders();
    if (!headers) return null;

    // Déjà fait ?
    if (result) return result;

    setIsRequesting(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/grid-eval', {
        method: 'POST',
        headers,
        body: JSON.stringify({ travailId, devoirId, grilleId, content }),
      });
      const json = await res.json();

      if (json.success && json.data) {
        const gridResult = json.data as AiGridResult;
        setResult(gridResult);
        return gridResult;
      } else {
        setError(json.error || "Erreur lors de l'évaluation IA");
        return null;
      }
    } catch (err) {
      console.error('Erreur requestEvaluation:', err);
      setError('Erreur de connexion');
      return null;
    } finally {
      setIsRequesting(false);
    }
  }, [travailId, devoirId, grilleId, result, getAuthHeaders]);

  return {
    result,
    isLoading,
    isRequesting,
    error,
    requestEvaluation,
    hasResult: result !== null,
  };
}
