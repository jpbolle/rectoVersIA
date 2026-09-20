'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import type { Correction, UpdateCorrectionData, AudioAnnotation, DraftItemAnnotation } from '@/types/correction';
import type { AutoEvalAnswer } from '@/types/autoevaluation';
import type { Grille } from '@/types/grille';
import type { RechercheQuestionScore } from '@/types/navigkid';
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

  // ── Le dernier état connu, lisible SANS updater de `setState` ──
  // ⚠ Les fonctions qui modifient une carte de notes (`questionScores`,
  // `rechercheScores`, `autoEvalProf`) appelaient l'enregistrement À
  // L'INTÉRIEUR d'un updater de `setCorrection`. Or cette fonction doit être
  // PURE (gotcha init.md) : React la rejoue, et la sauvegarde partait deux
  // fois ou pas du tout — le prof devait cliquer ✔ / ✘ plusieurs fois avant
  // que la note prenne (signalé le 2026-09-20).
  // Le ref est remis à jour À LA MAIN dans ces fonctions : deux clics rapides
  // doivent s'ajouter l'un à l'autre, pas s'écraser en attendant le rendu.
  const correctionRef = useRef<Correction | null>(null);
  useEffect(() => {
    correctionRef.current = correction;
  }, [correction]);

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

  // ⚠ La création est DESTRUCTRICE côté serveur (`.set()` réécrit le document
  // entier, notes comprises). Deux gestes rapprochés sur une copie encore
  // vierge lanceraient deux créations, et la seconde effacerait la première.
  // Ce verrou fait que tout le monde attend la MÊME création.
  const creationEnCours = useRef<Promise<Correction | null> | null>(null);

  // Creer la correction si elle n'existe pas
  const ensureCorrection = useCallback(async (): Promise<Correction | null> => {
    if (correctionRef.current) return correctionRef.current;
    if (correction) return correction;
    if (!travailId || !devoirId || !studentId) return null;
    if (creationEnCours.current) return creationEnCours.current;

    const creer = async (): Promise<Correction | null> => {
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
          correctionRef.current = json.data;
          setCorrection(json.data);
          return json.data;
        }
      } catch (err) {
        console.error('Erreur ensureCorrection:', err);
        setError('Erreur lors de la creation de la correction');
      }
      return null;
    };

    creationEnCours.current = creer().finally(() => {
      creationEnCours.current = null;
    });
    return creationEnCours.current;
  }, [correction, travailId, devoirId, studentId, getAuthHeaders]);

  // Sauvegarde immediate
  const saveNow = useCallback(async (data: UpdateCorrectionData) => {
    let corr = correctionRef.current ?? correction;
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
    if (correctionRef.current) {
      correctionRef.current = { ...correctionRef.current, evaluation, score };
      saveWithDebounce({ evaluation, score });
      return;
    }
    // Premier niveau coché sur cette copie : voir `updateQuestionScore`.
    void saveNow({ evaluation, score });
  }, [saveWithDebounce, saveNow, grille]);

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
    const next = { ...(correctionRef.current?.questionScores ?? {}) };
    if (points === null) delete next[questionId];
    else next[questionId] = points;
    if (correctionRef.current) {
      correctionRef.current = { ...correctionRef.current, questionScores: next };
      // `saveWithDebounce` pose lui-même la mise à jour locale.
      saveWithDebounce({ questionScores: next });
      return;
    }
    // ── Premier geste sur cette copie ──
    // Aucun document n'existe encore : la mise à jour locale de
    // `saveWithDebounce` n'aurait rien où s'accrocher et serait jetée en
    // silence, donc le ✔ resterait invisible. Pire, chaque nouveau clic
    // relançait la temporisation de 2 s, repoussant la sauvegarde d'autant —
    // le prof cliquait dix fois et attendait vingt secondes (2026-09-20).
    // On crée donc le document et on note dans la foulée.
    void saveNow({ questionScores: next });
  }, [saveWithDebounce, saveNow]);

  // Correction d'une question de recherche : note et/ou remarque, sur la
  // réponse ou sur la démarche (debounce — le prof tape au clavier).
  // Un champ mis à null est retiré : la note redevient automatique (QCM) ou
  // absente (question ouverte, démarche).
  const updateRechercheScore = useCallback(
    (questionIndex: number, patch: Partial<RechercheQuestionScore>) => {
      const next = { ...(correctionRef.current?.rechercheScores ?? {}) };
      const cle = String(questionIndex);
      const entry: RechercheQuestionScore = { ...(next[cle] ?? {}) };
      (Object.keys(patch) as (keyof RechercheQuestionScore)[]).forEach((champ) => {
        const valeur = patch[champ];
        if (valeur === null || valeur === undefined || valeur === '') delete entry[champ];
        else (entry as Record<string, unknown>)[champ] = valeur;
      });
      if (Object.keys(entry).length === 0) delete next[cle];
      else next[cle] = entry;
      if (correctionRef.current) {
        correctionRef.current = { ...correctionRef.current, rechercheScores: next };
        saveWithDebounce({ rechercheScores: next });
        return;
      }
      // Premier geste sur cette copie : voir `updateQuestionScore`.
      void saveNow({ rechercheScores: next });
    },
    [saveWithDebounce, saveNow]
  );

  // Regard du PROF sur une question d'auto-évaluation. Ce n'est pas une note :
  // c'est sa propre réponse à la question posée à l'élève, dont l'écart dira
  // la lucidité de celui-ci. Enregistrée aussitôt — c'est un clic, pas de la
  // frappe, et c'est elle qui déverrouille la réponse de l'élève à l'écran.
  const updateAutoEvalProf = useCallback(
    (questionId: string, answer: AutoEvalAnswer) => {
      const next = { ...(correctionRef.current?.autoEvalProf ?? {}) };
      const vide =
        (answer.echelon === null || answer.echelon === undefined) &&
        (answer.likert === null || answer.likert === undefined);
      if (vide) delete next[questionId];
      else next[questionId] = { ...next[questionId], ...answer };
      if (correctionRef.current) correctionRef.current = { ...correctionRef.current, autoEvalProf: next };
      // `saveNow` n'affiche rien avant la réponse du serveur : on pose la mise
      // à jour locale nous-mêmes, sinon le clic reste sans effet visible.
      setCorrection((prev) => (prev ? { ...prev, autoEvalProf: next } : prev));
      saveNow({ autoEvalProf: next });
    },
    [saveNow]
  );

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
    updateRechercheScore,
    updateAutoEvalProf,
    toggleVisibility,
    refetch: fetchCorrection,
  };
}
