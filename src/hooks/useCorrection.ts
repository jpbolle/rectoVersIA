'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import type { Correction, UpdateCorrectionData, AudioAnnotation, DraftItemAnnotation } from '@/types/correction';
import type { Grille } from '@/types/grille';
import { LEVEL_PERCENTAGES } from '@/types/grille';

const DEBOUNCE_DELAY = 2000;

// Calcule le score total a partir de l'evaluation et de la grille
export function calculateScore(
  evaluation: Record<string, number>,
  grille: Grille | null
): number {
  if (!grille || !evaluation) return 0;

  let totalPoints = 0;
  let maxPoints = 0;

  for (const criterion of grille.criteria) {
    maxPoints += criterion.weight;
    const selectedLevel = evaluation[criterion.id];
    if (selectedLevel !== undefined) {
      const pct = LEVEL_PERCENTAGES[selectedLevel] ?? 0;
      totalPoints += (criterion.weight * pct) / 100;
    }
  }

  if (maxPoints === 0) return 0;
  return Math.round((totalPoints / maxPoints) * 100);
}

export function useCorrection(travailId: string | null, devoirId: string | null, studentId: string | null, grille: Grille | null) {
  const { role, getAuthHeaders } = useAuth();
  const [correction, setCorrection] = useState<Correction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdate = useRef<UpdateCorrectionData | null>(null);

  // Fetch correction existante
  const fetchCorrection = useCallback(async () => {
    if (!travailId || role !== 'prof') {
      setIsLoading(false);
      return;
    }

    const headers = await getAuthHeaders();
    if (!headers) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/corrections?travailId=${travailId}`, { headers });
      const json = await res.json();

      if (json.success) {
        setCorrection(json.data);
      }
    } catch (err) {
      console.error('Erreur fetchCorrection:', err);
      setError('Erreur lors du chargement de la correction');
    } finally {
      setIsLoading(false);
    }
  }, [travailId, role, getAuthHeaders]);

  // Creer la correction si elle n'existe pas
  const ensureCorrection = useCallback(async (): Promise<Correction | null> => {
    if (correction) return correction;
    if (!travailId || !devoirId || !studentId) return null;

    const headers = await getAuthHeaders();
    if (!headers) return null;

    try {
      const res = await fetch('/api/corrections', {
        method: 'POST',
        headers,
        body: JSON.stringify({ travailId, devoirId, studentId }),
      });
      const json = await res.json();

      if (json.success) {
        setCorrection(json.data);
        return json.data;
      }
    } catch (err) {
      console.error('Erreur ensureCorrection:', err);
      setError('Erreur lors de la creation de la correction');
    }
    return null;
  }, [correction, travailId, devoirId, studentId, getAuthHeaders]);

  // Sauvegarde immediate
  const saveNow = useCallback(async (data: UpdateCorrectionData) => {
    let corr = correction;
    if (!corr) {
      corr = await ensureCorrection();
      if (!corr) return false;
    }

    const headers = await getAuthHeaders();
    if (!headers) return false;

    setIsSaving(true);

    try {
      const res = await fetch(`/api/corrections/${corr.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(data),
      });
      const json = await res.json();

      if (json.success) {
        setCorrection(prev => prev ? { ...prev, ...data, updatedAt: new Date().toISOString() } : null);
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
  }, [correction, ensureCorrection, getAuthHeaders]);

  // Sauvegarde avec debounce
  const saveWithDebounce = useCallback((data: UpdateCorrectionData) => {
    pendingUpdate.current = { ...pendingUpdate.current, ...data };

    // Maj locale immediate
    setCorrection(prev => {
      if (prev) {
        return { ...prev, ...data, updatedAt: new Date().toISOString() };
      }
      return prev;
    });

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

  // Mettre a jour l'evaluation du prof (avec recalcul du score)
  const updateEvaluation = useCallback((evaluation: Record<string, number>) => {
    const score = calculateScore(evaluation, grille);
    saveWithDebounce({ evaluation, score });
  }, [saveWithDebounce, grille]);

  // Sauvegarde du contenu annote (debounce)
  const updateAnnotatedContent = useCallback((html: string) => {
    saveWithDebounce({ annotatedContent: html });
  }, [saveWithDebounce]);

  // Sauvegarde des annotations audio (immediate)
  const updateAudioAnnotations = useCallback(async (annotations: AudioAnnotation[]) => {
    await saveNow({ audioAnnotations: annotations });
  }, [saveNow]);

  // Sauvegarde des annotations sur le brouillon (immediate)
  const updateDraftAnnotations = useCallback(async (annotations: Record<string, DraftItemAnnotation>) => {
    await saveNow({ draftAnnotations: annotations });
  }, [saveNow]);

  // Points d'une question ouverte d'un questionnaire de lecture (debounce :
  // le prof tape au clavier). null = note retirée.
  const updateQuestionScore = useCallback((questionId: string, points: number | null) => {
    setCorrection((prev) => {
      const next = { ...(prev?.questionScores ?? {}) };
      if (points === null) delete next[questionId];
      else next[questionId] = points;
      saveWithDebounce({ questionScores: next });
      return prev ? { ...prev, questionScores: next } : prev;
    });
  }, [saveWithDebounce]);

  // Sauvegarde du commentaire général écrit (debounce)
  const updateCommentaireGeneral = useCallback((text: string) => {
    saveWithDebounce({ commentaireGeneral: text });
  }, [saveWithDebounce]);

  // Sauvegarde du commentaire général audio (immediate)
  const updateCommentaireGeneralAudio = useCallback(async (audioData: string | undefined) => {
    await saveNow({ commentaireGeneralAudio: audioData || '' });
  }, [saveNow]);

  // Toggle visibilite eleve (sauvegarde immediate)
  const toggleVisibility = useCallback(async () => {
    const corr = correction || await ensureCorrection();
    if (!corr) return;
    const newValue = !corr.visibleParEleve;
    setCorrection(prev => prev ? { ...prev, visibleParEleve: newValue } : null);
    await saveNow({ visibleParEleve: newValue });
  }, [correction, ensureCorrection, saveNow]);

  // Nettoyage timer
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  // Charger au montage
  useEffect(() => {
    if (travailId && role === 'prof') {
      fetchCorrection();
    }
  }, [travailId, role, fetchCorrection]);

  return {
    correction,
    isLoading,
    isSaving,
    error,
    updateEvaluation,
    updateAnnotatedContent,
    updateAudioAnnotations,
    updateDraftAnnotations,
    updateCommentaireGeneral,
    updateCommentaireGeneralAudio,
    updateQuestionScore,
    toggleVisibility,
    refetch: fetchCorrection,
  };
}
