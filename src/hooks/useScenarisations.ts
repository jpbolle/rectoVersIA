'use client';

// Scénarisations didactiques du prof connecté.
//
// L'écran d'encodage modifie beaucoup et souvent (chaque frappe dans une
// cellule) : l'état vit ici, et l'enregistrement part en différé (2,5 s après
// la dernière modification), comme l'auto-save des travaux.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import type { Scenarisation } from '@/types/scenarisation';
import { DEFAULT_SEMAINES } from '@/types/scenarisation-defaults';

const SAVE_DELAY = 2500;

export function useScenarisations() {
  const { getAuthHeaders } = useAuth();
  const [scenarisations, setScenarisations] = useState<Scenarisation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timer = useRef<NodeJS.Timeout | null>(null);
  const enAttente = useRef<Scenarisation | null>(null);

  const charger = useCallback(async () => {
    const headers = await getAuthHeaders();
    if (!headers) return;
    try {
      const res = await fetch('/api/scenarisations', { headers });
      const json = await res.json();
      if (json.success) setScenarisations(json.data);
      else setError(json.message || 'Chargement impossible');
    } catch {
      setError('Erreur réseau');
    } finally {
      setIsLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    charger();
  }, [charger]);

  const enregistrerMaintenant = useCallback(
    async (scen: Scenarisation) => {
      const headers = await getAuthHeaders();
      if (!headers) return;
      setIsSaving(true);
      try {
        const res = await fetch(`/api/scenarisations/${scen.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(scen),
        });
        const json = await res.json();
        if (!json.success) setError(json.message || 'Enregistrement impossible');
        else setError(null);
      } catch {
        setError('Erreur réseau');
      } finally {
        setIsSaving(false);
      }
    },
    [getAuthHeaders]
  );

  // Modification locale immédiate, écriture différée
  const modifier = useCallback(
    (scen: Scenarisation) => {
      setScenarisations((prev) => prev.map((s) => (s.id === scen.id ? scen : s)));
      enAttente.current = scen;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        if (enAttente.current) enregistrerMaintenant(enAttente.current);
        enAttente.current = null;
      }, SAVE_DELAY);
    },
    [enregistrerMaintenant]
  );

  // Écrit sans attendre ce qui est en file — au changement de scénarisation
  // ou à la fermeture de la page
  const vider = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (enAttente.current) {
      enregistrerMaintenant(enAttente.current);
      enAttente.current = null;
    }
  }, [enregistrerMaintenant]);

  useEffect(() => () => vider(), [vider]);

  const creer = useCallback(
    async (nom: string): Promise<Scenarisation | null> => {
      const headers = await getAuthHeaders();
      if (!headers) return null;
      try {
        const res = await fetch('/api/scenarisations', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            nom,
            dureePeriodeMin: 90,
            heuresParSemaine: 5,
            semaines: DEFAULT_SEMAINES,
            chapitres: [],
          }),
        });
        const json = await res.json();
        if (!json.success) {
          setError(json.message || 'Création impossible');
          return null;
        }
        setScenarisations((prev) => [json.data, ...prev]);
        return json.data as Scenarisation;
      } catch {
        setError('Erreur réseau');
        return null;
      }
    },
    [getAuthHeaders]
  );

  const supprimer = useCallback(
    async (id: string) => {
      const headers = await getAuthHeaders();
      if (!headers) return;
      await fetch(`/api/scenarisations/${id}`, { method: 'DELETE', headers });
      setScenarisations((prev) => prev.filter((s) => s.id !== id));
    },
    [getAuthHeaders]
  );

  return { scenarisations, isLoading, isSaving, error, modifier, creer, supprimer, vider, refetch: charger };
}
