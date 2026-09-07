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

/** Délai entre l'ordre du prof et le départ réel de la question. */
export const DELAI_DEPART_MS = 2000;

/** Chrono initial d'une question, en secondes (réglable question par question). */
export const CHRONO_DEFAUT_SEC = 60;

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
  | 'terminer'; // arrête la partie — la sonnerie n'attend pas

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
  /** Prof : où en est la classe */
  compteur?: { repondu: number; attendus: number };
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
