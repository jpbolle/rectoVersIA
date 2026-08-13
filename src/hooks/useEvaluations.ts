'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import type { Grille } from '@/types/grille';

/**
 * Hook pour recuperer les noms de grilles (retrocompat)
 * Utilise par CreationForm et EditDevoirModal pour les dropdowns
 */
export function useGrilleTypes() {
  const { isAuthenticated, getAuthHeaders } = useAuth();
  const [grilleTypes, setGrilleTypes] = useState<string[]>([]);
  // Nom + types d'activité de chaque grille : sert à ne proposer, à la création
  // d'une activité, que les grilles rattachées à son atelier
  const [grilles, setGrilles] = useState<{ name: string; ateliers: string[] }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) return;

    async function fetchGrilles() {
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const res = await fetch('/api/grilles', {
          headers,
        });
        const json = await res.json();
        if (json.success) {
          // Mes grilles + grilles exemples (shared)
          const myGrilles: Grille[] = json.data || [];
          const sharedGrilles: Grille[] = json.shared || [];
          const allGrilles = [...myGrilles, ...sharedGrilles];
          const actives = allGrilles.filter((g) => !g.archive);
          setGrilleTypes(actives.map((g) => g.name));
          setGrilles(actives.map((g) => ({ name: g.name, ateliers: g.ateliers ?? [] })));
        }
      } catch (err) {
        console.error('Erreur fetchGrilles:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchGrilles();
  }, [isAuthenticated, getAuthHeaders]);

  return { grilleTypes, grilles, isLoading };
}
