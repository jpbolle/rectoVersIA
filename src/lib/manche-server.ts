// Manche (mode Compétition) — pilotage, lecture d'état et enregistrement des
// réponses, côté serveur.
//
// Accès SERVEUR UNIQUEMENT (adminDb) : aucune règle Firestore à écrire, comme
// pour `sessions`, `scenarisations` et `certificationsEleves`.
//
// ⚠ Ce module est le seul du projet interrogé PLUSIEURS FOIS PAR SECONDE : une
// classe de 25 élèves qui joue, c'est 25 requêtes/s pendant vingt minutes. D'où
// le cache mémoire ci-dessous. Tout ce qu'on ajoute ici se paie 25 fois par
// seconde — y réfléchir à deux fois avant d'y mettre une lecture Firestore.

import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { quizDuDevoir } from '@/lib/questionnaire-lecture-server';
import { lectureQuizForEleve } from '@/lib/lecture-server';
import { classesDeLEleve } from '@/lib/session-server';
import { decrypt, decryptFields, encrypt, hashEmail, SENSITIVE_ELEVE_FIELDS } from '@/lib/crypto';
import { generateTravailId } from '@/lib/travail-utils';
import {
  mancheId,
  phaseEffective,
  tempsDeReponse,
  facteurVitesse,
  bonusSerie,
  CHRONO_DEFAUT_SEC,
  DELAI_DEPART_MS,
  POINTS_PAR_QUESTION,
  SERIE_SEUIL,
  tirerEquipes,
  normaliserEquipes,
} from '@/types/manche';
import { sessionId } from '@/types/session';
import { estAutoCorrigeable, partReussite } from '@/types/lecture';
import type {
  ClassementEquipeLigne,
  ClassementLigne,
  DetailQuestion,
  Equipe,
  Manche,
  MancheAction,
  ManchePhase,
  MancheRepartition,
  MancheVue,
  MonScore,
} from '@/types/manche';
import type { LectureAnswer, LectureQuestion, LectureQuiz } from '@/types/lecture';

// ─── Cache mémoire ───
//
// 500 ms : assez court pour qu'un élève ne voie jamais la question en retard
// (le départ est de toute façon programmé 2 s plus tard), assez long pour
// absorber 95 % des interrogations sans toucher Firestore.
//
// Il est volontairement LOCAL au processus. S'il disparaît — redémarrage PM2,
// rechargement à chaud en développement — on relit simplement Firestore : la
// vérité est en base, ce cache n'est qu'un raccourci. C'est aussi ce qui rend
// la partie reprenable si le prof referme son onglet (décision du 2026-09-07).

const CACHE_MS = 500;

export interface Entree {
  manche: Manche;
  /**
   * La copie de chaque élève : `uid → (questionId → réponse)`.
   *
   * Indexé par UID : une réponse par élève et par question, et la répartition
   * ne compte jamais deux fois la même personne.
   *
   * ⚠ RESYNCHRONISÉ DEPUIS LA BASE à chaque rafraîchissement (500 ms), et non
   * tenu seulement au fil des envois. Le cache est local au processus, et RIEN
   * ne garantit que la route qui enregistre et celle qui lit partagent le
   * même : en développement, chaque rechargement du code peut leur donner
   * chacune leur copie ; en production, un second processus ferait pareil.
   * Symptôme vécu le 2026-09-08 : l'élève répond, le compteur du prof reste
   * à 0. On ne relit que les copies MODIFIÉES depuis la dernière fois
   * (`updatedAt`), donc une lecture par demi-seconde en régime calme.
   */
  copies: Map<string, Record<string, LectureAnswer>>;
  /**
   * Le temps de réponse de chacun, question par question (`uid → (questionId
   * → ms)`). Même vie que `copies` : relu de la base à chaque rafraîchissement,
   * mis à jour au fil des envois. C'est la matière du score.
   */
  temps: Map<string, Record<string, number>>;
  /** Horodatage de la copie la plus récente déjà relue */
  derniereSync: string;
  /**
   * Qui est qui : `firebaseUid → « Prénom N. »`, déchiffré UNE FOIS depuis
   * `eleves`. Sert au podium projeté et au classement du prof. Les élèves de
   * la classe sans compte Google lié n'y figurent pas — ils ne peuvent pas
   * jouer de toute façon.
   */
  noms: Map<string, string> | null;
  luA: number;
}

const cache = new Map<string, Entree>();

// ─── Résumer ce que la classe a répondu ───
//
// Un type = une façon de se résumer. On PRÉSERVE LA FORME DE LA QUESTION : le
// nombre se pose en pastille dans l'encadré, sur le lien, dans la boîte
// (décision de JP, 2026-09-07). Les types qu'on ne sait pas résumer en dix
// secondes au tableau — l'image à annoter — ne montrent RIEN, ce qui vaut mieux
// qu'un dessin faux.

/**
 * Une réponse est-elle VIDE ?
 *
 * ⚠ `{}` est un objet valide, et il passait tous les contrôles : il
 * s'enregistrait, faisait monter le compteur « 12 / 24 » et n'apportait rien à
 * la répartition — le professeur voyait donc des élèves « ayant répondu » et un
 * QCM à zéro partout. Il consommait en plus l'unique droit de réponse de
 * l'élève, qui ne pouvait plus rien envoyer. (Trouvé en base le 2026-09-08.)
 */
export function reponseVide(a: LectureAnswer): boolean {
  if (typeof a.choiceIndex === 'number') return false;
  if ((a.choiceIndexes?.length ?? 0) > 0) return false;
  if (typeof a.text === 'string' && a.text.trim() !== '') return false;
  if (Object.keys(a.paires ?? {}).length > 0) return false;
  if ((a.ordre?.length ?? 0) > 0) return false;
  if (Object.keys(a.annotations ?? {}).length > 0) return false;
  if (Object.keys(a.ensembles ?? {}).length > 0) return false;
  if (Object.keys(a.matrice ?? {}).length > 0) return false;
  if ((a.fluoWords?.length ?? 0) > 0) return false;
  if (Object.keys(a.fluoParCategorie ?? {}).length > 0) return false;
  if ((a.shapes?.length ?? 0) > 0) return false;
  // Les deux champs propres aux réponses d'AUTO-ÉVALUATION (`echelon`,
  // `likert`) : le cache ci-dessous est partagé avec le SONDAGE en direct
  // (`sondage-server.ts`), dont les copies passent par la même relecture. Sans
  // ces deux lignes, un emoji choisi ou un cran d'échelle étaient jetés comme
  // « vides ». Une réponse de lecture ne porte jamais ces champs : rien ne
  // change pour la compétition.
  const ae = a as { echelon?: string | null; likert?: number | null };
  if (typeof ae.echelon === 'string' && ae.echelon) return false;
  if (typeof ae.likert === 'number' && ae.likert > 0) return false;
  return true;
}

/** La forme sur laquelle deux réponses courtes se regroupent. */
function motNormalise(texte: string): string {
  // Mêmes tolérances que la réponse courte auto-corrigée : casse, espaces,
  // accents. Rien d'autre.
  return texte
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/** Le plus fréquent d'une liste, avec son compte. */
function majoritaire(valeurs: string[]): { valeur: string | null; n: number } {
  const compte = new Map<string, number>();
  valeurs.forEach((v) => compte.set(v, (compte.get(v) ?? 0) + 1));
  let valeur: string | null = null;
  let n = 0;
  compte.forEach((v, k) => {
    if (v > n) {
      n = v;
      valeur = k;
    }
  });
  return { valeur, n };
}

// ─── Lecture / écriture ───

function docToManche(id: string, d: Record<string, unknown>): Manche {
  return {
    id,
    sessionId: String(d.sessionId ?? ''),
    devoirId: String(d.devoirId ?? ''),
    classeId: String(d.classeId ?? ''),
    profId: String(d.profId ?? ''),
    phase: (d.phase as Manche['phase']) ?? 'salle',
    questionIndex: typeof d.questionIndex === 'number' ? d.questionIndex : -1,
    debutAt: typeof d.debutAt === 'string' ? d.debutAt : null,
    chronoSec: typeof d.chronoSec === 'number' ? d.chronoSec : CHRONO_DEFAUT_SEC,
    clotureAt: typeof d.clotureAt === 'string' ? d.clotureAt : null,
    posees: Array.isArray(d.posees) ? (d.posees as number[]) : [],
    chronos:
      d.chronos && typeof d.chronos === 'object' ? (d.chronos as Record<string, number>) : {},
    versement:
      d.versement && typeof d.versement === 'object'
        ? (d.versement as { at: string; copies: number })
        : null,
    equipes: normaliserEquipes(d.equipes),
    createdAt: String(d.createdAt ?? ''),
    updatedAt: String(d.updatedAt ?? ''),
  };
}

/** L'entrée de cache d'une manche, rechargée si elle a plus de 500 ms. */
export async function entree(id: string): Promise<Entree | null> {
  const now = Date.now();
  const courante = cache.get(id);
  if (courante && now - courante.luA < CACHE_MS) return courante;

  const snap = await adminDb.collection('manches').doc(id).get();
  if (!snap.exists) {
    cache.delete(id);
    return null;
  }
  const manche = docToManche(snap.id, snap.data() as Record<string, unknown>);

  // Le cache était froid (premier appel, redémarrage) : on reconstitue qui a
  // répondu à quoi. Une vingtaine de documents, une seule fois.
  // Les copies modifiées depuis la dernière relecture. À froid (`derniereSync`
  // vide), c'est toute la sous-collection — une vingtaine de documents, une
  // fois. Ensuite, seules celles qui ont bougé : `>=` plutôt que `>` pour ne
  // pas rater une écriture faite dans la même milliseconde, au prix d'une
  // relecture de la dernière copie vue, idempotente puisque indexée par UID.
  const copies = courante?.copies ?? new Map<string, Record<string, LectureAnswer>>();
  const temps = courante?.temps ?? new Map<string, Record<string, number>>();
  let derniereSync = courante?.derniereSync ?? '';
  const col = adminDb.collection('manches').doc(id).collection('reponses');
  const rep = derniereSync
    ? await col.where('updatedAt', '>=', derniereSync).get()
    : await col.get();
  rep.docs.forEach((d) => {
    const data = d.data();
    const answers = (data.answers ?? {}) as Record<string, LectureAnswer>;
    // La copie entière REMPLACE ce qu'on en savait : c'est ce qui fait
    // disparaître une réponse effacée (question reposée) sur tous les
    // processus, pas seulement celui qui l'a effacée.
    const propres: Record<string, LectureAnswer> = {};
    Object.entries(answers).forEach(([qid, a]) => {
      // Une réponse VIDE ne compte pas — même déjà en base. Le serveur les
      // refuse depuis le 2026-09-08 ; celles d'avant bloquaient l'élève.
      if (!reponseVide(a)) propres[qid] = a;
    });
    copies.set(d.id, propres);
    // Les temps suivent les réponses : une question effacée (reposée) n'a plus
    // ni réponse ni temps, et le score ne la compte plus.
    const tempsBruts = (data.tempsMs ?? {}) as Record<string, number>;
    const tempsPropres: Record<string, number> = {};
    Object.keys(propres).forEach((qid) => {
      if (typeof tempsBruts[qid] === 'number') tempsPropres[qid] = tempsBruts[qid];
    });
    temps.set(d.id, tempsPropres);
    const u = typeof data.updatedAt === 'string' ? data.updatedAt : '';
    if (u > derniereSync) derniereSync = u;
  });

  const e: Entree = {
    manche,
    copies,
    temps,
    derniereSync,
    noms: courante?.noms ?? null,
    luA: now,
  };
  cache.set(id, e);
  return e;
}

// ─── Qui joue ───
//
// « 12 / 18 » : le prof veut savoir combien ont répondu sur combien JOUENT,
// pas sur combien sont inscrits — l'absent ou celui qui n'a pas ouvert la
// partie ne doit pas faire croire à une classe qui décroche.
//
// Chaque tablette interroge l'état de la manche une fois par seconde : c'est
// le signe de vie. Tenu EN MÉMOIRE du processus seulement (choix de JP,
// 2026-09-19) : rien en base, rien qui sorte du serveur. Limite connue : en
// développement, un rechargement du code peut séparer la route de l'élève et
// celle du prof, et le compte tombe à ceux qui ont répondu. En production, un
// seul processus : pas concerné.

/** Sans nouvelles depuis plus longtemps, l'élève a quitté la partie. */
const PRESENCE_MS = 15_000;

/** `mancheId → (uid → dernier signe de vie en ms)` */
const presences = new Map<string, Map<string, number>>();

/** L'élève vient d'interroger la manche : il est là. */
export function signalerPresence(mancheId: string, uid: string): void {
  let vus = presences.get(mancheId);
  if (!vus) presences.set(mancheId, (vus = new Map()));
  vus.set(uid, Date.now());
}

/**
 * Combien jouent : les élèves vus récemment, PLUS ceux qui ont répondu — un
 * élève qui a répondu joue forcément, et le compteur ne doit jamais afficher
 * plus de réponses que de joueurs.
 */
export function joueurs(mancheId: string, repondants: Iterable<string> = []): number {
  const limite = Date.now() - PRESENCE_MS;
  const vus = presences.get(mancheId);
  const uids = new Set<string>(repondants);
  vus?.forEach((t, uid) => {
    if (t >= limite) uids.add(uid);
    // Ménage au passage : la carte ne grossit pas d'une partie à l'autre
    else vus.delete(uid);
  });
  return uids.size;
}

/**
 * Les noms de la classe, `firebaseUid → « Prénom N. »`.
 *
 * Une lecture de `eleves` et un déchiffrement, UNE FOIS par manche et par
 * processus. Prénom + initiale : le podium est projeté au tableau, la classe
 * le lit — c'est le but —, mais on n'y affiche pas plus que ce que la classe
 * sait déjà de ses camarades.
 */
async function nomsDeLaClasse(e: Entree): Promise<Map<string, string>> {
  if (e.noms) return e.noms;
  const snap = await adminDb
    .collection('eleves')
    .where('classeId', '==', e.manche.classeId)
    .get();
  const noms = new Map<string, string>();
  snap.docs.forEach((d) => {
    const data = decryptFields(d.data(), SENSITIVE_ELEVE_FIELDS) as Record<string, unknown>;
    const uid = typeof data.firebaseUid === 'string' ? data.firebaseUid : '';
    if (!uid) return;
    const prenom = String(data.prenom ?? '').trim();
    const nom = String(data.nom ?? '').trim();
    const initiale = nom ? ` ${nom[0].toUpperCase()}.` : '';
    noms.set(uid, `${prenom || 'Élève'}${initiale}`);
  });
  e.noms = noms;
  return noms;
}

// ─── Le score ───
//
// Rien n'est STOCKÉ : le classement se recalcule depuis les copies déjà en
// cache, à chaque vue en `revele` ou `finie`. Vingt-cinq élèves × quelques
// questions, c'est une boucle de rien — et une question reposée ou un temps
// corrigé se répercutent sans qu'on ait rien à réparer.

/** Le chrono qui a été joué pour cette question. */
function chronoJoue(m: Manche, q: LectureQuestion): number {
  const memorise = m.chronos?.[q.id];
  if (typeof memorise === 'number') return memorise;
  return q.type === 'info' ? 0 : q.chronoSec ?? CHRONO_DEFAUT_SEC;
}

/**
 * Les questions qui COMPTENT, dans l'ordre où elles ont été posées.
 *
 * La question courante n'entre au score qu'une fois RÉVÉLÉE (ou la partie
 * finie) : tant qu'elle court ou qu'on regarde la répartition, le score
 * dirait qui a raison avant que le prof ne le montre.
 */
function questionsComptees(m: Manche, questions: LectureQuestion[], phase: ManchePhase) {
  return m.posees
    .filter((i) => i !== m.questionIndex || phase === 'revele' || phase === 'finie')
    .map((i) => questions[i])
    .filter((q): q is LectureQuestion => !!q && q.type !== 'info' && estAutoCorrigeable(q));
}

interface ScoreCalcule {
  uid: string;
  total: number;
  serie: number;
  tempsTotalMs: number;
  repondues: number;
  /** Points gagnés à la question courante (si elle compte) */
  courante: number | null;
  detail: DetailQuestion[];
}

/**
 * Le score d'UN élève sur les questions comptées.
 *
 * Pour chaque question : part de réussite (barème partiel existant) × 1 000
 * × facteur de vitesse × (1 + bonus de série). Une absence de réponse vaut 0,
 * casse la série, et compte le chrono entier au temps total — celui qui n'a
 * pas répondu n'a pas été plus rapide que celui qui a répondu faux.
 */
function scoreDe(
  m: Manche,
  uid: string,
  comptees: LectureQuestion[],
  copie: Record<string, LectureAnswer>,
  temps: Record<string, number>,
  /** L'identifiant de la question courante, si elle compte déjà */
  idCourante: string | undefined,
  /** Le numéro affiché de chaque question (les blocs informatifs n'en ont pas) */
  numeros: Map<string, number>
): ScoreCalcule {
  let total = 0;
  let serie = 0;
  let tempsTotalMs = 0;
  let repondues = 0;
  let courante: number | null = null;
  const detail: DetailQuestion[] = [];

  comptees.forEach((q) => {
    const chrono = chronoJoue(m, q);
    const a = copie[q.id];
    const t = typeof temps[q.id] === 'number' ? temps[q.id] : chrono * 1000;
    tempsTotalMs += t;
    let points = 0;
    let part: number | null = null;
    if (a) {
      repondues += 1;
      part = partReussite(q, a) ?? 0;
      if (part >= SERIE_SEUIL) serie += 1;
      else serie = 0;
      points = Math.round(
        POINTS_PAR_QUESTION * part * facteurVitesse(t, chrono) * (1 + bonusSerie(serie))
      );
    } else {
      serie = 0;
    }
    total += points;
    if (q.id === idCourante) courante = points;
    detail.push({
      questionId: q.id,
      numero: numeros.get(q.id) ?? null,
      part,
      tempsMs: a ? t : null,
    });
  });

  return { uid, total, serie, tempsTotalMs, repondues, courante, detail };
}

/**
 * Le classement de la classe. Tous les élèves inscrits y figurent, même ceux
 * qui n'ont rien envoyé : pour le prof, « qui n'a rien répondu » est une
 * information. Départage des égalités : le temps cumulé, le plus rapide devant.
 */
async function classementDe(
  e: Entree,
  questions: LectureQuestion[],
  phase: ManchePhase
): Promise<{ lignes: ClassementLigne[]; parUid: Map<string, ScoreCalcule> }> {
  const m = e.manche;
  const noms = await nomsDeLaClasse(e);
  const comptees = questionsComptees(m, questions, phase);
  const qCourante = m.questionIndex >= 0 ? questions[m.questionIndex] : undefined;
  const idCourante = qCourante && comptees.includes(qCourante) ? qCourante.id : undefined;
  const numeros = numerosDesQuestions(questions);

  // Les inscrits d'abord, puis les éventuels joueurs inconnus de `eleves`
  // (un compte lié après coup) : personne ne disparaît du classement.
  const uids = new Set<string>([...noms.keys(), ...e.copies.keys()]);
  const scores = [...uids].map((uid) =>
    scoreDe(m, uid, comptees, e.copies.get(uid) ?? {}, e.temps.get(uid) ?? {}, idCourante, numeros)
  );
  scores.sort((a, b) => b.total - a.total || a.tempsTotalMs - b.tempsTotalMs);

  const parUid = new Map<string, ScoreCalcule>();
  const lignes = scores.map((sc, i) => {
    parUid.set(sc.uid, sc);
    return {
      uid: sc.uid,
      rang: i + 1,
      nom: noms.get(sc.uid) ?? 'Élève',
      total: sc.total,
      serie: sc.serie,
      tempsTotalMs: sc.tempsTotalMs,
      repondues: sc.repondues,
      detail: sc.detail,
    };
  });
  return { lignes, parUid };
}

/**
 * Le classement des ÉQUIPES : la somme des totaux de leurs membres, départagée
 * au temps cumulé. Une équipe vide figure quand même, à zéro — le prof doit la
 * voir pour la remplir.
 */
function classementEquipesDe(
  equipes: Equipe[],
  lignes: ClassementLigne[]
): ClassementEquipeLigne[] {
  const parUid = new Map(lignes.map((l) => [l.uid, l]));
  const brutes = equipes.map((eq) => {
    let total = 0;
    let tempsTotalMs = 0;
    const membres: string[] = [];
    eq.membres.forEach((uid) => {
      const l = parUid.get(uid);
      if (!l) return;
      total += l.total;
      tempsTotalMs += l.tempsTotalMs;
      membres.push(l.nom);
    });
    return { id: eq.id, nom: eq.nom, total, tempsTotalMs, membres };
  });
  brutes.sort((a, b) => b.total - a.total || a.tempsTotalMs - b.tempsTotalMs);
  return brutes.map((b, i) => ({ ...b, rang: i + 1 }));
}

/** L'équipe d'un élève, s'il en a une. */
function equipeDe(m: Manche, uid: string): Equipe | undefined {
  return (m.equipes ?? []).find((eq) => eq.membres.includes(uid));
}

/** Le numéro affiché de chaque question — les blocs informatifs n'en ont pas. */
function numerosDesQuestions(questions: LectureQuestion[]): Map<string, number> {
  const out = new Map<string, number>();
  let n = 0;
  questions.forEach((q) => {
    if (q.type === 'info') return;
    n += 1;
    out.set(q.id, n);
  });
  return out;
}

// ─── Le questionnaire de la manche ───
//
// Le même chemin que partout ailleurs : la copie figée de la session d'abord,
// la bibliothèque ensuite, le questionnaire embarqué en dernier recours
// (`quizDuDevoir`). Une manche ne se joue donc jamais sur un autre matériel
// que celui que l'élève aurait eu en travail ordinaire.

async function quizDeLaManche(m: Manche): Promise<LectureQuiz | null> {
  const [devoirSnap, sessionSnap] = await Promise.all([
    adminDb.collection('devoirs').doc(m.devoirId).get(),
    adminDb.collection('sessions').doc(m.sessionId).get(),
  ]);
  if (!devoirSnap.exists) return null;
  return quizDuDevoir(
    devoirSnap.data() as { lectureQuizId?: string | null; lectureQuiz?: unknown },
    sessionSnap.exists ? (sessionSnap.data() as { quizFige?: unknown }) : null
  );
}

/** Les réponses à UNE question : `uid → réponse`. */
export function reponsesA(e: Entree, questionId: string): Map<string, LectureAnswer> {
  const out = new Map<string, LectureAnswer>();
  e.copies.forEach((copie, uid) => {
    const a = copie[questionId];
    if (a) out.set(uid, a);
  });
  return out;
}

// ─── Qui a le droit ───

export interface AccesManche {
  manche: Manche;
  estProf: boolean;
}

/**
 * Pourquoi un écran ne montre rien.
 *
 * ⚠ Ces deux cas se ressemblent à l'écran et n'ont RIEN à voir :
 *  - `aucune` : il n'y a pas de partie ouverte sur cette session — état normal ;
 *  - `refuse` : la partie existe mais elle n'est pas pour cet utilisateur —
 *               un élève d'une autre classe, un collègue qui n'en est pas
 *               l'auteur. Le lui dire lui épargne de chercher une panne qui
 *               n'existe pas, et nous aussi.
 */
export type MotifSansManche = 'aucune' | 'refuse';

/**
 * Résout l'accès d'un utilisateur à une manche.
 *
 * Le prof doit en être le propriétaire ; l'élève doit appartenir à la classe
 * de la session. Un élève d'une AUTRE classe qui devinerait l'identifiant ne
 * doit rien voir : la manche porte les questions, corrigé retiré ou non.
 */
export async function accesManche(
  id: string,
  auth: { uid: string; email: string; role: string }
): Promise<AccesManche | MotifSansManche> {
  const e = await entree(id);
  if (!e) return 'aucune';
  if (auth.role === 'prof') {
    return e.manche.profId === auth.uid ? { manche: e.manche, estProf: true } : 'refuse';
  }
  const classes = await classesDeLEleve(auth.uid, auth.email);
  return classes.includes(e.manche.classeId) ? { manche: e.manche, estProf: false } : 'refuse';
}

/** L'accès a-t-il abouti ? (garde de type, pour ne pas répéter le test) */
export function accesAccorde(a: AccesManche | MotifSansManche): a is AccesManche {
  return typeof a !== 'string';
}

/**
 * La manche que CET élève doit rejoindre, pour une activité donnée.
 *
 * ⚠ On ne peut PAS se contenter de sa première classe : un élève peut en avoir
 * plusieurs, et une seule d'entre elles joue. Prendre la première au hasard le
 * laissait sur « En attente de ton professeur… » pendant que la partie tournait
 * dans la classe d'à côté — sans le moindre message d'erreur, puisque de son
 * point de vue il n'y avait simplement pas de partie.
 *
 * On lit donc les manches de TOUTES ses classes et on retient celle qui vit :
 * une partie en cours d'abord, une salle ouverte ensuite, une partie terminée
 * en dernier recours (il a le droit d'en voir la fin).
 */
export async function mancheDeLEleve(
  devoirId: string,
  uid: string,
  email: string
): Promise<string | null> {
  const classes = await classesDeLEleve(uid, email);
  if (classes.length === 0) return null;

  const candidates = classes.map((c) => mancheId(sessionId(devoirId, c)));
  const lues = await Promise.all(
    candidates.map((id) => adminDb.collection('manches').doc(id).get())
  );
  const vivantes = lues.filter((d) => d.exists);
  if (vivantes.length === 0) return null;

  const rang = (phase: unknown) =>
    phase === 'question' || phase === 'resultat' ? 0 : phase === 'salle' ? 1 : 2;
  vivantes.sort((a, b) => rang(a.data()!.phase) - rang(b.data()!.phase));
  return vivantes[0].id;
}

// ─── Ce qu'un navigateur reçoit ───

/**
 * La répartition affichable d'une question — ou `null` s'il n'y a rien de
 * lisible à montrer.
 */
function repartitionDe(
  q: LectureQuestion,
  reponses: LectureAnswer[]
): MancheRepartition | null {
  if (reponses.length === 0) return null;
  const total = reponses.length;

  // ── Choix multiple : une pastille par encadré ──
  if (q.type === 'qcm') {
    const choix = q.choices ?? [];
    // Une entrée par PROPOSITION, y compris celles que personne n'a prises :
    // un zéro est une information, et son absence déformerait la lecture.
    const parChoix = choix.map(() => 0);
    reponses.forEach((a) => {
      const pris = Array.isArray(a.choiceIndexes)
        ? a.choiceIndexes
        : typeof a.choiceIndex === 'number'
        ? [a.choiceIndex]
        : [];
      pris.forEach((i) => {
        if (i >= 0 && i < parChoix.length) parChoix[i] += 1;
      });
    });
    return { forme: 'choix', total, parChoix };
  }

  // ── Réponse courte : nuage de mots ──
  if (q.type === 'texte-court') {
    const compte = new Map<string, number>();
    reponses.forEach((a) => {
      if (typeof a.text !== 'string' || !a.text.trim()) return;
      const cle = motNormalise(a.text);
      if (cle) compte.set(cle, (compte.get(cle) ?? 0) + 1);
    });
    if (compte.size === 0) return null;
    return {
      forme: 'mots',
      total,
      mots: [...compte.entries()]
        .map(([mot, n]) => ({ mot, n }))
        .sort((a, b) => b.n - a.n)
        .slice(0, 40),
    };
  }

  // ── Appariement : une pastille au milieu de chaque lien tracé ──
  if (q.type === 'appariement') {
    const compte = new Map<string, number>();
    reponses.forEach((a) => {
      Object.entries(a.paires ?? {}).forEach(([g, d]) => {
        const cle = `${g}\u0000${d}`;
        compte.set(cle, (compte.get(cle) ?? 0) + 1);
      });
    });
    if (compte.size === 0) return null;
    return {
      forme: 'paires',
      total,
      paires: [...compte.entries()].map(([cle, n]) => {
        const [gauche, droite] = cle.split('\u0000');
        return { gauche, droite, n };
      }),
    };
  }

  // ── Remise en ordre : dans chaque place, l'étiquette majoritaire ──
  if (q.type === 'ordre') {
    const items = q.ordreItems ?? [];
    if (items.length === 0) return null;
    const places = items.map((_, rang) => {
      const misIci = reponses
        .map((a) => a.ordre?.[rang])
        .filter((id): id is string => typeof id === 'string');
      const { valeur, n } = majoritaire(misIci);
      return { rang, jetonId: valeur, n };
    });
    return { forme: 'ordre', total, places };
  }

  // ── Ensembles : chaque jeton dans CHAQUE boîte où on l'a mis ──
  if (q.type === 'ensembles') {
    const compte = new Map<string, number>();
    reponses.forEach((a) => {
      Object.entries(a.ensembles ?? {}).forEach(([jetonId, ensembleId]) => {
        const cle = `${ensembleId}\u0000${jetonId}`;
        compte.set(cle, (compte.get(cle) ?? 0) + 1);
      });
    });
    if (compte.size === 0) return null;
    return {
      forme: 'ensembles',
      total,
      cases: [...compte.entries()].map(([cle, n]) => {
        const [ensembleId, jetonId] = cle.split('\u0000');
        return { ensembleId, jetonId, n };
      }),
    };
  }

  // Image à annoter, bloc informatif : rien à montrer (décision de JP).
  return null;
}

/** L'énoncé réduit à un repère : le HTML retiré, coupé court. */
function apercu(html: string): string {
  const texte = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  return texte.length > 70 ? `${texte.slice(0, 70)}…` : texte;
}

export async function vueDeLaManche(
  id: string,
  uid: string,
  estProf: boolean,
  avecSommaire = false
): Promise<MancheVue | null> {
  const e = await entree(id);
  if (!e) return null;
  const m = e.manche;
  const phase = phaseEffective(m);

  const quiz = await quizDeLaManche(m);
  const questions = quiz?.questions ?? [];
  const brute = m.questionIndex >= 0 ? questions[m.questionIndex] ?? null : null;

  // La question ne part QUE lorsqu'elle est en jeu ou qu'on en regarde le
  // résultat : en salle d'attente, la servir livrerait le questionnaire entier
  // à qui ouvre l'onglet réseau.
  let question = null;
  if (brute && (phase === 'question' || phase === 'resultat' || phase === 'revele')) {
    // Le corrigé part dans DEUX cas, et seulement ceux-là :
    //  - au PROF, qui projette la question et doit voir la bonne réponse ;
    //  - à tous, une fois que le professeur a RÉVÉLÉ (`revele`).
    //
    // ⚠ Pas en `resultat` : la question est close, mais on n'y regarde encore
    // que ce que la classe a répondu. La bonne réponse arrive quand le
    // professeur le décide.
    if (estProf || phase === 'revele') {
      question = brute;
    } else {
      const filtre = lectureQuizForEleve({ mode: 'competition', questions: [brute] });
      question = filtre?.questions[0] ?? null;
    }
  }

  const vue: MancheVue = {
    phase,
    questionIndex: m.questionIndex,
    debutAt: m.debutAt,
    chronoSec: m.chronoSec,
    serverNow: new Date().toISOString(),
    numero: m.questionIndex + 1,
    total: questions.length,
    question,
  };

  // Ce que la classe a répondu — une fois la question close seulement. Pendant
  // qu'elle court, l'afficher dirait la réponse majoritaire aux retardataires.
  if (brute && (phase === 'resultat' || phase === 'revele')) {
    vue.repartition = repartitionDe(brute, [...reponsesA(e, brute.id).values()]);
  }

  // Le SCORE ne sort qu'une fois la bonne réponse montrée (ou la partie
  // finie) : avant, il dirait qui a raison. Au prof le classement entier ; à
  // l'élève le sien, et rien d'autre.
  if (phase === 'revele' || phase === 'finie') {
    const { lignes, parUid } = await classementDe(e, questions, phase);
    const equipes = m.equipes ?? null;
    const classementEquipes = equipes ? classementEquipesDe(equipes, lignes) : null;
    if (estProf) {
      vue.classement = lignes;
      vue.versement = m.versement ?? null;
      if (classementEquipes) vue.classementEquipes = classementEquipes;
    } else {
      const sc = parUid.get(uid);
      const ligne = lignes.find((l) => l.uid === uid);
      if (sc && ligne) {
        const monScore: MonScore = {
          question: sc.courante,
          total: sc.total,
          rang: ligne.rang,
          sur: lignes.length,
          serie: sc.serie,
        };
        const mienne = equipeDe(m, uid);
        const ligneEq = mienne && classementEquipes?.find((l) => l.id === mienne.id);
        if (ligneEq && classementEquipes) {
          monScore.equipe = {
            nom: ligneEq.nom,
            total: ligneEq.total,
            rang: ligneEq.rang,
            sur: classementEquipes.length,
          };
        }
        vue.monScore = monScore;
      }
    }
  }

  // ── Les équipes, à TOUTE phase ──
  // Le prof règle sa composition depuis la salle d'attente ; l'élève doit
  // savoir avec qui il joue avant la première question.
  if (m.equipes) {
    const noms = await nomsDeLaClasse(e);
    if (estProf) {
      const places = new Set<string>();
      vue.equipes = m.equipes.map((eq) => ({
        id: eq.id,
        nom: eq.nom,
        membres: eq.membres.map((u) => {
          places.add(u);
          return { uid: u, nom: noms.get(u) ?? 'Élève' };
        }),
      }));
      vue.sansEquipe = [...noms.entries()]
        .filter(([u]) => !places.has(u))
        .map(([u, nom]) => ({ uid: u, nom }));
    } else {
      const mienne = equipeDe(m, uid);
      vue.monEquipe = mienne
        ? {
            nom: mienne.nom,
            coequipiers: mienne.membres
              .filter((u) => u !== uid)
              .map((u) => noms.get(u) ?? 'Élève'),
          }
        : null;
    }
  }

  if (estProf) {
    vue.posees = m.posees;
    // Le sommaire ne part QU'À LA DEMANDE : trente-neuf énoncés à chaque
    // interrogation, ce serait payer très cher une liste qui ne bouge pas.
    if (avecSommaire) {
      let numero = 0;
      vue.sommaire = questions.map((q, index) => {
        if (q.type !== 'info') numero += 1;
        return {
          index,
          numero: q.type === 'info' ? null : numero,
          type: q.type,
          apercu: apercu(q.enonce),
          posee: m.posees.includes(index),
        };
      });
    }
    // Pas de compteur sur un bloc informatif : il n'attend aucune réponse,
    // afficher « 0 / 24 » ferait croire à une classe qui ne suit pas.
    vue.presents = joueurs(id);
    if (brute && brute.type !== 'info') {
      const repondants = reponsesA(e, brute.id);
      vue.compteur = {
        repondu: repondants.size,
        attendus: joueurs(id, repondants.keys()),
      };
    }
  } else {
    signalerPresence(id, uid);
    if (brute) vue.aRepondu = reponsesA(e, brute.id).has(uid);
  }

  return vue;
}

// ─── Pilotage (prof) ───

/**
 * Ouvre — ou rouvre — la manche d'une session, et la remet à zéro.
 *
 * L'identifiant étant déduit de la session, deux clics sur « Ouvrir » ne font
 * pas deux parties : le second écrase le premier.
 */
export async function ouvrirManche(
  sessionId: string,
  profId: string
): Promise<Manche | null> {
  const snap = await adminDb.collection('sessions').doc(sessionId).get();
  if (!snap.exists) return null;
  const s = snap.data() as {
    devoirId?: string;
    classeId?: string;
    profId?: string;
    disponible?: boolean;
  };
  if (s.profId !== profId) return null;

  const now = new Date().toISOString();
  const id = mancheId(sessionId);
  const manche: Manche = {
    id,
    sessionId,
    devoirId: String(s.devoirId ?? ''),
    classeId: String(s.classeId ?? ''),
    profId,
    phase: 'salle',
    questionIndex: -1,
    debutAt: null,
    chronoSec: CHRONO_DEFAUT_SEC,
    clotureAt: null,
    posees: [],
    chronos: {},
    versement: null,
    equipes: null,
    createdAt: now,
    updatedAt: now,
  };
  const { id: _id, ...data } = manche;
  await adminDb.collection('manches').doc(id).set(data);

  // ── Ouvrir la partie OUVRE L'ACCÈS à la classe ──
  //
  // Une session fermée ne montre pas l'activité à l'élève : il n'atteint donc
  // pas la salle d'attente, et la partie tourne dans le vide. Demander au prof
  // deux gestes pour une seule intention, c'était le piège assuré — et il se
  // serait découvert en classe, devant vingt-quatre élèves.
  // (Validé par JP le 2026-09-07 : en compétition, la bascule « Travail
  // disponible » disparaît de la carte au profit de ce geste-ci.)
  if (s.disponible !== true) {
    await adminDb
      .collection('sessions')
      .doc(sessionId)
      .update({
        disponible: true,
        disponibleAt: now,
        updatedAt: now,
      });
  }

  cache.delete(id);
  return manche;
}

/**
 * Applique une action du professeur.
 *
 * `lancer` programme le départ de la question suivante DEUX SECONDES plus
 * tard : c'est ce délai qui donne à tous les navigateurs le temps de la
 * recevoir avant qu'elle ne s'affiche, et c'est ce qui rend le chrono
 * équitable sans avoir besoin d'une ligne réseau poussée.
 */
export interface OptionsPilotage {
  chronoSec?: number;
  index?: number;
  /** `equipes` : combien d'équipes tirer au sort */
  nombre?: number;
  /** `equipes` : la composition retouchée par le prof ; `[]` = plus d'équipes */
  equipes?: unknown;
}

export async function piloterManche(
  id: string,
  action: MancheAction,
  options?: OptionsPilotage
): Promise<Manche | null> {
  const e = await entree(id);
  if (!e) return null;
  const m = { ...e.manche };
  const now = new Date();

  switch (action) {
    case 'lancer': {
      const quiz = await quizDeLaManche(m);
      const total = quiz?.questions.length ?? 0;
      // Le prof DÉSIGNE sa question, ou laisse venir la suivante. « Suivante »
      // ne veut pas dire « rang + 1 » : c'est la première qu'il n'a pas encore
      // posée, puisqu'il peut sauter (demande de JP, 2026-09-07).
      const demande = options?.index;
      const suivant =
        typeof demande === 'number' && demande >= 0 && demande < total
          ? demande
          : [...Array(total).keys()].find((i) => !m.posees.includes(i)) ?? total;
      if (suivant >= total) {
        m.phase = 'finie';
        m.clotureAt = now.toISOString();
        break;
      }
      const q = quiz!.questions[suivant];
      // ── REPOSER une question la remet à zéro ──
      // Le prof repose une question quand la classe n'a rien compris : c'est
      // un nouveau tour, pas la suite du précédent. Sans cet effacement, tout
      // le monde lisait « tu as déjà répondu » et personne ne pouvait rejouer.
      if (m.posees.includes(suivant)) {
        await effacerReponses(id, q.id);
        e.copies.forEach((copie) => {
          delete copie[q.id];
        });
        e.temps.forEach((t) => {
          delete t[q.id];
        });
      } else {
        m.posees = [...m.posees, suivant];
      }
      m.questionIndex = suivant;
      m.phase = 'question';
      m.debutAt = new Date(now.getTime() + DELAI_DEPART_MS).toISOString();
      // Un bloc informatif ne se joue pas : personne n'y répond, rien ne se
      // chronomètre. Chrono à 0 = il reste affiché jusqu'à ce que le prof
      // passe à la suite (cf. `phaseEffective`), et le bouton « question
      // suivante » ne se grise donc jamais dessus.
      m.chronoSec =
        q.type === 'info' ? 0 : options?.chronoSec ?? q.chronoSec ?? CHRONO_DEFAUT_SEC;
      // On retient le chrono JOUÉ : le score des questions passées en dépend
      // (cf. `Manche.chronos`).
      m.chronos = { ...(m.chronos ?? {}), [q.id]: m.chronoSec };
      m.clotureAt = null;
      break;
    }
    case 'reveler':
      // La bonne réponse se montre APRÈS la répartition, quand le prof l'a
      // commentée. Elle ne se montre pas tant que la question court.
      if (phaseEffective(m) === 'resultat') m.phase = 'revele';
      break;
    case 'stopper':
      // Le prof coupe avant la fin : tous les élèves ont répondu, ou la
      // question est manifestement passée. Elle ne se rouvre pas.
      if (m.phase === 'question') {
        m.phase = 'resultat';
        m.clotureAt = now.toISOString();
      }
      break;
    case 'terminer':
      m.phase = 'finie';
      m.clotureAt = now.toISOString();
      // ── La partie finie DEVIENT des copies ──
      // Chaque élève qui a répondu à au moins une question reçoit son
      // `travail` rendu, dans la forme exacte du questionnaire de lecture :
      // la correction, l'onglet Évaluation et le profil n'ont pas une ligne
      // à apprendre. Idempotent — rejouer « terminer » réécrit les mêmes copies.
      m.versement = await verserDansTravaux(e, m, now.toISOString());
      break;
    case 'equipes': {
      // Deux gestes : TIRER AU SORT (`nombre`) parmi les élèves de la classe
      // qui ont un compte, ou POSER une composition retouchée (`equipes`).
      // Possible à toute phase : le score suit les membres.
      if (typeof options?.nombre === 'number') {
        const noms = await nomsDeLaClasse(e);
        // Les joueurs déjà vus mais inconnus de `eleves` jouent aussi
        const uids = new Set<string>([...noms.keys(), ...e.copies.keys()]);
        m.equipes = tirerEquipes([...uids], options.nombre);
      } else if (options?.equipes !== undefined) {
        m.equipes = normaliserEquipes(options.equipes);
      }
      break;
    }
    case 'ouvrir':
      m.phase = 'salle';
      m.equipes = null;
      m.questionIndex = -1;
      m.debutAt = null;
      m.clotureAt = null;
      m.posees = [];
      m.chronos = {};
      m.versement = null;
      break;
  }

  m.updatedAt = now.toISOString();
  const { id: _id, ...data } = m;
  await adminDb.collection('manches').doc(id).update(data);

  // On rafraîchit le cache SUR PLACE plutôt que de l'invalider : l'action du
  // prof est suivie dans la seconde par 25 interrogations, autant qu'elles
  // trouvent déjà le bon état.
  e.manche = m;
  e.luA = Date.now();
  return m;
}

/**
 * Efface les réponses à UNE question, dans toutes les copies de la manche.
 *
 * Appelé quand le professeur repose une question : le tour précédent ne doit
 * plus ni bloquer les élèves ni peser dans la répartition du nouveau.
 * Une vingtaine d'écritures, et seulement sur un geste rare.
 */
export async function effacerReponses(mancheId: string, questionId: string): Promise<void> {
  const col = adminDb.collection('manches').doc(mancheId).collection('reponses');
  const snap = await col.get();
  if (snap.empty) return;
  const lot = adminDb.batch();
  snap.docs.forEach((d) => {
    lot.update(d.ref, {
      [`answers.${questionId}`]: FieldValue.delete(),
      [`tempsMs.${questionId}`]: FieldValue.delete(),
      // Bumper `updatedAt` : c'est ce qui fait relire la copie par les AUTRES
      // processus — sans quoi l'effacement ne serait vu que d'ici.
      updatedAt: new Date().toISOString(),
    });
  });
  await lot.commit();
}

// ─── Versement dans `travaux` (étape 5) ───
//
// La manche est un état de jeu ; la COPIE de l'élève, c'est `travaux`. Les
// réponses ont déjà la forme `LectureAnswersState` (c'est ce qu'écrit
// `LectureQuizActivity` dans `content`) : on les y pose, on marque la copie
// rendue, et tout l'aval — correction, Évaluation, profil — fonctionne comme
// pour un questionnaire ordinaire.
//
// ⚠ Le travail d'un élève peut exister sous DEUX identifiants : pré-créé par le
// prof (`TRV-{devoir}-{eleveDocId}`, repéré par l'empreinte de l'email) ou créé
// par l'élève (`TRV-{devoir}-{uid}`). Même logique de rattrapage que
// `/api/travaux/mine` : par `studentId` d'abord, par empreinte ensuite, créé
// en dernier recours.

/**
 * Verse les copies de la manche dans `travaux`. Renvoie le compte des copies
 * écrites. Un élève sans aucune réponse n'est PAS rendu : sa copie reste en
 * brouillon, et c'est au prof de la déclarer « non rendue » s'il le veut —
 * comme pour n'importe quelle activité.
 */
async function verserDansTravaux(
  e: Entree,
  m: Manche,
  now: string
): Promise<{ at: string; copies: number }> {
  // Qui a répondu à quelque chose
  const joueurs = [...e.copies.entries()].filter(([, copie]) => Object.keys(copie).length > 0);
  if (joueurs.length === 0) return { at: now, copies: 0 };

  // Les élèves de la classe : uid → identité (pour créer ou retrouver la copie)
  const elevesSnap = await adminDb
    .collection('eleves')
    .where('classeId', '==', m.classeId)
    .get();
  const parUid = new Map<
    string,
    { eleveId: string; nom: string; prenom: string; email: string }
  >();
  elevesSnap.docs.forEach((d) => {
    const data = d.data();
    const uid = typeof data.firebaseUid === 'string' ? data.firebaseUid : '';
    if (!uid) return;
    parUid.set(uid, {
      eleveId: d.id,
      nom: decrypt(data.nom) || '',
      prenom: decrypt(data.prenom) || '',
      email: (decrypt(data.email) || '').toLowerCase(),
    });
  });

  // Les travaux existants de l'activité, indexés par uid ET par empreinte
  const travauxSnap = await adminDb
    .collection('travaux')
    .where('devoirId', '==', m.devoirId)
    .get();
  const parStudentId = new Map<string, string>();
  const parHash = new Map<string, string>();
  travauxSnap.docs.forEach((d) => {
    const data = d.data();
    if (typeof data.studentId === 'string') parStudentId.set(data.studentId, d.id);
    if (typeof data.studentEmailHash === 'string') parHash.set(data.studentEmailHash, d.id);
  });

  const lot = adminDb.batch();
  let copies = 0;
  joueurs.forEach(([uid, answers]) => {
    const identite = parUid.get(uid);
    const hash = identite?.email ? hashEmail(identite.email) : null;
    const existant = parStudentId.get(uid) ?? (hash ? parHash.get(hash) : undefined);
    const content = JSON.stringify({ type: 'lecture', answers });

    if (existant) {
      lot.update(adminDb.collection('travaux').doc(existant), {
        content,
        // Le pré-créé n'a pas encore été réclamé : on le rattache à l'uid
        // pour que l'élève retrouve sa copie.
        studentId: uid,
        sessionId: m.sessionId,
        status: 'submitted',
        submittedAt: now,
        updatedAt: now,
      });
    } else {
      // Aucune copie : on la crée comme le ferait `/api/travaux/mine`.
      const email = identite?.email ?? '';
      const nomComplet = identite
        ? `${identite.prenom} ${identite.nom}`.trim()
        : 'Élève';
      lot.set(adminDb.collection('travaux').doc(generateTravailId(m.devoirId, uid)), {
        id: generateTravailId(m.devoirId, uid),
        devoirId: m.devoirId,
        sessionId: m.sessionId,
        studentId: uid,
        studentEmail: encrypt(email),
        studentEmailHash: email ? hashEmail(email) : null,
        studentName: encrypt(nomComplet),
        content,
        status: 'submitted',
        selfEvaluation: null,
        createdAt: now,
        updatedAt: now,
        submittedAt: now,
      });
    }
    copies += 1;
  });
  await lot.commit();
  return { at: now, copies };
}

// ─── Réponse d'un élève ───

export interface ResultatEnvoi {
  ok: boolean;
  /** Pourquoi c'est refusé — pour l'écran, pas pour l'élève */
  motif?: 'phase' | 'question' | 'vide' | 'deja';
  tempsMs?: number;
}

/**
 * Enregistre la réponse d'un élève à la question EN COURS.
 *
 * Le temps est mesuré par le SERVEUR (arrivée − départ programmé) : avec un
 * podium au bout, le chronomètre ne peut pas vivre dans le navigateur de celui
 * qui joue. Un élève arrivé en retard répond quand même, avec le temps déjà
 * écoulé compté contre lui (décision de JP, 2026-09-07).
 *
 * Une réponse ne se corrige pas : la première reçue est la bonne. Sans quoi il
 * suffirait d'attendre la révélation pour changer d'avis.
 */
export async function enregistrerReponse(
  id: string,
  uid: string,
  questionId: string,
  answer: LectureAnswer
): Promise<ResultatEnvoi> {
  const e = await entree(id);
  if (!e) return { ok: false, motif: 'phase' };
  const m = e.manche;
  if (phaseEffective(m) !== 'question') return { ok: false, motif: 'phase' };

  // Une réponse sans contenu n'est pas une réponse : on ne la compte pas, et
  // surtout on ne consomme pas l'unique envoi de l'élève avec.
  if (reponseVide(answer)) return { ok: false, motif: 'vide' };

  const quiz = await quizDeLaManche(m);
  const courante = quiz?.questions[m.questionIndex];
  if (!courante || courante.id !== questionId) return { ok: false, motif: 'question' };

  // ⚠ UNE SEULE réponse par élève et par question : il compose librement,
  // puis il CONFIRME par le bouton — et c'est fini (règle de JP, 2026-09-08 :
  // « c'est l'intérêt du bouton ENVOYER »). Reposer la question, elle, remet
  // tout le monde à zéro.
  if (reponsesA(e, questionId).has(uid)) return { ok: false, motif: 'deja' };

  const tempsMs = tempsDeReponse(m, Date.now());
  await adminDb
    .collection('manches')
    .doc(id)
    .collection('reponses')
    .doc(uid)
    .set(
      {
        uid,
        answers: { [questionId]: answer },
        tempsMs: { [questionId]: tempsMs },
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

  // La répartition se tient au fil de l'eau : la redessiner en relisant les
  // copies coûterait une lecture par élève, deux fois par seconde.
  // Indexée par UID : un élève qui se ravise REMPLACE sa réponse, il n'en
  // ajoute pas une seconde.
  const copie = e.copies.get(uid) ?? {};
  copie[questionId] = answer;
  e.copies.set(uid, copie);
  const t = e.temps.get(uid) ?? {};
  t[questionId] = tempsMs;
  e.temps.set(uid, t);

  return { ok: true, tempsMs };
}
