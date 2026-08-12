// ─── Types NavigKid (recherche guidée web) ───

// Question créée par le prof
export interface NavigKidQuestion {
  texte: string;
  type: 'texte' | 'qcm';
  options?: string[];
  correctes?: number[];           // Indices des bonnes réponses QCM
  nbSources: number;              // Sources web requises (1-5)
  points?: number;
  reponseAttendue?: string;       // Éléments de correction (prof uniquement)
  referencesProf?: string[];      // URLs de référence (prof uniquement)
}

// Document Firestore : questionnaires/{id}
export interface NavigKidQuestionnaire {
  id: string;
  titre: string;
  theme: string;                  // Tags séparés par virgule
  consignes: string;
  questions: NavigKidQuestion[];
  codeAcces: string;              // Code 6 chars (alphabet réduit sans 0/O/1/I/L)
  profId: string;
  devoirId: string;               // Lien vers le devoir parent
  archive?: boolean;
  creeLe: string;
}

// Données de création (sans id, creeLe)
export interface CreateNavigKidQuestionnaire {
  titre: string;
  theme: string;
  consignes: string;
  questions: NavigKidQuestion[];
}

// ─── Données élève (collectées par l'extension Chrome) ───

export interface NavigKidSiteConsulte {
  url: string;
  titre: string;
  timestamp: number;
  pertinence: boolean;
  fiabilite: number;              // 0 = non évalué, 1-5
  tempsPasse: number;             // en ms
}

export interface NavigKidPassage {
  texte: string;
  couleur: string;                // ex: "#fff176" (jaune), "#a5d6a7" (vert)
  url: string;
  timestamp: number;
}

// Réponse de l'élève à une question
export interface NavigKidQuestionData {
  questionIndex: number;
  reponse: string;
  motsCles: { texte: string; timestamp: number }[];
  sitesConsultes: NavigKidSiteConsulte[];
  passages?: NavigKidPassage[];
}

// Récapitulatif calculé par le serveur (voir src/lib/navigkid-server.ts) : il évite
// d'envoyer les bonnes réponses au navigateur pour afficher un score.
export interface NavigKidResume {
  total: number;
  correctes: number;
  erreurs: number;
  aCorrigerParProf: number;
}

// Document Firestore : questionnaires/{id}/reponses/{eleveId}
export interface NavigKidReponse {
  id: string;
  eleveNom: string;
  eleveEmail?: string;
  questions?: NavigKidQuestionData[];
  soumisLe: string;
  resume?: NavigKidResume;
}

// ─── Tracking recherches ───

export interface NavigKidRechercheParQuestion {
  questionIndex: number;
  requetes: { texte: string; timestamp: number }[];
  clics: { url: string; titre: string; timestamp: number; tempsPasse?: number }[];
}

// Document Firestore : recherches/{eleveId}
export interface NavigKidRecherche {
  id: string;
  eleveNom: string;
  questionnaireId: string;
  parQuestion?: NavigKidRechercheParQuestion[];
}

// ─── Correction IA ───

export interface NavigKidCorrectionIA {
  questionIndex: number;
  sourcesEvaluation: {
    pertinence: number;           // 0-100
    commentaire: string;
  };
  reponseEvaluation: {
    pertinence: number;           // 0-100
    commentaire: string;
    coherenceExtraits: string;
  };
  noteGlobale: number;            // 0-100
  feedback: string;
}
