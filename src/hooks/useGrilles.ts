'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import type { Grille, CreateGrilleData, GrilleCriterion } from '@/types/grille';

export function useGrilles() {
  const { isAuthenticated, getAuthHeaders } = useAuth();
  const [grilles, setGrilles] = useState<Grille[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGrilles = useCallback(async () => {
    const headers = await getAuthHeaders();
    if (!headers) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/grilles', { headers });
      const json = await res.json();

      if (json.success) {
        setGrilles(json.data);
      } else {
        setError(json.message || 'Erreur lors du chargement');
      }
    } catch (err) {
      console.error('Erreur fetchGrilles:', err);
      setError('Erreur lors du chargement des grilles');
    } finally {
      setIsLoading(false);
    }
  }, [getAuthHeaders]);

  const createGrille = useCallback(
    async (data: CreateGrilleData): Promise<Grille> => {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error('Non authentifié');

      const res = await fetch('/api/grilles', {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      const json = await res.json();

      if (json.success) {
        const newGrille = json.data as Grille;
        setGrilles((prev) => [newGrille, ...prev]);
        return newGrille;
      } else {
        throw new Error(json.message || 'Erreur lors de la création');
      }
    },
    [getAuthHeaders]
  );

  const updateGrille = useCallback(
    async (id: string, data: Partial<Grille>): Promise<Grille> => {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error('Non authentifié');

      const res = await fetch(`/api/grilles/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(data),
      });

      const json = await res.json();

      if (json.success) {
        const updated = json.data as Grille;
        setGrilles((prev) =>
          prev.map((g) => (g.id === id ? updated : g))
        );
        return updated;
      } else {
        throw new Error(json.message || 'Erreur lors de la mise à jour');
      }
    },
    [getAuthHeaders]
  );

  const deleteGrille = useCallback(
    async (id: string): Promise<void> => {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error('Non authentifié');

      const res = await fetch(`/api/grilles/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers,
      });

      const json = await res.json();

      if (json.success) {
        setGrilles((prev) => prev.filter((g) => g.id !== id));
      } else {
        throw new Error(json.message || 'Erreur lors de la suppression');
      }
    },
    [getAuthHeaders]
  );

  useEffect(() => {
    if (isAuthenticated) {
      fetchGrilles();
    }
  }, [isAuthenticated, fetchGrilles]);

  // Noms des grilles (pour retrocompat avec useGrilleTypes)
  const grilleNames = grilles.filter((g) => !g.archive).map((g) => g.name);

  return {
    grilles,
    grilleNames,
    isLoading,
    error,
    createGrille,
    updateGrille,
    deleteGrille,
    refetch: fetchGrilles,
  };
}
