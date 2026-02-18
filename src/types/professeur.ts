export interface Professeur {
  id: string;       // = email lowercase
  nom: string;
  prenom: string;
  email: string;
  createdAt: string;
}

export interface CreateProfesseurData {
  nom: string;
  prenom: string;
  email: string;
}
