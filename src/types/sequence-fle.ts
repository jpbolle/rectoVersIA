// Séquence FLE — le CONTENU d'une activité de type « sequence ».
//
// Une séquence est une ACTIVITÉ de Mes Activités (décision JP, 2026-09-14 :
// « une activité constructible »), pas une ressource à part. Elle hérite donc
// de tout ce qu'une activité sait faire : classes, sessions par classe,
// échéance, ouverture, ressources du verso. Ce fichier ne décrit que ce
// qu'elle porte EN PLUS : les modules du parcours, et la différenciation.
//
// Différenciation à deux étages :
//  - `Devoir.eleves` (sur l'ACTIVITÉ, comme pour toute activité depuis le
//    2026-09-14) : null = tous les élèves des classes, liste d'ids de fiches
//    `eleves` = seulement ceux-là ;
//  - `eleves` sur chaque module : null = tous les élèves de la séquence,
//    liste = seulement ceux-là.
//
// C'est aussi ce qui AUTORISE un élève à ouvrir une activité sans classe ni
// session : « elle est dans un module d'une séquence qui m'est ouverte »
// (`ouvertParSequence`, src/lib/sequence-server.ts).

// Une ÉTAPE de la ligne du temps : SOIT une théorie (un module de la
// bibliothèque), SOIT une activité de Mes Activités (décision JP, 2026-09-14).
export type NatureEtape = 'theorie' | 'activite';

export interface SequenceFleEtape {
  id: string; // ETP-… — la clé de l'encadré (une même activité peut revenir)
  nature: NatureEtape;
  moduleId?: string; // théorie
  devoirId?: string; // activité
  // Recopiés à l'ajout pour l'affichage sans jointure (la source reste le module / le devoir)
  titre: string;
  type?: string; // théorie : id de `typesModule` — l'icône de l'encadré
  atelier?: string; // activité : id d'ATELIERS
  typeTravail?: string;
  // null = tous les élèves de la séquence ; liste d'ids `eleves` sinon
  eleves: string[] | null;
}

export interface SequenceFleContenu {
  etapes: SequenceFleEtape[]; // dans l'ordre du parcours
}

export const SEQUENCE_FLE_VIDE: SequenceFleContenu = { etapes: [] };

export function generateEtapeId(): string {
  return `ETP-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Un élève (par ses ids de fiche) est-il concerné par une restriction ? null = oui, toujours. */
export function concerne(restriction: string[] | null | undefined, eleveIds: string[]): boolean {
  if (!restriction) return true;
  return restriction.some((id) => eleveIds.includes(id));
}

// ─── Ce que l'élève reçoit pour parcourir sa séquence ───

export type EtatActiviteParcours = 'a-faire' | 'en-cours' | 'fait';

export interface EtapeParcoursTheorie {
  id: string;
  nature: 'theorie';
  moduleId: string;
  titre: string;
  type: string;
  niveau: string;
  competences: string[];
  introduction: string; // HTML
  ressources: import('./devoir').DevoirRessource | null;
}

export interface EtapeParcoursActivite {
  id: string;
  nature: 'activite';
  devoirId: string;
  intitule: string;
  typeTravail?: string;
  atelier?: string;
  etat: EtatActiviteParcours;
}

export type EtapeParcours = EtapeParcoursTheorie | EtapeParcoursActivite;

export interface ParcoursFle {
  devoirId: string;
  intitule: string;
  etapes: EtapeParcours[];
}
