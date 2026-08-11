'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import type { Travail, UpdateTravailData } from '@/types/travail';

const DEBOUNCE_DELAY = 2500; // 2.5 secondes

export function useTravail(devoirId: string | null) {
  const { isAuthenticated, role, getAuthHeaders } = useAuth();
  const [travail, setTravail] = useState<Travail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdate = useRef<UpdateTravailData | null>(null);
  const travailRef = useRef<Travail | null>(null);
  travailRef.current = travail;

  // Fetch le travail de l'eleve connecte
  const fetchTravail = useCallback(async () => {
    if (!devoirId || role !== 'eleve') {
      setTravail(null);
      setIsLoading(false);
      return;
    }

    const headers = await getAuthHeaders();
    if (!headers) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/travaux/mine?devoirId=${devoirId}`, { headers });
      const json = await res.json();

      if (json.success) {
        setTravail(json.data);
      } else {
        setError(json.message || 'Erreur lors du chargement du travail');
        setTravail(null);
      }
    } catch (err) {
      console.error('Erreur fetchTravail:', err);
      setError('Erreur lors du chargement du travail');
      setTravail(null);
    } finally {
      setIsLoading(false);
    }
  }, [devoirId, role, getAuthHeaders]);

  // Sauvegarde immediate
  const saveNow = useCallback(async (data: UpdateTravailData) => {
    if (!travailRef.current) return false;

    const headers = await getAuthHeaders();
    if (!headers) return false;

    setIsSaving(true);

    try {
      const res = await fetch(`/api/travaux/${travailRef.current.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(data),
      });

      const json = await res.json();

      if (json.success) {
        setLastSaved(new Date());
        // Mettre a jour l'etat local
        setTravail(prev => prev ? { ...prev, ...data, updatedAt: new Date().toISOString() } : null);
        return true;
      } else {
        setError(json.message || 'Erreur lors de la sauvegarde');
        return false;
      }
    } catch (err) {
      console.error('Erreur saveNow:', err);
      setError('Erreur lors de la sauvegarde');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [getAuthHeaders]);

  // Sauvegarde avec debounce
  const saveWithDebounce = useCallback((data: UpdateTravailData) => {
    // Ne pas sauvegarder si le travail est deja soumis
    if (travailRef.current?.status === 'submitted') {
      return;
    }

    // Fusionner avec les mises a jour en attente
    pendingUpdate.current = { ...pendingUpdate.current, ...data };

    // Mettre a jour l'etat local immediatement
    setTravail(prev => prev ? { ...prev, ...data } : null);

    // Annuler le timer precedent
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Programmer la sauvegarde
    debounceTimer.current = setTimeout(async () => {
      if (pendingUpdate.current) {
        await saveNow(pendingUpdate.current);
        pendingUpdate.current = null;
      }
    }, DEBOUNCE_DELAY);
  }, [saveNow]);

  // Mise a jour du contenu (avec debounce)
  const updateContent = useCallback((content: string) => {
    saveWithDebounce({ content });
  }, [saveWithDebounce]);

  // Mise a jour de l'auto-evaluation (avec debounce)
  const updateSelfEvaluation = useCallback((selfEvaluation: Record<string, number> | null) => {
    saveWithDebounce({ selfEvaluation });
  }, [saveWithDebounce]);

  // Mise a jour des annotations de ressource (avec debounce, autorise meme apres soumission)
  const updateRessourceAnnotations = useCallback((ressourceAnnotations: string) => {
    if (!travailRef.current) return;

    // Fusionner avec les mises a jour en attente
    pendingUpdate.current = { ...pendingUpdate.current, ressourceAnnotations };

    // Mettre a jour l'etat local immediatement
    setTravail(prev => prev ? { ...prev, ressourceAnnotations } : null);

    // Annuler le timer precedent
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Programmer la sauvegarde
    debounceTimer.current = setTimeout(async () => {
      if (pendingUpdate.current) {
        await saveNow(pendingUpdate.current);
        pendingUpdate.current = null;
      }
    }, DEBOUNCE_DELAY);
  }, [saveNow]);

  // Mise a jour du brouillon (avec debounce)
  const updateDraftContent = useCallback((draftContent: import('@/types/travail').DraftContent) => {
    saveWithDebounce({ draftContent });
  }, [saveWithDebounce]);

  // Mise a jour des notes de ressource (avec debounce, autorise meme apres soumission)
  const updateRessourceNotes = useCallback((ressourceNotes: Record<string, string>) => {
    if (!travailRef.current) return;

    pendingUpdate.current = { ...pendingUpdate.current, ressourceNotes };
    setTravail(prev => prev ? { ...prev, ressourceNotes } : null);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(async () => {
      if (pendingUpdate.current) {
        await saveNow(pendingUpdate.current);
        pendingUpdate.current = null;
      }
    }, DEBOUNCE_DELAY);
  }, [saveNow]);

  // Mise a jour des tracés sur images de ressources (avec debounce, autorise meme apres soumission)
  const updateRessourceImageShapes = useCallback((ressourceImageShapes: import('@/types/travail').Travail['ressourceImageShapes']) => {
    if (!travailRef.current) return;

    pendingUpdate.current = { ...pendingUpdate.current, ressourceImageShapes };
    setTravail(prev => prev ? { ...prev, ressourceImageShapes } : null);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(async () => {
      if (pendingUpdate.current) {
        await saveNow(pendingUpdate.current);
        pendingUpdate.current = null;
      }
    }, DEBOUNCE_DELAY);
  }, [saveNow]);

  // Soumission du travail (immediate)
  const submit = useCallback(async () => {
    // D'abord sauvegarder les changements en attente
    if (pendingUpdate.current) {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      await saveNow(pendingUpdate.current);
      pendingUpdate.current = null;
    }

    // Puis soumettre
    const success = await saveNow({ status: 'submitted' });
    if (success) {
      setTravail(prev => prev ? { ...prev, status: 'submitted', submittedAt: new Date().toISOString() } : null);
    }
    return success;
  }, [saveNow]);

  // Nettoyer le timer au demontage
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  // Charger le travail au montage
  useEffect(() => {
    if (isAuthenticated && devoirId) {
      fetchTravail();
    }
  }, [isAuthenticated, devoirId, fetchTravail]);

  return {
    travail,
    isLoading,
    isSaving,
    error,
    lastSaved,
    updateContent,
    updateDraftContent,
    updateSelfEvaluation,
    updateRessourceAnnotations,
    updateRessourceNotes,
    updateRessourceImageShapes,
    submit,
    refetch: fetchTravail,
  };
}
