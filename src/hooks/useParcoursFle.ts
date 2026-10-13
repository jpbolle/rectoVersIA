'use client';

// Le PARCOURS d'une séquence FLE côté élève (plan 2026-10-13) : les étapes,
// l'étape ouverte dans la colonne 1, et le geste « J'ai lu, je continue »
// d'une théorie. Partagé par la colonne de travail et le sommaire du rail.
//
// Rien d'instable dans les dépendances (gotcha AGENTS.md) : `getAuthHeaders`
// vient d'AuthContext, stable.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { EtapeParcours, ParcoursFle } from '@/types/sequence-fle';

export interface ParcoursFleEleve {
  parcours: ParcoursFle | null;
  erreur: string | null;
  /** L'étape affichée dans la colonne 1 */
  etape: EtapeParcours | null;
  index: number;
  allerA: (etapeId: string) => void;
  /** Marque la théorie ouverte comme lue et passe à l'étape suivante */
  marquerLu: () => Promise<void>;
  enregistrement: boolean;
  faites: number;
  total: number;
}

export function etapeFaite(e: EtapeParcours): boolean {
  return e.etat === 'fait';
}

export function useParcoursFle(devoirId: string | null, isPreviewMode = false): ParcoursFleEleve {
  const { getAuthHeaders, isAuthenticated } = useAuth();
  const [parcours, setParcours] = useState<ParcoursFle | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [choix, setChoix] = useState<string | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);

  useEffect(() => {
    if (!devoirId || !isAuthenticated) return;
    let annule = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const res = await fetch(`/api/devoirs/${devoirId}/parcours-fle`, { headers });
        const json = await res.json();
        if (annule) return;
        if (json.success) setParcours(json.data);
        else setErreur(json.message || 'Impossible de charger la séquence.');
      } catch {
        if (!annule) setErreur('Impossible de charger la séquence.');
      }
    })();
    return () => {
      annule = true;
    };
  }, [devoirId, isAuthenticated, getAuthHeaders]);

  // L'étape ouverte : celle que l'élève a choisie, sinon la première pas
  // encore faite (sinon la dernière) — dérivé, pas un état
  const index = useMemo(() => {
    if (!parcours || parcours.etapes.length === 0) return -1;
    const choisie = choix ? parcours.etapes.findIndex((e) => e.id === choix) : -1;
    if (choisie >= 0) return choisie;
    const premiere = parcours.etapes.findIndex((e) => !etapeFaite(e));
    return premiere >= 0 ? premiere : parcours.etapes.length - 1;
  }, [parcours, choix]);
  const etape = parcours && index >= 0 ? parcours.etapes[index] : null;

  const marquerLu = useCallback(async () => {
    if (!parcours || !etape || etape.nature !== 'theorie') return;
    const suivante = parcours.etapes[index + 1];
    const poser = () =>
      setParcours((p) =>
        p ? { ...p, etapes: p.etapes.map((e) => (e.id === etape.id ? { ...e, etat: 'fait' } as EtapeParcours : e)) } : p
      );
    // Le prof en « Vue élève » voit le geste, rien n'est enregistré
    if (isPreviewMode) {
      poser();
      if (suivante) setChoix(suivante.id);
      return;
    }
    setEnregistrement(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch(`/api/devoirs/${parcours.devoirId}/parcours-fle`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ etapeId: etape.id, lu: true }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      poser();
      if (suivante) setChoix(suivante.id);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Enregistrement impossible.');
    } finally {
      setEnregistrement(false);
    }
  }, [parcours, etape, index, isPreviewMode, getAuthHeaders]);

  const faites = parcours?.etapes.filter(etapeFaite).length ?? 0;
  const total = parcours?.etapes.length ?? 0;

  return { parcours, erreur, etape, index, allerA: setChoix, marquerLu, enregistrement, faites, total };
}
