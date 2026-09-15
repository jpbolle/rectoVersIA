export interface Eleve {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  emailHash?: string;          // Empreinte HMAC de l'email (requêtes d'identification — RGPD)
  classeId: string;
  googleClassroomId?: string;  // Pour sync Google Classroom
  firebaseUid?: string;        // UID Firebase Auth, lié à la première connexion de l'élève
  createdAt: string;
}

// Le TYPE de cours d'une classe. C'est le seul réglage que le prof fait à la
// main : tout le reste en découle (référentiel FLE au lieu des UAA, espace
// élève /fle, séquences). Absent = « francais » — les classes créées avant
// 2026-09 n'ont pas le champ, et se comportent comme avant.
export type ClasseType = 'francais' | 'fle';

export const CLASSE_TYPES: { id: ClasseType; label: string; court: string; aide: string }[] = [
  {
    id: 'francais',
    label: 'Cours de français',
    court: 'Français',
    aide: 'UAA, habiletés, ceintures — le fonctionnement habituel.',
  },
  {
    id: 'fle',
    label: 'Français langue étrangère (FLE)',
    court: 'FLE',
    aide: 'Élèves DASPA : niveaux A1 → B2, compétences du CECR, séquences de cours.',
  },
];

export function isClasseType(value: unknown): value is ClasseType {
  return value === 'francais' || value === 'fle';
}

/** Une classe FLE — le champ absent vaut « francais ». */
export function estClasseFle(classe: { type?: ClasseType | null } | null | undefined): boolean {
  return classe?.type === 'fle';
}

export interface Classe {
  id: string;
  nom: string;           // Ex: "4A", "3B", "Terminale S1"
  description?: string;
  type?: ClasseType;     // Absent = 'francais' (cf. ClasseType)
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
  type?: ClasseType;
}

export interface CreateEleveData {
  nom: string;
  prenom: string;
  email: string;
  classeId: string;
}
