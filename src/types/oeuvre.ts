// Lecture d'une œuvre — une œuvre est une RESSOURCE RÉUTILISABLE, pas le
// contenu d'une activité. On l'encode une fois (Molière : 5 classes de 4ᵉ
// depuis 5 ans), on la donne à autant de classes qu'on veut, et un autre prof
// peut la dupliquer pour la remanier — même modèle de partage que les grilles
// (profId / profName / shared, cf. src/app/api/grilles/route.ts).
//
//   Œuvre > Chapitres > Sections
//   Le Tartuffe (chapitre) > Acte I, scène 4 (section)
//
// L'ACTE n'est PAS un niveau d'imbrication : c'est une étiquette portée par la
// section (`groupe`), dont le sommaire se sert pour regrouper. Décision de JP
// du 2026-08-15 : « chapitre = 1 pièce et section = une scène (conserver les
// actes à titre informatif) ».
//
// ─── Pourquoi deux documents Firestore et pas un ───
// Le sommaire vit dans `oeuvres/{id}` (léger : des titres et un ordre), le
// contenu dans la sous-collection `oeuvres/{id}/sections/{sectionId}`, chargée
// À LA DEMANDE. Tout mettre dans un seul document ferait retélécharger 150 à
// 300 Ko à chaque élève à chaque ouverture, et une sauvegarde du prof
// réécrirait l'ensemble — ce qui a déjà coûté une perte de données sur la
// scénarisation.
//
// ─── Le dispositif reste `lire` ───
// Une œuvre n'ouvre pas une sixième machinerie : les vérifications de lecture
// sont des LectureQuestion, exactement celles du questionnaire de lecture
// (src/types/lecture.ts). Ce qui change, c'est l'enveloppe : un parcours
// paginé au lieu d'une page unique.

import type { LectureQuestion } from './lecture';

// ─── Les blocs qui composent une section ───
//
// Une section n'est pas un bloc de texte unique : le prof intercale une image
// ou une vidéo OÙ IL VEUT dans la scène. D'où une liste ordonnée de blocs
// plutôt qu'un champ `contenu` + des médias en annexe.

export type OeuvreBlocType = 'texte' | 'vers' | 'video' | 'image' | 'audio' | 'integration';

// ─── Recto / verso ───
//
// La liseuse a deux faces, comme l'espace de rédaction (FlipEditor) :
//
//   recto — « Espace textuel »    : le texte, ce qu'on lit
//   verso — « Espace multimédia » : ce qu'on regarde et ce qu'on écoute
//
// L'ABSENCE de `face` vaut RECTO. C'est ce qui permet aux 1363 blocs de
// l'anthologie Molière de rester exactement où ils sont — vidéos comprises,
// intercalées dans la scène à l'endroit voulu. Le verso ne remplace pas cette
// possibilité : il l'ajoute, pour les compléments qui n'ont pas de place
// précise dans le texte.
export type OeuvreFace = 'recto' | 'verso';

export interface OeuvreBloc {
  id: string;
  type: OeuvreBlocType;
  // Absent = recto (voir ci-dessus) — ne jamais l'écrire par défaut, sans quoi
  // toute œuvre existante devrait être migrée pour rien.
  face?: OeuvreFace;
  // texte : HTML (Tiptap) — chapeau, analyse, prose
  // vers  : texte brut, une ligne = un vers (jamais justifié, jamais coupé)
  contenu?: string;
  // Nom du personnage qui parle, au-dessus des vers — le théâtre en vit
  locuteur?: string;
  // video : identifiant YouTube, ou lien Drive (le site de JP mêle les deux)
  videoId?: string;
  videoUrl?: string;
  // image et audio : même stockage que les questionnaires (base64 dans
  // ressourceImages, servi par /api/ressources/image/[id]) — jamais d'URL
  // externe, jamais de Storage
  imageUrl?: string;
  imageFileId?: string;
  audioUrl?: string;
  audioFileId?: string;
  // integration : une page tierce embarquée — Genially, frise chronologique,
  // exerciseur. C'est une iframe, mais posée par le PROF sur un domaine qu'il
  // choisit : la liste blanche ci-dessous est ce qui empêche d'en faire un
  // vecteur d'injection dans une page vue par des mineurs.
  integrationUrl?: string;
  // Hauteur du cadre en pixels (une frise n'a pas la proportion d'une vidéo).
  // Ignorée tant que `integrationProportions` tient — voir ci-dessous.
  integrationHauteur?: number;
  // Largeur MAXIMALE du cadre en pixels. Absente = toute la colonne. C'est un
  // plafond, jamais une largeur imposée : sur un Chromebook, la colonne est
  // plus étroite que ça et c'est elle qui gagne.
  integrationLargeur?: number;
  // Proportions d'origine (largeur / hauteur), lues dans le code <iframe>
  // collé par le prof. Quand `integrationProportions` est vrai, la hauteur du
  // cadre en découle : le contenu se réduit alors PROPORTIONNELLEMENT sur un
  // écran étroit, au lieu d'être rogné ou cerné de bandes vides.
  integrationRatio?: number;
  integrationProportions?: boolean;
  legende?: string;
}

// Domaines autorisés dans un bloc « intégration ».
//
// Une iframe exécute du code tiers DANS la page de l'élève : sans liste
// blanche, un lien collé au hasard donnerait à n'importe quel site un pied
// dans une application qui manipule des données de mineurs. La liste s'étend à
// la demande — c'est une décision, pas un réglage.
// Les intégrations (Genially, frises, exerciseurs) ont quitté ce fichier :
// elles servent aussi aux ressources d'une activité. Réexportées ici pour que
// tout ce qui les importait depuis `types/oeuvre` continue de fonctionner.
export {
  DOMAINES_INTEGRATION,
  urlDepuisIntegration,
  proportionsDepuisIntegration,
  integrationAutorisee,
} from '@/lib/integration';

// Les blocs d'une face. `face` absente = recto : c'est la règle qui préserve
// les œuvres encodées avant l'existence du verso.
export function blocsDeFace(blocs: OeuvreBloc[], face: OeuvreFace): OeuvreBloc[] {
  return blocs.filter((b) => (b.face ?? 'recto') === face);
}

// ─── Une section = un écran de la liseuse ───

export interface OeuvreSection {
  id: string;
  chapitreId: string;
  titre: string;          // « Scène 4 — Orgon & Dorine »
  groupe?: string;        // « Acte I » — informatif, sert au regroupement
  chapeau?: string;       // présentation courte, en italique avant le texte
  // Le texte peut se lire en deux colonnes sans rien perdre (demande de JP) :
  // vrai par défaut sur les longues scènes, à la main du prof.
  colonnes?: 1 | 2;
  /**
   * QUEL ESPACE S'OUVRE EN PREMIER.
   *
   * Absent ou faux : le texte, puis le multimédia — l'ordre de toutes les
   * scènes déjà encodées. Vrai : le multimédia d'abord, pour une scène qu'on
   * aborde par un extrait filmé ou une gravure et dont le texte vient
   * ensuite. C'est un ordre d'ARRIVÉE, pas un déménagement : les blocs
   * gardent leur face, seul l'ordre des onglets et l'onglet ouvert changent.
   */
  facesInversees?: boolean;
  blocs: OeuvreBloc[];
  // Vérification de lecture — mêmes questions que le questionnaire de lecture.
  // Vide = section sans formulaire : elle se lit, elle ne se vérifie pas.
  questions: LectureQuestion[];
  // Le fluorage commenté — voir OeuvreCommentaire et src/lib/oeuvre-commentaires.ts
  commentaires?: OeuvreCommentaire[];
}

/**
 * UN COMMENTAIRE DU PROF SUR DES MOTS.
 *
 * Le prof surligne un mot ou un groupe de mots ; l'élève clique et lit. Ce
 * clic est tracé (`commentairesOuverts`) : savoir ce qu'un élève est allé
 * chercher en dit plus que de savoir qu'il a ouvert la page.
 *
 * L'ancrage est un RANG DE MOTS (`debut`/`fin`, inclus), doublé des mots
 * eux-mêmes (`mots`) qui permettent de se recaler quand le prof modifie son
 * texte. Voir `recalerCommentaires`.
 */
export interface OeuvreCommentaire {
  id: string;             // CMT-{timestamp}-{rand}
  blocId: string;
  debut: number;          // rang du premier mot couvert
  fin: number;            // rang du dernier mot couvert (inclus)
  mots: string;           // les mots exacts, séparés par une espace
  texte: string;          // ce que le prof a écrit
  // Les mots n'ont pas été retrouvés après une modification du texte : le
  // commentaire n'est plus affiché à l'élève et attend le prof.
  orphelin?: boolean;
}

// Ce que le sommaire connaît d'une section : de quoi l'afficher et y aller,
// sans charger son contenu.
export interface OeuvreSectionRef {
  id: string;
  titre: string;
  groupe?: string;
  aQuestions: boolean;
}

export interface OeuvreChapitre {
  id: string;
  titre: string;          // « Le Tartuffe »
  sousTitre?: string;     // « 1664-1669 »
  sections: OeuvreSectionRef[];
}

// ─── Deux partages qu'il ne faut jamais confondre ───
//
// 1. « Œuvres des professeurs » (existant) : tout le monde voit tout, et
//    DUPLIQUE pour modifier. Chacun repart avec sa copie ; l'original ne bouge
//    pas. C'est le modèle des grilles.
//
// 2. `partages` (ci-dessous) : je désigne UN collègue, qui accède au MÊME
//    livre — le mien. Rien n'est copié. C'est ce qu'il faut quand deux profs
//    donnent la même anthologie à leurs classes : une correction profite aux
//    deux.
//
// Le partage se fait par EMAIL et non par UID : la collection `professeurs` a
// l'email pour identifiant, et un collègue qui ne s'est jamais connecté n'a
// pas encore d'UID Firebase. On pourrait donc lui partager une œuvre qu'il
// trouvera à sa première visite.
export type OeuvrePartageMode = 'lecture' | 'edition';

export interface OeuvrePartage {
  email: string;          // = id du document `professeurs`, en minuscules
  nom?: string;           // « Prénom Nom » — évite une jointure à l'affichage
  mode: OeuvrePartageMode;
}

export interface Oeuvre {
  id: string;             // OEU-YYYYMMDD-XXXX
  titre: string;          // « Molière — Anthologie comique »
  auteur?: string;
  description?: string;
  /**
   * COUVERTURE — une image, et rien d'autre. C'est le premier élément qu'on
   * dépose en construisant un livre, avant les chapitres (demande de JP,
   * 2026-08-16), et la vignette de la carte dans la bibliothèque : douze
   * cartes « 📖 » identiques ne se distinguent qu'à la lecture du titre.
   * Même stockage que les images de questions : base64 dans `ressourceImages`,
   * servi par /api/ressources/image/[id]. Jamais d'URL externe.
   */
  couverture?: { url: string; fileId: string } | null;
  chapitres: OeuvreChapitre[];
  // ⚠️ Voir COUVERTURE_ID plus bas : côté élève, la couverture est une PAGE
  // du parcours de lecture, pas seulement une vignette.
  // Partage calqué sur les grilles : chacun voit les œuvres des autres et
  // peut les dupliquer ; seul l'admin marque une œuvre comme exemple partagé.
  profId: string;
  profName?: string;
  shared: boolean;
  // Partage nominatif — voir le commentaire ci-dessus.
  partages?: OeuvrePartage[];
  archive: boolean;
  anneeScolaire: string;
  createdAt: string;
  updatedAt: string;
}

/** Le partage dont bénéficie cet email, s'il y en a un. */
export function partageDe(oeuvre: Oeuvre, email: string | null | undefined): OeuvrePartage | null {
  if (!email) return null;
  const cible = email.toLowerCase().trim();
  return oeuvre.partages?.find((p) => p.email === cible) || null;
}

/**
 * Qui peut MODIFIER cette œuvre : son auteur, l'admin, et un collègue à qui
 * elle a été partagée **en co-édition**. Un partage en lecture donne le droit
 * de s'en servir, jamais de la remanier.
 *
 * ⚠️ À vérifier CÔTÉ SERVEUR sur toute route qui écrit — l'interface qui cache
 * un bouton n'est pas une permission.
 */
export function peutEditerOeuvre(
  oeuvre: Oeuvre,
  auth: { uid: string; email?: string | null; isAdmin?: boolean }
): boolean {
  if (oeuvre.profId === auth.uid) return true;
  if (auth.isAdmin) return true;
  return partageDe(oeuvre, auth.email)?.mode === 'edition';
}

// ─── Ce que l'élève dépose en travaillant ───
//
// Stocké en JSON dans travail.content, comme les réponses de lecture. Deux
// choses seulement, puisque rien n'est noté (décision de JP) : la FRÉQUENCE DE
// LECTURE et les VÉRIFICATIONS COMPLÉTÉES.

export interface OeuvreSectionEtat {
  // Horodatage de la première ouverture — sert au « lu »
  vueLe?: string;
  /**
   * Première MANIFESTATION D'ACTIVITÉ sur la scène — pas seulement l'avoir
   * ouverte. Ouvrir une page ne prouve rien : un élève qui fait défiler 67
   * scènes en trente secondes les aurait toutes « vues ».
   *
   * Ce qui compte comme activité (décision de JP, 2026-08-16) :
   *   · avoir consulté le VERSO (l'espace multimédia) ;
   *   · avoir cliqué un mot avec l'outil DICTIONNAIRE ;
   *   · avoir ouvert un COMMENTAIRE posé par le professeur sur un mot.
   *
   * N'entre PAS dans les compteurs de progression : seul `termineLe` compte.
   * C'est un signal de lecture, pas une note.
   */
  agiLe?: string;
  // Réponses aux questions de la section (clé = LectureQuestion.id).
  // Le type réutilise LectureAnswer : c'est le même questionnaire.
  reponses?: Record<string, unknown>;
  // Vérification considérée comme complétée — c'est ELLE qui compte dans le
  // total, pas l'ouverture de la page
  termineLe?: string;
  /**
   * Les commentaires du prof que l'élève a OUVERTS (leurs ids).
   *
   * Demande de JP (2026-08-17) : c'est ce qu'un élève est allé chercher qui
   * renseigne, bien plus que le fait qu'il ait tourné la page. Chaque id ne
   * s'écrit qu'une fois — sinon chaque clic déclencherait une sauvegarde.
   * N'entre dans AUCUN compteur de progression : rien n'est noté ici.
   */
  commentairesOuverts?: string[];
}

/**
 * L'état d'une scène tel que la pastille du sommaire le montre.
 *
 *   vide    — jamais ouverte : rien
 *   ouverte — ouverte, mais rien ne dit qu'on y a lu quoi que ce soit (gris)
 *   active  — l'élève y a fait quelque chose (orange)
 *   faite   — la vérification est remplie (vert)
 *
 * RÈGLE PARTICULIÈRE : une scène SANS vérification ne peut jamais être
 * « faite » — son orange passe donc au vert. Sans cela, les scènes sans
 * formulaire resteraient éternellement orange et le sommaire dirait à l'élève
 * qu'il lui reste du travail là où il n'y en a pas.
 */
export type EtatPastille = 'vide' | 'ouverte' | 'active' | 'faite';

export function etatPastille(
  etat: OeuvreSectionEtat | undefined,
  aVerification: boolean
): EtatPastille {
  if (etat?.termineLe) return 'faite';
  if (etat?.agiLe) return aVerification ? 'active' : 'faite';
  if (etat?.vueLe) return 'ouverte';
  return 'vide';
}

export interface OeuvreProgression {
  type: 'oeuvre';
  sections: Record<string, OeuvreSectionEtat>;
  // Jours où l'élève a ouvert l'œuvre (AAAA-MM-JJ, sans doublon) : c'est la
  // « fréquence de lecture » de l'onglet Lire. Un jour, pas un horodatage —
  // on veut savoir s'il lit régulièrement, pas à quelle heure.
  jours: string[];
}

export function parseOeuvreProgression(content: string | undefined | null): OeuvreProgression | null {
  if (!content) return null;
  try {
    const parsed = JSON.parse(content);
    if (parsed && parsed.type === 'oeuvre' && parsed.sections) {
      return { type: 'oeuvre', sections: parsed.sections, jours: parsed.jours || [] };
    }
    return null;
  } catch {
    return null;
  }
}

export function emptyProgression(): OeuvreProgression {
  return { type: 'oeuvre', sections: {}, jours: [] };
}

// Nombre de vérifications complétées — le seul compteur qui fasse foi
export function nbVerificationsFaites(p: OeuvreProgression | null): number {
  if (!p) return 0;
  return Object.values(p.sections).filter((s) => !!s.termineLe).length;
}

// ─── Le rythme de lecture ───
//
// Le prof pose une ÉCHÉANCE (pas une remise : rien ne se remet) et un nombre
// minimum de vérifications. Le rythme attendu s'en déduit — 20 formulaires
// pour dans 40 jours, c'est un tous les deux jours.
//
// Ce calcul sert à trois endroits : la notification (5ᵉ type, calculée à la
// lecture comme les quatre autres — aucune tâche planifiée sur le VPS), le
// rappel de l'onglet Général, et le suivi de classe côté prof.

export type EtatLecture = 'sansEcheance' | 'pasEntamee' | 'enRetard' | 'dansLesTemps' | 'termine';

export interface RythmeLecture {
  etat: EtatLecture;
  faites: number;
  minimum: number;
  attendu: number;        // là où l'élève devrait en être aujourd'hui
  retard: number;         // attendu - faites, jamais négatif
  joursRestants: number;
}

// Seuils — volontairement tolérants : la notification doit inviter à lire, pas
// harceler pour un jour de décalage.
const MARGE_RETARD = 2;       // vérifications sous l'attendu avant d'alerter
const DELAI_PAS_ENTAMEE = 7;  // jours sans rien faire avant « pas entamée »

export function calculerRythme(
  faites: number,
  minimum: number,
  debut: string | null | undefined,
  echeance: string | null | undefined,
  maintenant: Date = new Date()
): RythmeLecture {
  const base = { faites, minimum, attendu: 0, retard: 0, joursRestants: 0 };
  if (!minimum || !echeance) return { ...base, etat: 'sansEcheance' };
  if (faites >= minimum) return { ...base, attendu: minimum, etat: 'termine' };

  const fin = new Date(echeance);
  const depart = debut ? new Date(debut) : maintenant;
  const jour = 86_400_000;
  const total = Math.max(1, Math.round((fin.getTime() - depart.getTime()) / jour));
  const ecoules = Math.max(0, Math.round((maintenant.getTime() - depart.getTime()) / jour));
  const joursRestants = Math.max(0, Math.round((fin.getTime() - maintenant.getTime()) / jour));

  const attendu = Math.min(minimum, Math.round((minimum * ecoules) / total));
  const retard = Math.max(0, attendu - faites);

  let etat: EtatLecture = 'dansLesTemps';
  if (faites === 0 && ecoules >= DELAI_PAS_ENTAMEE) etat = 'pasEntamee';
  else if (retard >= MARGE_RETARD) etat = 'enRetard';

  return { etat, faites, minimum, attendu, retard, joursRestants };
}

// ─── Identifiants ───

function suffixe(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

function horodatage(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

export function generateOeuvreId(): string {
  return `OEU-${horodatage()}-${suffixe()}`;
}

export function generateChapitreId(): string {
  return `CH-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function generateSectionId(): string {
  return `SEC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function generateBlocId(): string {
  return `BL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function generateCommentaireId(): string {
  return `CMT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// Toutes les sections d'une œuvre, à plat et dans l'ordre du sommaire —
// la liseuse navigue linéairement (scène précédente / suivante), pas par
// chapitre.
export function sectionsAPlat(oeuvre: Oeuvre): { chapitre: OeuvreChapitre; section: OeuvreSectionRef }[] {
  const out: { chapitre: OeuvreChapitre; section: OeuvreSectionRef }[] = [];
  oeuvre.chapitres.forEach((c) => c.sections.forEach((s) => out.push({ chapitre: c, section: s })));
  return out;
}

/**
 * LA COUVERTURE EST UNE PAGE.
 *
 * Côté élève, elle ouvre le livre : c'est la première entrée du sommaire, et
 * la première page qu'on tourne. Elle emprunte donc l'identifiant d'une
 * section — le parcours de lecture, les flèches précédent/suivant et le
 * sommaire ne connaissent que des sections, et leur inventer un cas
 * particulier à chacun ferait trois façons de dire la même chose.
 *
 * Ce n'est PAS une section Firestore : rien ne se charge, rien ne s'écrit
 * dans la progression (une couverture ne se « travaille » pas), et le préfixe
 * `__` ne peut entrer en collision avec un id `SEC-…`.
 */
export const COUVERTURE_ID = '__couverture__';

export function estCouverture(sectionId: string | null | undefined): boolean {
  return sectionId === COUVERTURE_ID;
}
