// ═══ Gestion des coûts IA : ce que la page admin reçoit (2026-10-15) ═══
// Calculé par src/lib/rapport-couts.ts depuis `consommationIa`.

export interface CompteCouts {
  cout: number;
  appels: number;
  echecs: number;
  /** Dépense des appels ratés : facturée pour rien */
  coutEchecs: number;
}

export interface CoutJour extends CompteCouts {
  jour: string;
}

export interface CoutFonction extends CompteCouts {
  fonction: string;
}

export interface CoutModele extends CompteCouts {
  modele: string;
}

export interface CoutEleve extends CompteCouts {
  uid: string;
  nom: string;
}

export interface CoutActivite extends CompteCouts {
  /** `null` = appels faits hors d'une activité (prof qui prépare, dictionnaire…) */
  devoirId: string | null;
  titre: string;
  prof: string;
  classes: string;
  eleves: number;
  coutParEleve: number;
  suspendue: boolean;
  detailEleves: CoutEleve[];
  fonctions: string[];
}

export interface ErreurFrequente {
  cle: string;
  fonction: string;
  nombre: number;
  dernier: string;
  exemple: string;
  devoirId: string | null;
}

export interface AlerteVue {
  id: string;
  at: string;
  type: string;
  message: string;
  rapport: string[];
  devoirId: string | null;
  titreActivite: string | null;
  vue: boolean;
}

export interface SuspensionVue {
  devoirId: string;
  titre: string;
  at: string;
  raison: string;
  rapport: string[];
}

export interface CoutConsole {
  /** `false` : clé Admin absente (`ANTHROPIC_ADMIN_KEY`) */
  configure: boolean;
  erreur?: string;
  total?: number;
  parJour?: { jour: string; cout: number }[];
  parModele?: { modele: string; cout: number }[];
}

export interface RapportCouts {
  mois: string;
  aujourdhui: string;
  totaux: { jour: CompteCouts; mois: CompteCouts; septJours: CompteCouts };
  parJour: CoutJour[];
  parFonction: CoutFonction[];
  parModele: CoutModele[];
  parActivite: CoutActivite[];
  erreurs: ErreurFrequente[];
  alertes: AlerteVue[];
  suspensions: SuspensionVue[];
  console: CoutConsole;
  seuils: {
    coutJour: number;
    coutActiviteJour: number;
    appelsMinimum: number;
    tauxEchecAlerte: number;
    tauxEchecCoupure: number;
    appelsEleveJour: number;
  };
  /** Première trace en base : avant, rien n'était compté */
  depuis: string | null;
}
