export interface CriterionHistory {
  devoirName: string;
  date: string;
  score: number; // 0-100
}

export interface CriterionStats {
  name: string;
  grille?: string;         // grille d'évaluation d'origine (absent pour les critères de langue, agrégés toutes grilles)
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
  // Travaux marqués « non rendus, non justifiés » par le prof (note 0, hors stats)
  nonRendusSanctionnes: { intitule: string; date: string }[];
  lire: { score: number; evaluations: number } | null;
  ecrire: { score: number; evaluations: number } | null;
  rechercher: { remises: number; total: number } | null;
  vocabulaire: {
    // Répartition des mots par niveau de maîtrise (mêmes seuils que l'onglet Vocabulaire)
    maitrise: number;
    moyen: number;
    faible: number;
    inconnu: number;
    total: number;
    activites: number;          // nb d'activités vocabulaire
    evalMoyenne: number | null; // moyenne des évaluations (%), null si aucune
  } | null;
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

// Statistiques d'une activité vocabulaire (un devoir de type vocabulaire)
export interface VocabActiviteStat {
  devoirId: string;
  intitule: string;
  date: string;
  ouvertures: number;            // séances d'étude (ouvertures de l'activité)
  timeSpentSeconds: number;      // temps actif cumulé — 0 = pas encore mesuré
  learningSessions: number;      // sessions d'exercices d'apprentissage
  totalWords: number;
  // Répartition des mots de la série par niveau de maîtrise
  repartition: { maitrise: number; moyen: number; faible: number; inconnu: number };
  // [0] = diagnostic initial, la suite = diagnostics intermédiaires
  diagnostics: { date: string; correct: number; total: number }[];
  evaluations: { date: string; percentage: number }[];
}

export interface ProfilVocabulaire {
  groups: ProfilVocabGroup[];
  perso: ProfilPersoWord[];
  activites: VocabActiviteStat[];
}
