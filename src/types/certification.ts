// Notes de certification — collection Firestore `certificationsEleves`.
//
// Un document par (certification, élève). La certification, elle, vit dans la
// scénarisation (module de genre `certification`) : c'est là que sont déclarés
// son intitulé, les UAA qu'elle certifie, la ceinture qu'elle accorde et son
// poids. RIEN de tout cela n'est recopié ici — une pondération corrigée après
// coup se répercute partout, et il n'existe jamais deux vérités.
//
// Accès SERVEUR UNIQUEMENT (adminDb) ⇒ aucune règle Firestore, comme
// `scenarisations`, `oeuvres` et `annonces`.
//
// RGPD : `eleveId` est un identifiant de document, pas une donnée d'identité —
// rien à chiffrer ici.

export interface NoteCertification {
  id: string;              // CRT-{moduleId}-{eleveId}
  scenarisationId: string;
  chapitreId: string;
  moduleId: string;        // la certification
  eleveId: string;         // document de la collection `eleves`
  profId: string;
  anneeScolaire: string;
  // Certification NOTÉE : le pourcentage. Certification « faite » : null —
  // c'est `fait` qui porte l'information, et un « fait » n'est pas un 100 %.
  percent: number | null;
  fait: boolean;
  commentaire?: string;
  date: string;            // date de l'épreuve (ISO), saisie par le prof
  updatedAt: string;
}

// Une ligne de la popup de saisie : l'élève, sa note, et d'où elle vient.
export interface LigneNoteCertification {
  eleveId: string;
  nom: string;
  prenom: string;
  classeId: string;
  classeNom: string;
  // Note saisie à la main. null = rien de saisi.
  percent: number | null;
  // Certification non cotée : l'épreuve a-t-elle été faite ?
  fait: boolean;
  commentaire?: string;
  // Note lue dans la correction de l'activité rattachée, quand il y en a une.
  // La saisie manuelle PRIME sur elle : le prof garde le dernier mot.
  percentAuto: number | null;
}

export interface CertificationNotesPayload {
  moduleId: string;
  titre: string;
  uaa: string[];
  ceinture: string;
  ponderation: number;
  // 'fait' : l'écran affiche une case à cocher au lieu d'un champ de pourcentage
  cotation: 'note' | 'fait';
  devoirId: string | null;   // l'activité rattachée, si elle existe
  date: string;
  lignes: LigneNoteCertification[];
}

// Ce que le PUT accepte : uniquement ce que la popup peut modifier
export interface MajNoteCertification {
  eleveId: string;
  percent: number | null;    // null = effacer la note (certification notée)
  fait?: boolean;            // certification non cotée
  commentaire?: string;
}

// Une certification vue depuis une classe (bloc « Certifications » de Mes
// Classes) : sa déclaration, plus l'avancement de la saisie dans CETTE classe.
export interface CertificationDeClasse {
  moduleId: string;
  chapitreId: string;
  chapitreTitre: string;
  scenarisationId: string;
  scenarisationNom: string;
  titre: string;
  uaa: string[];
  ceinture: string;
  ponderation: number;
  cotation: 'note' | 'fait';
  periodeAnnee: string;
  devoirId: string | null;
  notees: number;   // élèves de cette classe déjà notés
  eleves: number;   // élèves de la classe
}
