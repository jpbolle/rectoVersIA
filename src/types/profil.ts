export interface CriterionHistory {
  devoirName: string;
  date: string;
  score: number; // 0-100
}

export interface CriterionStats {
  name: string;
  averageScore: number;    // 0-100 — score de l'élève
  count: number;
  history: CriterionHistory[];
  classeAvg: number | null;
  classeMax: number | null;
  languageType?: 'ortho' | 'syntaxe' | 'lexique' | 'ponctuation';
}

export interface SectionStats {
  totalEvaluations: number;
  globalScore: number;
  classeAvg: number | null;
  classeMax: number | null;
  criteria: CriterionStats[];
}

export interface DevoirCriterionStat {
  name: string;
  score: number;           // score de l'élève pour ce devoir
  classeAvg: number | null;
  classeMax: number | null;
  languageType?: 'ortho' | 'syntaxe' | 'lexique' | 'ponctuation';
}

export interface DevoirStat {
  devoirId: string;
  name: string;
  date: string;
  type: 'ecrire' | 'lire' | 'rechercher';
  myScore: number;
  classeAvg: number | null;
  classeMax: number | null;
  criteria: DevoirCriterionStat[];
}

export interface StudentProfil {
  globalScore: number;
  totalEvaluations: number;
  travauxRemis: number;       // travaux écriture soumis
  reussites: number;          // corrections écriture score >= 60
  echecs: number;             // corrections écriture score < 60
  criteria: CriterionStats[]; // tous critères (rétrocompat)
  ecritureStats: SectionStats | null;
  lectureStats: SectionStats | null;
  devoirStats: DevoirStat[];  // stats par devoir pour le filtre
}
