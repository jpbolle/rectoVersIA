// Traces de l'extension Daspalecte (élèves DASPA) — lues par l'onglet
// Vocabulaire de la fiche élève. Les mots traduits vivent dans le vocabulaire
// personnel (`vocabulairePersonnel/{uid}`), comme ceux de NavigKid.

export interface DaspalecteMot {
  word: string;
  traduction: string;
  langue: string;
  clics: number;
  lastSeenAt: string | null;
}

export interface DaspalecteStats {
  sessions: number;
  derniereActivite: string | null;
  mots: DaspalecteMot[];
  exercices: { nombre: number; reussite: number | null };
  lectures: { nombre: number; moyenne: number | null; dernier: number | null };
}
