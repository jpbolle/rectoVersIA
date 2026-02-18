'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import type { Professeur, CreateProfesseurData } from '@/types/professeur';

export function useProfesseurs() {
  const { user, isAuthenticated } = useAuth();
  const [professeurs, setProfesseurs] = useState<Professeur[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = useCallback(async () => {
    if (!user) return null;
    const token = await user.getIdToken();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }, [user]);

  const fetchProfesseurs = useCallback(async () => {
    const headers = await getAuthHeaders();
    if (!headers) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/professeurs', { headers });
      const json = await res.json();

      if (json.success) {
        setProfesseurs(json.data);
      } else {
        setError(json.message || 'Erreur lors du chargement');
      }
    } catch (err) {
      console.error('Erreur fetchProfesseurs:', err);
      setError('Erreur lors du chargement des professeurs');
    } finally {
      setIsLoading(false);
    }
  }, [getAuthHeaders]);

  const createProfesseur = useCallback(
    async (data: CreateProfesseurData): Promise<Professeur> => {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error('Non authentifié');

      const res = await fetch('/api/professeurs', {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      const json = await res.json();

      if (json.success) {
        setProfesseurs((prev) =>
          [...prev, json.data].sort((a, b) => a.nom.localeCompare(b.nom))
        );
        return json.data;
      } else {
        throw new Error(json.message || 'Erreur lors de la création');
      }
    },
    [getAuthHeaders]
  );

  const deleteProfesseur = useCallback(
    async (id: string): Promise<void> => {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error('Non authentifié');

      const res = await fetch(`/api/professeurs/${id}`, {
        method: 'DELETE',
        headers,
      });

      const json = await res.json();

      if (json.success) {
        setProfesseurs((prev) => prev.filter((p) => p.id !== id));
      } else {
        throw new Error(json.message || 'Erreur lors de la suppression');
      }
    },
    [getAuthHeaders]
  );

  useEffect(() => {
    if (isAuthenticated) {
      fetchProfesseurs();
    }
  }, [isAuthenticated, fetchProfesseurs]);

  return {
    professeurs,
    isLoading,
    error,
    createProfesseur,
    deleteProfesseur,
    refetch: fetchProfesseurs,
  };
}
