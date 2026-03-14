export interface Eleve {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  classeId: string;
  googleClassroomId?: string;  // Pour sync Google Classroom
  firebaseUid?: string;        // UID Firebase Auth, lié à la première connexion de l'élève
  createdAt: string;
}

export interface Classe {
  id: string;
  nom: string;           // Ex: "4A", "3B", "Terminale S1"
  description?: string;
  profId: string;
  anneeScolaire: string;
  archive: boolean;      // Nouvelle propriété pour archiver
  code?: string;         // Code de classe partageable (ex: "AB1-CD2-EF3")
  googleClassroomId?: string;  // Pour sync Google Classroom
  createdAt: string;
  updatedAt: string;
}

export interface CreateClasseData {
  nom: string;
  description?: string;
}

export interface CreateEleveData {
  nom: string;
  prenom: string;
  email: string;
  classeId: string;
}
