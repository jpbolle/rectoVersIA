export interface Professeur {
  id: string;       // = email lowercase
  nom: string;
  prenom: string;
  email: string;
  createdAt: string;
  expiresAt?: string | null;  // ISO date — null = acces permanent
}

export interface CreateProfesseurData {
  nom: string;
  prenom: string;
  email: string;
  expiresAt?: string | null;
}
