// ═══ MANCHE — une partie jouée EN DIRECT, au rythme du professeur ═══
//
// Le questionnaire de lecture connaît deux tempos, tous deux au rythme de
// l'élève : `worksheet` (tout à l'écran) et `quiz` (une question à la fois).
// Le mode `competition` en ajoute un troisième, et c'est le seul axe qui
// bouge : c'est le PROF qui décide quand la question suivante arrive, et toute
// la classe l'a sous les yeux au même instant.
//
// Une MANCHE est l'état en direct d'une SESSION (activité × classe, cf.
// `src/types/session.ts`). Elle ne peut donc pas ne pas être rattachée à une
// classe — ce qui est exactement ce qu'il faut : on ne joue pas « une
// activité », on joue avec la 4C, à 10 h 20.
//
// ⚠ Accès SERVEUR UNIQUEMENT (adminDb), comme `sessions` et `scenarisations` :
// aucune règle Firestore à écrire ni à déployer.

import type { LectureAnswer, LectureQuestion } from './lecture';
import type { AutoEvalQuestion } from './autoevaluation';

/**
 * Le GENRE d'une manche : une compétition (questionnaire de lecture, coté,
 * nominatif) ou un sondage (questionnaire d'auto-évaluation, sans bonne
 * réponse, anonyme). Absent en base = compétition — les manches écrites avant
 * le 2026-09-08 n'ont pas le champ. Le sondage a son propre moteur
 * (`src/lib/sondage-server.ts`) et ses propres routes (`/api/sondage/*`) ; il
 * n'emprunte à la compétition que la plomberie (cache, phases, transport).
 */
export type MancheGenre = 'competition' | 'sondage';

/** Délai entre l'ordre du prof et le départ réel de la question. */
export const DELAI_DEPART_MS = 2000;

/** Chrono initial d'une question, en secondes (réglable question par question). */
export const CHRONO_DEFAUT_SEC = 60;

// ─── Le score (étape 4, décidé le 2026-09-08) ───
//
// Des POINTS DE JEU, indépendants du barème du questionnaire (option A, choisie
// par JP) : 1 000 points par question, quel que soit son `points`. Le barème,
// lui, servira à l'étape 5 quand la manche sera versée dans `travaux` — les
// deux ne se mélangent pas. Avec des questions à 1 point, le podium se serait
// joué sur des décimales.

/** Ce que rapporte une question entièrement juste, répondue à l'instant 0. */
export const POINTS_PAR_QUESTION = 1000;
/**
 * VITESSE DÉGRESSIVE : une bonne réponse vaut de 100 % à 50 % de ses points
 * selon le temps mis. Jamais « le plus rapide gagne » — une bonne réponse
 * lente vaut toujours mieux qu'une mauvaise rapide (« au cours de français,
 * il faut du temps pour répondre », JP).
 */
export const VITESSE_MIN = 0.5;
/** SÉRIE : +10 % par bonne réponse consécutive à partir de la deuxième… */
export const SERIE_BONUS = 0.1;
/** …plafonné à +50 %. */
export const SERIE_MAX = 0.5;
/** Une réponse compte comme « bonne » pour la série à partir de cette part. */
export const SERIE_SEUIL = 0.5;
/** Les tailles de podium que le prof peut choisir. */
export const PODIUM_TAILLES = [1, 3, 5, 10] as const;

// ─── Les équipes (étape 6, décidé le 2026-09-08) ───
//
// Une OPTION de la manche : sans équipes, rien ne change. Avec, chaque élève
// joue exactement comme avant et le score d'une équipe est la SOMME des scores
// de ses membres — recalculée à la volée comme tout le reste. Seule la
// composition est stockée. Le prof tire au sort, puis déplace les élèves à la
// main s'il le veut ; il peut le faire à tout moment de la partie, le score
// suivant les membres.

/** Des couleurs pour noms : lisibles au projecteur. Huit équipes au plus. */
export const EQUIPE_COULEURS = [
  'Rouge',
  'Bleu',
  'Vert',
  'Jaune',
  'Violet',
  'Orange',
  'Rose',
  'Turquoise',
] as const;
export const EQUIPES_MAX = EQUIPE_COULEURS.length;

/** La teinte de chaque équipe, pour l'en-tête et le podium. */
export const EQUIPE_TEINTES: Record<string, string> = {
  Rouge: '#c0392b',
  Bleu: '#2e6da4',
  Vert: '#2d6a5a',
  Jaune: '#c9a227',
  Violet: '#6c4a9c',
  Orange: '#d4944c',
  Rose: '#c2557f',
  Turquoise: '#2a9d8f',
};

export interface Equipe {
  id: string;
  nom: string;
  /** Les Firebase UID des membres */
  membres: string[];
}

/**
 * Les quatre moments d'une partie.
 *
 * ⚠ `question` et `resultat` ne se distinguent PAS toujours par ce qui est
 * écrit en base : quand le chrono expire tout seul, personne n'est là pour
 * réécrire le document. La phase réellement en cours se DÉDUIT de l'heure —
 * voir `phaseEffective()`. Sans quoi il faudrait une tâche planifiée pour
 * clore chaque question, c'est-à-dire une pièce mobile de plus pour rien.
 */
export type ManchePhase =
  | 'salle'     // la manche est ouverte, les élèves attendent
  | 'question'  // une question court
  | 'resultat'  // la question est close : on regarde CE QUE LA CLASSE A RÉPONDU
  | 'revele'    // le professeur a montré la bonne réponse
  | 'finie';    // la partie est terminée

/**
 * ⚠ POURQUOI `resultat` ET `revele` SONT DEUX MOMENTS.
 *
 * Le chrono qui s'arrête ne dit pas la réponse : il ouvre la discussion. On
 * affiche d'abord la RÉPARTITION — combien d'élèves sur chaque proposition, un
 * nuage de mots pour une réponse courte — et le professeur commente ce qu'il
 * voit. Il révèle ensuite, quand il l'a décidé (demande de JP, 2026-09-07).
 *
 * Livrer la bonne réponse au coup de sifflet ferme la seule minute où la classe
 * se demande encore qui a raison.
 */

export interface Manche {
  /** MAN-{sessionId} — déterministe : deux clics ne font pas deux parties */
  id: string;
  sessionId: string;
  devoirId: string;
  classeId: string;
  profId: string;

  phase: ManchePhase;
  /** Index de la question courante dans le questionnaire ; -1 avant la première */
  questionIndex: number;
  /**
   * Instant de départ PROGRAMMÉ de la question courante (ISO).
   *
   * C'est la pièce maîtresse de l'équité : le serveur ne dit pas « voici la
   * question », il dit « elle démarre à telle heure », deux secondes plus
   * tard. Tous les navigateurs l'ont donc reçue d'avance et l'affichent au
   * même instant — le décalage de l'interrogation périodique devient
   * invisible, et le chrono de chacun part au même moment.
   */
  debutAt: string | null;
  /** Durée de la question courante, en secondes */
  chronoSec: number;
  /** Clôture anticipée : le prof a coupé avant la fin du chrono */
  clotureAt: string | null;
  /**
   * Les rangs déjà posés, dans l'ordre où le prof les a lancés.
   *
   * Il n'avance PAS forcément de 1 en 1 : il choisit ses questions, et celles
   * qu'il a déjà posées se barrent dans sa liste (demande de JP, 2026-09-07).
   * Sans cette trace, « la suivante » n'aurait pas de sens dès le premier saut.
   */
  posees: number[];
  /**
   * Le chrono EFFECTIVEMENT joué, question par question (`questionId → s`).
   *
   * Le score dépend du temps mis RAPPORTÉ au chrono de la question. Or
   * `chronoSec` ne porte que la question courante, et le prof peut avoir
   * ajusté celui d'une question au moment de la lancer : sans cette trace, le
   * score des questions passées se calculerait sur un chrono deviné.
   */
  chronos?: Record<string, number>;
  /**
   * Le VERSEMENT dans `travaux` (étape 5) : quand, et combien de copies.
   *
   * Fait automatiquement à « Arrêter la partie », rejouable sans doublon. À
   * partir de là, la correction, l'onglet Évaluation et le profil de l'élève
   * lisent la partie comme n'importe quel questionnaire de lecture rendu.
   */
  versement?: { at: string; copies: number } | null;
  /** Les équipes ; `null` ou absent = partie individuelle */
  equipes?: Equipe[] | null;
  /** Compétition ou sondage — voir `MancheGenre`. Absent = compétition */
  genre?: MancheGenre;

  createdAt: string;
  updatedAt: string;
}

/** Une ligne du sommaire du prof : de quoi choisir sa prochaine question. */
export interface MancheSommaireItem {
  index: number;
  /** Numéro affiché — les blocs informatifs ne comptent pas comme questions */
  numero: number | null;
  type: string;
  /** L'énoncé, débarrassé de son HTML et coupé : c'est un repère, pas un texte */
  apercu: string;
  posee: boolean;
}

/** Ce que le prof demande à faire. */
export type MancheAction =
  | 'ouvrir'    // (ré)ouvre la salle, remet la partie à zéro
  | 'lancer'    // lance la question suivante
  | 'stopper'   // clôt la question courante avant la fin du chrono
  | 'reveler'   // montre la bonne réponse, une fois la question close
  | 'terminer'  // arrête la partie — la sonnerie n'attend pas
  | 'equipes';  // forme (au hasard) ou recompose les équipes

/**
 * Ce qu'un navigateur reçoit à chaque interrogation.
 *
 * Volontairement petit : il part 25 fois par seconde pendant une partie.
 * La question n'y figure que lorsqu'elle est effectivement en jeu.
 */
export interface MancheVue {
  phase: ManchePhase;
  questionIndex: number;
  debutAt: string | null;
  chronoSec: number;
  /** Horloge du SERVEUR — le navigateur en déduit son propre décalage */
  serverNow: string;
  /** Numéro affiché (1-based) et total, pour la barre de progression */
  numero: number;
  total: number;
  /**
   * La question courante. Filtrée de son corrigé pour l'élève
   * (`lectureQuizForEleve`), complète pour le prof — c'est lui qui la projette
   * et qui doit voir la bonne réponse au moment de la révéler.
   */
  question: LectureQuestion | null;
  /** Prof : où en est la classe — `attendus` = les élèves qui JOUENT */
  compteur?: { repondu: number; attendus: number };
  /** Prof : combien d'élèves ont la partie ouverte en ce moment */
  presents?: number;
  /** Élève : a-t-il déjà répondu à cette question ? */
  aRepondu?: boolean;
  /** Prof : les rangs déjà posés — sa liste les barre */
  posees?: number[];
  /**
   * Ce que la classe a répondu, une fois la question close. Absent tant qu'elle
   * court — sinon les premiers arrivés diraient la réponse aux suivants — et
   * absent pour les types qu'on ne sait pas résumer (« quand c'est trop
   * difficile, ne rien montrer du tout », JP).
   */
  repartition?: MancheRepartition | null;
  /**
   * Prof : le sommaire complet, servi À LA DEMANDE seulement (`&sommaire=1`).
   * Il ne voyage PAS avec l'interrogation d'une fois par seconde : trente-neuf
   * énoncés vingt-cinq fois par seconde, ce serait payer très cher une liste
   * qui ne change jamais.
   */
  sommaire?: MancheSommaireItem[];
  /**
   * Prof : le CLASSEMENT COMPLET de la classe, en `revele` et `finie`
   * seulement. Le podium projeté en est la tête ; l'onglet Statistiques le
   * montre en entier — le prof voit tout, c'est son travail.
   */
  classement?: ClassementLigne[];
  /** Prof : le versement dans `travaux`, s'il a eu lieu */
  versement?: { at: string; copies: number } | null;
  /**
   * Prof : la composition des équipes, avec les noms — à toute phase, c'est
   * son panneau de réglage. Absent = partie individuelle.
   */
  equipes?: EquipeVue[];
  /** Prof : les élèves de la classe qui ne sont dans aucune équipe */
  sansEquipe?: { uid: string; nom: string }[];
  /** Prof : le classement des équipes, en `revele` et `finie` */
  classementEquipes?: ClassementEquipeLigne[];
  /** Élève : son équipe et ses coéquipiers — dès la salle d'attente */
  monEquipe?: { nom: string; coequipiers: string[] } | null;
  /**
   * Élève : SON score, et rien d'autre. Jamais le classement des autres — ce
   * sont des mineurs, en classe, devant leurs camarades (règle du plan).
   */
  monScore?: MonScore;
}

// ─── Score ───

/** Une ligne du classement — ce que le prof voit, ce que le podium projette. */
export interface ClassementLigne {
  uid: string;
  rang: number;
  /** Prénom + initiale du nom, déchiffrés côté serveur */
  nom: string;
  total: number;
  /** Bonnes réponses consécutives en cours */
  serie: number;
  /** Temps de réponse cumulé (ms) — départage les égalités */
  tempsTotalMs: number;
  /** Questions auxquelles l'élève a répondu, sur celles posées */
  repondues: number;
  /**
   * Prof seulement : question par question, ce qu'il a fait. C'est là qu'on
   * lit « répond vite et faux » — une part nulle sur un temps court.
   */
  detail?: DetailQuestion[];
}

/** Une question, vue d'un élève : juste / faux / sans réponse, et en combien de temps. */
export interface DetailQuestion {
  questionId: string;
  /** Numéro affiché (les blocs informatifs n'en ont pas) */
  numero: number | null;
  /** Part de réussite 0 → 1 ; `null` = pas répondu */
  part: number | null;
  tempsMs: number | null;
}

/** Ce que l'élève apprend de lui-même à la révélation. */
export interface MonScore {
  /** Points gagnés à la question qui vient d'être révélée ; `null` si pas concerné */
  question: number | null;
  total: number;
  rang: number;
  sur: number;
  serie: number;
  /** Son équipe, s'il en a une */
  equipe?: { nom: string; total: number; rang: number; sur: number } | null;
}

/** Une équipe telle que le prof la voit dans son panneau. */
export interface EquipeVue {
  id: string;
  nom: string;
  membres: { uid: string; nom: string }[];
}

/** Une ligne du classement des équipes. */
export interface ClassementEquipeLigne {
  id: string;
  rang: number;
  nom: string;
  total: number;
  tempsTotalMs: number;
  /** Les noms des membres, pour le podium */
  membres: string[];
}

/**
 * Tire les équipes au sort : les joueurs mélangés, distribués à tour de rôle
 * dans `nombre` équipes — les tailles ne diffèrent donc jamais de plus d'un.
 * Pure, pour être testable ; l'aléa est injectable.
 */
export function tirerEquipes(
  uids: string[],
  nombre: number,
  alea: () => number = Math.random
): Equipe[] {
  const n = Math.max(1, Math.min(EQUIPES_MAX, Math.floor(nombre), uids.length || 1));
  const melange = [...uids];
  for (let i = melange.length - 1; i > 0; i--) {
    const j = Math.floor(alea() * (i + 1));
    [melange[i], melange[j]] = [melange[j], melange[i]];
  }
  const equipes: Equipe[] = EQUIPE_COULEURS.slice(0, n).map((nom, i) => ({
    id: `EQ-${i + 1}`,
    nom,
    membres: [],
  }));
  melange.forEach((uid, i) => equipes[i % n].membres.push(uid));
  return equipes;
}

/**
 * Nettoie une composition envoyée par l'écran du prof : identifiants et noms
 * en chaînes, un élève dans UNE équipe au plus (la première qui le cite
 * gagne), huit équipes au plus. Renvoie `null` pour « plus d'équipes ».
 */
export function normaliserEquipes(brut: unknown): Equipe[] | null {
  if (!Array.isArray(brut) || brut.length === 0) return null;
  const vus = new Set<string>();
  const propres: Equipe[] = [];
  brut.slice(0, EQUIPES_MAX).forEach((e, i) => {
    if (!e || typeof e !== 'object') return;
    const o = e as Record<string, unknown>;
    // Un élève une seule fois — entre les équipes ET dans la même : on marque
    // au passage, pas après coup.
    const membres: string[] = [];
    if (Array.isArray(o.membres)) {
      (o.membres as unknown[]).forEach((u) => {
        if (typeof u !== 'string' || vus.has(u)) return;
        vus.add(u);
        membres.push(u);
      });
    }
    propres.push({
      id: typeof o.id === 'string' && o.id ? o.id : `EQ-${i + 1}`,
      nom: typeof o.nom === 'string' && o.nom ? o.nom : EQUIPE_COULEURS[i % EQUIPES_MAX],
      membres,
    });
  });
  return propres.length > 0 ? propres : null;
}

/**
 * Le facteur de vitesse : 1 à l'instant 0, `VITESSE_MIN` à la fin du chrono,
 * linéaire entre les deux. Sans chrono, pas de course : facteur 1.
 */
export function facteurVitesse(tempsMs: number, chronoSec: number): number {
  if (chronoSec <= 0) return 1;
  const part = Math.max(0, Math.min(1, tempsMs / (chronoSec * 1000)));
  return 1 - (1 - VITESSE_MIN) * part;
}

/** Le bonus de série pour la n-ième bonne réponse consécutive (n ≥ 1). */
export function bonusSerie(serie: number): number {
  return Math.min(SERIE_MAX, Math.max(0, serie - 1) * SERIE_BONUS);
}

/**
 * CE QUE LA CLASSE A RÉPONDU, sans dire qui.
 *
 * ⚠ PAS un graphique à part : la question RESTE à l'écran telle qu'elle a été
 * jouée, et une PASTILLE y porte le nombre (décision de JP, 2026-09-07). D'où
 * une forme par type, et non une liste de barres générique — la première
 * version, abandonnée, dessinait les mêmes barres pour tout le monde et faisait
 * perdre la question de vue.
 *
 * Anonyme par construction : on ne transporte que des libellés et des comptes.
 */
export type MancheRepartition =
  /** Choix multiple : une pastille à droite dans chaque encadré */
  | { forme: 'choix'; total: number; parChoix: number[] }
  /** Réponse courte : nuage de mots, la taille selon le nombre */
  | { forme: 'mots'; total: number; mots: { mot: string; n: number }[] }
  /** Appariement : les deux étiquettes reliées, pastille au milieu du lien */
  | { forme: 'paires'; total: number; paires: { gauche: string; droite: string; n: number }[] }
  /**
   * Remise en ordre : dans chaque place, l'étiquette que la classe y a le plus
   * souvent mise. Les avis minoritaires ne sont pas affichés — on lit une
   * place en une seconde, pas un tableau croisé.
   */
  | {
      forme: 'ordre';
      total: number;
      places: { rang: number; jetonId: string | null; n: number }[];
    }
  /**
   * Ensembles : un jeton apparaît dans CHAQUE boîte où des élèves l'ont mis.
   * Un jeton hésitant se voit donc dans deux boîtes à la fois — c'est
   * exactement ce qu'on veut voir.
   */
  | {
      forme: 'ensembles';
      total: number;
      cases: { ensembleId: string; jetonId: string; n: number }[];
    };

/** Une copie en cours de partie — un document par élève. */
export interface MancheReponses {
  uid: string;
  /** clé = LectureQuestion.id ; même forme que le questionnaire de lecture */
  answers: Record<string, LectureAnswer>;
  /**
   * Temps de réponse en millisecondes, question par question. Calculé par le
   * SERVEUR (heure d'arrivée − `debutAt`) : le navigateur de l'élève n'est pas
   * une source d'heure digne de confiance quand il y a un podium au bout.
   */
  tempsMs: Record<string, number>;
  updatedAt: string;
}

/** Identifiant déterministe, déduit de la session. */
export function mancheId(sessionId: string): string {
  return `MAN-${sessionId}`;
}

/**
 * La phase RÉELLE, à l'heure qu'il est.
 *
 * Le chrono expire sans que personne n'écrive en base : une question lancée
 * il y a plus de `chronoSec` secondes est close, que le document le dise ou
 * non. On le déduit ici plutôt que de faire tourner une tâche planifiée.
 */
export function phaseEffective(m: Manche, now: number = Date.now()): ManchePhase {
  // `revele` et `finie` sont des décisions du professeur : l'heure ne les
  // défait pas.
  if (m.phase !== 'question') return m.phase;
  if (m.clotureAt) return 'resultat';
  if (!m.debutAt) return 'salle';
  // Chrono nul = PAS DE CHRONO : l'élément reste à l'écran tant que le prof ne
  // passe pas à la suite. C'est le cas du bloc informatif — il n'est pas joué,
  // il est lu — et c'est aussi ce qui permettra une question sans minuteur.
  if (m.chronoSec <= 0) return 'question';
  const fin = new Date(m.debutAt).getTime() + m.chronoSec * 1000;
  return now >= fin ? 'resultat' : 'question';
}

/**
 * Le temps mis pour répondre, borné.
 *
 * Un élève arrivé après le lancement répond quand même — avec le temps déjà
 * écoulé compté contre lui (décision de JP, 2026-09-07 : « tant pis »). D'où
 * la borne haute au chrono plutôt qu'un rejet.
 */
export function tempsDeReponse(m: Manche, arriveeMs: number): number {
  if (!m.debutAt) return 0;
  const ecoule = arriveeMs - new Date(m.debutAt).getTime();
  return Math.max(0, Math.min(ecoule, m.chronoSec * 1000));
}

// ═══ SONDAGE EN DIRECT (plan du 2026-09-08) ═══
//
// Même transport, mêmes phases — moins `revele`, puisqu'il n'y a rien à
// révéler —, mais un autre questionnaire (celui de l'auto-évaluation) et
// AUCUN nom nulle part : la répartition ne transporte que des comptes et des
// textes, jamais qui a dit quoi. Le serveur le sait, pour refuser une seconde
// réponse ; il ne le sert jamais.

/**
 * Ce que la classe a répondu à une question de sondage, sans dire qui.
 *
 * Une forme par type — la question RESTE à l'écran telle qu'elle a été posée,
 * et le nombre s'y pose (règle posée pour la compétition, reconduite).
 */
export type SondageRepartition =
  /** Choix multiple : une pastille dans chaque case */
  | { forme: 'choix'; total: number; parChoix: number[] }
  /** Réponse courte : nuage de mots */
  | { forme: 'mots'; total: number; mots: { mot: string; n: number }[] }
  /** Sentiment de compétence, émotion : une pastille sous chaque emoji (ordre de l'échelle) */
  | { forme: 'emojis'; total: number; parEchelon: number[] }
  /** Échelle de 1 à 5 au curseur : une pastille par cran, et la moyenne */
  | { forme: 'echelle'; total: number; parNiveau: number[]; moyenne: number | null }
  /**
   * Matrice, ou échelle à plusieurs items : le tableau, chaque cellule portant
   * son compte (`lignes[ligne][colonne]`).
   */
  | { forme: 'grille'; total: number; lignes: number[][] }
  /** Réponse longue : les textes, ANONYMES et mélangés — projetés en cartes */
  | { forme: 'textes'; total: number; textes: string[] };

/** Une question posée, avec sa répartition — l'onglet Statistiques du prof. */
export interface SondageBilanItem {
  index: number;
  numero: number | null;
  question: AutoEvalQuestion;
  repartition: SondageRepartition | null;
  /** Combien ont répondu à cette question */
  repondu: number;
}

/**
 * Ce qu'un navigateur reçoit à chaque interrogation d'un sondage.
 *
 * Même squelette que `MancheVue` — c'est le même hook qui l'interroge — sans
 * score, sans équipe, sans classement : rien de nominatif ne sort d'ici.
 */
export interface SondageVue {
  phase: ManchePhase;
  questionIndex: number;
  debutAt: string | null;
  chronoSec: number;
  serverNow: string;
  numero: number;
  total: number;
  /** La question courante — servie en jeu et en résultat seulement */
  question: AutoEvalQuestion | null;
  /** Prof : où en est la classe — `attendus` = les élèves qui JOUENT */
  compteur?: { repondu: number; attendus: number };
  /** Prof : combien d'élèves ont la partie ouverte en ce moment */
  presents?: number;
  /** Élève : a-t-il déjà répondu ? */
  aRepondu?: boolean;
  /** Prof : les rangs déjà posés */
  posees?: number[];
  /** Ce que la classe a répondu, une fois la question close */
  repartition?: SondageRepartition | null;
  /** Prof : le sommaire, à la demande (`&sommaire=1`) */
  sommaire?: MancheSommaireItem[];
  /** Prof : toutes les questions posées et leur répartition — l'onglet Statistiques */
  bilan?: SondageBilanItem[];
}

/** Ce que le prof demande à faire sur un sondage. Pas de « révéler », rien à révéler. */
export type SondageAction = 'ouvrir' | 'lancer' | 'stopper' | 'terminer';
