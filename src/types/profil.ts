export interface CriterionHistory {
  devoirName: string;
  date: string;
  score: number; // 0-100
}

export interface CriterionStats {
  name: string;
  averageScore: number;   // 0-100
  count: number;           // nombre d'évaluations
  history: CriterionHistory[];
}

export interface StudentProfil {
  globalScore: number;     // 0-100
  totalEvaluations: number;
  criteria: CriterionStats[];
}
