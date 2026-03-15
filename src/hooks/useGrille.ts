'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import type { Grille } from '@/types/grille';

export function useGrille(grilleName: string | null) {
  const { isAuthenticated, getAuthHeaders } = useAuth();
  const [grille, setGrille] = useState<Grille | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGrille = useCallback(async () => {
    if (!grilleName) {
      setGrille(null);
      return;
    }

    const headers = await getAuthHeaders();
    if (!headers) return;

    setIsLoading(true);
    setError(null);

    try {
      const encodedName = encodeURIComponent(grilleName);
      const res = await fetch(`/api/grilles/${encodedName}`, { headers });
      const json = await res.json();

      if (json.success) {
        setGrille(json.data);
      } else {
        setError(json.message || 'Erreur lors du chargement de la grille');
        setGrille(null);
      }
    } catch (err) {
      console.error('Erreur fetchGrille:', err);
      setError('Erreur lors du chargement de la grille');
      setGrille(null);
    } finally {
      setIsLoading(false);
    }
  }, [grilleName, getAuthHeaders]);

  useEffect(() => {
    if (isAuthenticated && grilleName) {
      fetchGrille();
    }
  }, [isAuthenticated, grilleName, fetchGrille]);

  return {
    grille,
    isLoading,
    error,
    refetch: fetchGrille,
  };
}
