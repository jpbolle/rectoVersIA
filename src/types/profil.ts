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

// ─── Refonte en onglets (2026-08) — un payload par onglet ───

// Onglet Général — données élève uniquement (pas de stats de classe : rapide)
export interface ProfilGeneral {
  travauxRemis: number;       // travaux écriture soumis
  reussites: number;          // corrections écriture score >= 60
  echecs: number;             // corrections écriture score < 60
  attention: string[];        // pires critères d'écriture (score < 50)
  lire: { score: number; evaluations: number } | null;
  ecrire: { score: number; evaluations: number } | null;
  rechercher: { remises: number; total: number } | null;
  vocabulaire: { connus: number; total: number } | null;
}

// Onglets Lire / Écrire
export interface ProfilSection {
  stats: SectionStats | null;
  devoirs: DevoirStat[];      // pour le filtre par activité
}

// Onglet Rechercher — une entrée par recherche guidée NavigKid
export interface RechercheItem {
  devoirId: string;
  titre: string;
  date: string;               // soumisLe si remise, sinon date du devoir
  soumise: boolean;
  nbQuestions: number;
  nbReponses: number;         // questions avec une réponse non vide
  sitesConsultes: number;
  passages: number;           // passages surlignés
}

// Onglet Vocabulaire
export interface ProfilVocabWord {
  word: string;
  level: number;              // 0 jamais testé · 1 aucune réussite · 2-3 fragile · 4-5 connu
  attempts: number;
  successes: number;          // réussites (un demi-point compte 0,5)
}

export interface ProfilVocabGroup {
  id: string;
  name: string;
  isPerso: boolean;
  words: ProfilVocabWord[];
}

export interface ProfilPersoWord {
  word: string;
  definition: string;
  addedAt: string | null;
}

export interface ProfilVocabulaire {
  groups: ProfilVocabGroup[];
  perso: ProfilPersoWord[];
}
