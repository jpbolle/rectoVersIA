// Calendrier par défaut d'une scénarisation neuve — les congés ne tombent pas
// pareil chaque année, le prof corrige le nombre de semaines dans l'en-tête de
// chaque colonne de la vue Année.

import { PERIODES_ANNEE } from './scenarisation';

export const DEFAULT_SEMAINES: Record<string, number> = Object.fromEntries(
  PERIODES_ANNEE.map((p) => [p.id, p.semainesDefaut])
);
