export interface Professeur {
  id: string;       // = email lowercase
  nom: string;
  prenom: string;
  email: string;
  createdAt: string;
  expiresAt?: string | null;  // ISO date — null = acces permanent
  // L'école du prof — demandée à la création d'un accès PERMANENT seulement
  // (2026-10-11) ; absente pour les accès d'un jour / d'une semaine
  ecole?: string;
}

export interface CreateProfesseurData {
  nom: string;
  prenom: string;
  email: string;
  expiresAt?: string | null;
  ecole?: string;
}
