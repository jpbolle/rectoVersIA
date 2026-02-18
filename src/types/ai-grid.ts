export interface AiGridCriterionResult {
  criterionIndex: number;     // index 0-based du critère dans la grille
  criterionId: string;        // id du critère (ex: "crit-xxxx")
  selectedLevel: number;      // 0-5
  selectedPercentage: number; // 0, 15, 35, 60, 80, 100
  indicateur: string;         // texte exact de l'indicateur choisi
  justification: string;      // explication pédagogique
}

export interface AiGridResult {
  id: string;                 // "AIGRID-{travailId}"
  travailId: string;
  devoirId: string;
  studentId: string;
  grilleId: string;
  criteria: AiGridCriterionResult[];
  commentaireFinal: string;   // commentaire encourageant global
  textSnapshot: string;       // HTML du texte au moment de l'appel
  createdAt: string;
}
