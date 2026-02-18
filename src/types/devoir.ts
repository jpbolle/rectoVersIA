export type Classe = string;

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
}
