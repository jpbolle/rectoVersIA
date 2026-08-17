// Page d'accueil de l'élève — ce qu'il voit en ouvrant l'application.
//
// Trois blocs qui répondent à trois questions dans cet ordre : qu'est-ce que
// j'ai laissé passer, qu'est-ce qui arrive, où j'en suis. Puis la ROUE des
// ceintures, qui n'est pas un quatrième bloc mais le fond du tableau : la
// progression de l'année, UAA par UAA.

import type { UaaCertifiee } from './profil';

export interface ActiviteAccueil {
  devoirId: string;
  intitule: string;
  atelier: string;             // id de ATELIERS — pastille
  typeTravail: string;
  dateRemise: string;          // ISO, toujours présente dans ces deux blocs
  // Retard en jours entiers. Négatif = échéance à venir.
  joursDeRetard: number;
}

export interface ResultatAccueil {
  devoirId: string;
  intitule: string;
  date: string;
  percent: number;
}

export interface Accueil {
  prenom: string;
  classes: string[];
  // Échéance dépassée, rien de remis. Une activité sans échéance n'y figure
  // jamais : elle n'a pas de retard possible.
  retards: ActiviteAccueil[];
  echeances: ActiviteAccueil[];
  resultats: ResultatAccueil[];
  // TOUTES les UAA du référentiel, toujours — la ceinture blanche étant acquise
  // dès l'entrée, aucune branche n'est jamais vide et la roue s'affiche dès le
  // premier jour. (Le bloc du PROFIL, lui, ne montre que les UAA certifiées :
  // sept lignes de tableau vides n'apprendraient rien.)
  roue: UaaCertifiee[];
}
