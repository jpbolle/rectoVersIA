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

// ─── Coprofesseurs d'une classe (2026-10-04) ───
//
// Le titulaire partage SA classe avec un collègue désigné par email — un
// remplaçant, par exemple. Rien n'est copié : le collègue accède à la MÊME
// classe, à ses élèves et aux activités qui la visent.
//
//   • lecture  : il voit tout, ne touche à rien ;
//   • edition  : il corrige, publie les corrigés, ouvre/ferme, archive, coche
//                « non rendu », crée SES activités pour la classe et saisit les
//                notes de certification — toujours pour CETTE classe seulement.
//
// Dans aucun mode il ne modifie une activité qu'il n'a pas créée (décision de
// JP) : tout ce qu'il fait passe par la SESSION (activité × classe).
// Par email et non par UID, comme pour les œuvres : un collègue qui ne s'est
// jamais connecté n'a pas encore d'UID.
export type ClassePartageMode = 'lecture' | 'edition';

export interface ClassePartage {
  email: string;          // = id du document `professeurs`, en minuscules
  nom?: string;           // « Prénom Nom » — évite une jointure à l'affichage
  mode: ClassePartageMode;
}

/** Ce que JE peux faire de cette classe — calculé par le serveur, jamais stocké. */
export type AccesClasse = 'titulaire' | ClassePartageMode;

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
  partages?: ClassePartage[];  // Servi au TITULAIRE seulement
  titulaireNom?: string;       // Servi au COPROFESSEUR : de qui est la classe
  monAcces?: AccesClasse;      // Servi par le serveur ; absent = titulaire
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
