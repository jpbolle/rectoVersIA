'use client';

// ═══ L'activité ouverte (gestion des coûts IA, 2026-10-15) ═══
//
// Une page d'activité déclare son identifiant ; `getAuthHeaders`
// (AuthContext) l'ajoute à toutes les requêtes dans l'en-tête `X-Activite`.
// Les routes IA s'en servent pour attribuer chaque appel Claude à son activité
// (coût par activité, coupure ciblée) sans que chaque composant ait à le
// transmettre. Simple étiquette d'attribution : jamais un droit d'accès.

import { useEffect } from 'react';

let courante: string | null = null;

export function activiteCourante(): string | null {
  return courante;
}

/** À appeler dans une page d'activité ; efface l'étiquette en la quittant */
export function useActiviteCourante(devoirId: string | null | undefined): void {
  useEffect(() => {
    if (!devoirId) return;
    courante = devoirId;
    return () => {
      if (courante === devoirId) courante = null;
    };
  }, [devoirId]);
}
