export interface GrilleLevel {
  level: number;       // 0, 1, 2, 3, 4, 5
  indicators: string[]; // Liste d'indicateurs pour ce niveau
}

export interface GrilleCriterion {
  id: string;          // Identifiant unique du critere (ex: crit-xxxx)
  name: string;        // Nom du critere
  weight: number;      // Poids/ponderation (note max)
  order: number;       // Position dans la grille
  levels: GrilleLevel[];
}

export interface Grille {
  id: string;          // GRL-YYYYMMDD-XXXX
  name: string;        // Nom de la grille
  description?: string;
  uaa: number[];       // UAA ciblées (ex: [0, 3])
  profId: string;
  anneeScolaire: string;
  archive: boolean;
  criteria: GrilleCriterion[];
  createdAt: string;
  updatedAt: string;
}

// Donnees pour la creation d'une grille
export interface CreateGrilleData {
  name: string;
  description?: string;
  uaa?: number[];
  criteria: Omit<GrilleCriterion, 'id'>[];
}

// Labels fixes des 6 niveaux du bareme
export const LEVEL_LABELS: Record<number, string> = {
  0: 'Néant',
  1: 'Très insuffisant',
  2: 'Insuffisant',
  3: 'Suffisant',
  4: 'Acquis',
  5: 'Parfaitement acquis',
};

// UAA du programme de français (Langue, Communication, Culture)
export const UAA_LIST: { id: number; label: string }[] = [
  { id: 0, label: 'Justifier une réponse, expliciter une procédure' },
  { id: 1, label: 'Rechercher, collecter l\'information et en garder des traces' },
  { id: 2, label: 'Réduire, résumer, comparer et synthétiser' },
  { id: 3, label: 'Défendre une opinion par écrit' },
  { id: 4, label: 'Défendre oralement une opinion et négocier' },
  { id: 5, label: 'S\'inscrire dans une œuvre culturelle' },
  { id: 6, label: 'Relater des expériences culturelles' },
];

// Pourcentages fixes des 6 niveaux
export const LEVEL_PERCENTAGES: Record<number, number> = {
  0: 0,
  1: 15,
  2: 35,
  3: 60,
  4: 80,
  5: 100,
};
