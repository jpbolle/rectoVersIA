export type Classe = string;
export type TypeTravail = 'ecrire' | 'lire' | 'rechercher' | 'vocabulaire';

export interface DevoirRessource {
  type: 'text';
  content: string;
  outils?: string;      // Plain text with URLs (displayed as clickable links)
  document?: string;    // Rich HTML content from Tiptap editor
}

export interface Devoir {
  id: string;
  classes: Classe[];  // Plusieurs classes possibles
  dateRemise: string;
  grille: string;
  intitule: string;
  consignes: string;
  ressources: DevoirRessource | null;
  accesIA: boolean;
  disponible: boolean;
  archive: boolean;
  corrige: boolean;
  corrigeDisponible: boolean;
  createdAt: string;
  anneeScolaire: string;
  profId: string;
  typeTravail: TypeTravail;
  questionnaireId?: string;       // Référence vers questionnaires/{id} (type rechercher)
  codeAcces?: string;             // Code 6 chars pour l'extension Chrome (type rechercher)
  vocabulaireThemes?: string[];   // Séries lexicales imposées (type vocabulaire)
  vocabulaireDiagnostic?: boolean; // Mode diagnostic activé (type vocabulaire)
  // Inverse recto/verso de la colonne 1 (type ecrire uniquement)
  // false (defaut) : recto = espace de redaction, verso = espace de planification
  // true           : recto = espace de planification, verso = espace de redaction
  flipInverted?: boolean;
}

export interface CreateDevoirData {
  classes: Classe[];  // Plusieurs classes possibles
  dateRemise: string;
  grille: string;
  intitule: string;
  consignes: string;
  ressources: DevoirRessource | null;
  accesIA: boolean;
  disponible: boolean;
  typeTravail: TypeTravail;
  // NavigKid (type rechercher uniquement)
  questionnaire?: {
    themes: string;
    questions: import('./navigkid').NavigKidQuestion[];
  };
  // Vocabulaire (type vocabulaire uniquement)
  vocabulaireConfig?: {
    themes: string[];
    diagnostic?: boolean;
  };
  // Inversion recto/verso (type ecrire uniquement)
  flipInverted?: boolean;
}
