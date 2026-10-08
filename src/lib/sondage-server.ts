// SONDAGE EN DIRECT — pilotage, lecture d'état et enregistrement des réponses,
// côté serveur (plan du 2026-09-08).
//
// Le sondage est une MANCHE (cf. `src/types/manche.ts`) d'un autre genre : les
// questions sont celles de l'auto-évaluation — rien n'y est juste ou faux —,
// le tempo est celui du professeur, et tout est ANONYME. Il n'emprunte à la
// compétition (`manche-server.ts`) que la plomberie : le cache mémoire, les
// phases, le départ programmé, l'accès. Tout ce qui diverge est ici : la
// répartition par type, l'absence de score, l'absence de versement.
//
// ⚠ ANONYMAT — la règle du module. Le serveur sait qui a répondu quoi (il le
// faut pour refuser une seconde réponse), mais RIEN de nominatif ne sort de ce
// fichier : ni nom, ni uid dans une vue, ni détail par élève dans les
// statistiques. C'est le seul dispositif où le prof ne voit pas qui a dit quoi.
//
// ⚠ Comme `manche-server`, ce module est interrogé PLUSIEURS FOIS PAR SECONDE
// pendant une partie : une lecture Firestore ajoutée ici se paie vingt-cinq
// fois par seconde.

import { adminDb } from '@/lib/firebase/admin';
import {
  effacerReponses,
  entree,
  joueurs,
  ouvrirManche,
  reponsesA,
  signalerPresence,
  verserDansTravaux,
} from '@/lib/manche-server';
import type { Entree } from '@/lib/manche-server';
import { classesDeLEleve } from '@/lib/session-server';
import { sessionId as sessionIdDe } from '@/types/session';
import { reglagesSondage } from '@/types/didactique';
import { DELAI_DEPART_MS, mancheId, phaseEffective, tempsDeReponse } from '@/types/manche';
import {
  ECHELLE_COMPETENCE,
  ECHELLE_HUMEUR,
  LIKERT_NIVEAUX,
  SONDAGE_CHRONO_DEFAUT_SEC,
  estLikertMatrice,
  estQuestion,
} from '@/types/autoevaluation';
import type {
  Manche,
  MancheSommaireItem,
  SondageAction,
  SondageBilanItem,
  SondageRepartition,
  SondageVue,
} from '@/types/manche';
import type {
  AutoEvalAnswer,
  AutoEvalQuestion,
  AutoEvalQuestionnaire,
  SondageReglages,
} from '@/types/autoevaluation';

// ─── Le questionnaire du sondage, et ses réglages ───
//
// Il vit sur l'activité (`devoirs.autoEvalQuiz`) — pas de bibliothèque, pas de
// copie figée : un sondage se compose pour une heure de cours. On le garde
// quelques secondes en mémoire : le relire à chaque interrogation coûterait
// une lecture par élève et par seconde. Les RÉGLAGES (2026-10-09 : nominatif
// ou anonyme, rythme de l'élève ou du prof) se lisent au même endroit.

const QUIZ_CACHE_MS = 5000;
interface InfosDevoir {
  quiz: AutoEvalQuestionnaire | null;
  reglages: SondageReglages;
}
const infosCache = new Map<string, { infos: InfosDevoir; luA: number }>();

async function infosDuDevoir(devoirId: string): Promise<InfosDevoir> {
  const courant = infosCache.get(devoirId);
  const now = Date.now();
  if (courant && now - courant.luA < QUIZ_CACHE_MS) return courant.infos;
  const snap = await adminDb.collection('devoirs').doc(devoirId).get();
  const data = snap.exists
    ? (snap.data() as { autoEvalQuiz?: AutoEvalQuestionnaire | null; atelier?: string; sondage?: SondageReglages | null })
    : null;
  const infos: InfosDevoir = {
    quiz: data?.autoEvalQuiz ?? null,
    reglages: reglagesSondage(data),
  };
  infosCache.set(devoirId, { infos, luA: now });
  return infos;
}

async function quizDuSondage(m: Manche): Promise<AutoEvalQuestionnaire | null> {
  return (await infosDuDevoir(m.devoirId)).quiz;
}

/** Les réponses à UNE question, dans la forme de l'auto-évaluation. */
function reponsesSondage(e: Entree, questionId: string): Map<string, AutoEvalAnswer> {
  // Le cache est typé pour la lecture ; les copies d'un sondage y vivent dans
  // le même moule — même clé par question, même relecture depuis la base.
  return reponsesA(e, questionId) as unknown as Map<string, AutoEvalAnswer>;
}

/**
 * Une réponse de sondage est-elle VIDE ?
 *
 * Même garde que pour la compétition (`reponseVide`) : une réponse sans
 * contenu ne compte pas, et surtout ne consomme pas l'unique envoi de l'élève.
 */
export function reponseSondageVide(a: AutoEvalAnswer): boolean {
  if (typeof a.choiceIndex === 'number') return false;
  if ((a.choiceIndexes?.length ?? 0) > 0) return false;
  if (typeof a.text === 'string' && a.text.trim() !== '') return false;
  if (typeof a.echelon === 'string' && a.echelon) return false;
  if (typeof a.likert === 'number' && a.likert > 0) return false;
  if (Object.keys(a.matrice ?? {}).length > 0) return false;
  return true;
}

/** La forme sur laquelle deux réponses courtes se regroupent. */
function motNormalise(texte: string): string {
  return texte
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/** Mélange en place — pour que l'ordre des textes ne trahisse pas l'ordre des envois. */
function melanger<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ─── Résumer ce que la classe a répondu ───
//
// Un type = une forme. Anonyme par construction : on ne transporte que des
// comptes, des mots et des textes, jamais qui les a donnés.

export function repartitionSondage(
  q: AutoEvalQuestion,
  reponses: AutoEvalAnswer[]
): SondageRepartition | null {
  if (reponses.length === 0) return null;
  const total = reponses.length;

  // ── Choix multiple : une pastille par case, y compris celles à zéro ──
  if (q.type === 'qcm') {
    const parChoix = (q.choices ?? []).map(() => 0);
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

  // ── Réponse longue : les textes, anonymes, mélangés ──
  if (q.type === 'texte-long') {
    const textes = reponses
      .map((a) => (typeof a.text === 'string' ? a.text.trim() : ''))
      .filter(Boolean);
    if (textes.length === 0) return null;
    return { forme: 'textes', total, textes: melanger(textes) };
  }

  // ── Emojis : une pastille sous chaque échelon, dans l'ordre de l'échelle ──
  if (q.type === 'competence' || q.type === 'humeur') {
    const echelle = q.type === 'competence' ? ECHELLE_COMPETENCE : ECHELLE_HUMEUR;
    const parEchelon = echelle.map(() => 0);
    reponses.forEach((a) => {
      const i = echelle.findIndex((e) => e.id === a.echelon);
      if (i >= 0) parEchelon[i] += 1;
    });
    return { forme: 'emojis', total, parEchelon };
  }

  // ── Échelle de 1 à 5 : au curseur, ou en tableau si elle porte des items ──
  if (q.type === 'likert') {
    if (estLikertMatrice(q)) {
      return grille(q.matriceItems ?? [], LIKERT_NIVEAUX, reponses, total);
    }
    const parNiveau = Array.from({ length: LIKERT_NIVEAUX }, () => 0);
    let somme = 0;
    let n = 0;
    reponses.forEach((a) => {
      const v = a.likert;
      if (typeof v === 'number' && v >= 1 && v <= LIKERT_NIVEAUX) {
        parNiveau[v - 1] += 1;
        somme += v;
        n += 1;
      }
    });
    return {
      forme: 'echelle',
      total,
      parNiveau,
      moyenne: n > 0 ? Math.round((somme / n) * 10) / 10 : null,
    };
  }

  // ── Matrice : le tableau, chaque cellule avec son compte ──
  if (q.type === 'matrice') {
    return grille(q.matriceItems ?? [], (q.choices ?? []).length, reponses, total);
  }

  // Bloc informatif : personne n'y répond.
  return null;
}

function grille(
  items: string[],
  nbColonnes: number,
  reponses: AutoEvalAnswer[],
  total: number
): SondageRepartition {
  const lignes = items.map(() => Array.from({ length: nbColonnes }, () => 0));
  reponses.forEach((a) => {
    Object.entries(a.matrice ?? {}).forEach(([ligne, col]) => {
      const l = Number(ligne);
      if (l >= 0 && l < lignes.length && col >= 0 && col < nbColonnes) lignes[l][col] += 1;
    });
  });
  return { forme: 'grille', total, lignes };
}

/** L'énoncé réduit à un repère : coupé court. */
function apercu(texte: string): string {
  const t = texte.replace(/\s+/g, ' ').trim();
  return t.length > 70 ? `${t.slice(0, 70)}…` : t;
}

/** Le numéro affiché de chaque question — les blocs informatifs n'en ont pas. */
function numeros(questions: AutoEvalQuestion[]): (number | null)[] {
  let n = 0;
  return questions.map((q) => (estQuestion(q) ? ++n : null));
}

/** Le chrono d'une question, tel que le prof l'a fixé dans le constructeur. */
function chronoDe(q: AutoEvalQuestion): number {
  if (!estQuestion(q)) return 0;
  return typeof q.chronoSec === 'number' ? q.chronoSec : SONDAGE_CHRONO_DEFAUT_SEC;
}

// ─── Ce qu'un navigateur reçoit ───

export async function vueDuSondage(
  id: string,
  uid: string,
  estProf: boolean,
  avecSommaire = false
): Promise<SondageVue | null> {
  const e = await entree(id);
  if (!e) return null;
  const m = e.manche;
  const phase = phaseEffective(m);

  const { quiz, reglages } = await infosDuDevoir(m.devoirId);
  const questions = quiz?.questions ?? [];
  const brute = m.questionIndex >= 0 ? questions[m.questionIndex] ?? null : null;
  const nums = numeros(questions);
  const libre = phase === 'libre';

  // La question ne part QUE lorsqu'elle est en jeu ou qu'on en regarde le
  // résultat : en salle d'attente, la servir livrerait le questionnaire entier
  // à qui ouvre l'onglet réseau. Rien à filtrer dedans : un sondage n'a pas de
  // corrigé.
  const question =
    brute && (phase === 'question' || phase === 'resultat') ? brute : null;

  const vue: SondageVue = {
    phase,
    questionIndex: m.questionIndex,
    debutAt: m.debutAt,
    chronoSec: m.chronoSec,
    serverNow: new Date().toISOString(),
    numero: brute ? nums[m.questionIndex] ?? 0 : 0,
    total: questions.filter(estQuestion).length,
    question,
    libre,
    anonyme: reglages.anonyme,
  };

  // Ce que la classe a répondu — une fois la question close seulement.
  if (brute && phase === 'resultat') {
    vue.repartition = repartitionSondage(brute, [...reponsesSondage(e, brute.id).values()]);
  }

  if (estProf) {
    vue.posees = m.posees;
    if (avecSommaire) {
      vue.sommaire = questions.map(
        (q, index): MancheSommaireItem => ({
          index,
          numero: nums[index],
          type: q.type,
          apercu: apercu(q.enonce),
          posee: m.posees.includes(index),
        })
      );
    }
    vue.presents = joueurs(id);
    vue.versement = m.versement ?? null;
    // Manche libre : qui a envoyé — un compte, jamais des noms
    if (libre || phase === 'finie') {
      vue.repondus = [...e.copies.values()].filter((c) => Object.keys(c).length > 0).length;
    }
    if (brute && estQuestion(brute)) {
      const repondants = reponsesSondage(e, brute.id);
      vue.compteur = {
        repondu: repondants.size,
        attendus: joueurs(id, repondants.keys()),
      };
    }
    // Le BILAN : toutes les questions posées et leur répartition, dans l'ordre
    // où elles ont été posées. C'est l'onglet Statistiques, et c'est la trace
    // du sondage — relisible le lendemain. La question courante n'y entre
    // qu'une fois close : avant, la répartition dirait la tendance aux
    // retardataires. Anonyme, comme tout ce qui sort d'ici.
    vue.bilan = m.posees
      .filter((i) => i !== m.questionIndex || phase !== 'question')
      .map((i): SondageBilanItem | null => {
        const q = questions[i];
        if (!q || !estQuestion(q)) return null;
        const reps = [...reponsesSondage(e, q.id).values()];
        return {
          index: i,
          numero: nums[i],
          question: q,
          repartition: repartitionSondage(q, reps),
          repondu: reps.length,
        };
      })
      .filter((b): b is SondageBilanItem => b !== null);
  } else {
    // L'uid reste en mémoire du serveur, il ne sort jamais : l'anonymat tient
    signalerPresence(id, uid);
    if (brute) vue.aRepondu = reponsesSondage(e, brute.id).has(uid);
    if (libre) vue.aRepondu = Object.keys(e.copies.get(uid) ?? {}).length > 0;
  }

  return vue;
}

// ─── Pilotage (prof) ───

/**
 * Ouvre — ou rouvre — le sondage d'une session, et le remet à zéro.
 *
 * Même geste que la compétition (`ouvrirManche` : identifiant déduit de la
 * session, accès ouvert à la classe au passage), marqué de son genre.
 */
export async function ouvrirSondage(
  sessionId: string,
  auth: { uid: string; email?: string | null }
): Promise<Manche | null> {
  const manche = await ouvrirManche(sessionId, auth);
  if (!manche) return null;
  // `ouvrirManche` a vidé le cache : la prochaine lecture relit la base, où le
  // genre est désormais posé.
  const { quiz, reglages } = await infosDuDevoir(manche.devoirId);
  // AU RYTHME DE L'ÉLÈVE (anonyme) : la manche naît « libre », toutes les
  // questions ouvertes, et le prof n'a rien à piloter.
  const libre = reglages.rythme === 'participant';
  const patch: Partial<Manche> & { genre: 'sondage' } = libre
    ? { genre: 'sondage', phase: 'libre', posees: (quiz?.questions ?? []).map((_, i) => i) }
    : { genre: 'sondage' };
  await adminDb.collection('manches').doc(manche.id).update(patch);
  return { ...manche, ...patch };
}

export interface OptionsPilotageSondage {
  /** Le rang que le prof choisit de poser ; absent = la première non posée */
  index?: number;
}

/**
 * Applique une action du professeur.
 *
 * Quatre gestes : ouvrir la salle, lancer une question (avec le chrono qu'elle
 * porte), l'arrêter, arrêter le sondage. Pas de « révéler » : rien à révéler.
 * `lancer` programme le départ DEUX SECONDES plus tard, comme en compétition —
 * c'est ce qui met toute la classe au même instant.
 */
export async function piloterSondage(
  id: string,
  action: SondageAction,
  options?: OptionsPilotageSondage
): Promise<Manche | null> {
  const e = await entree(id);
  if (!e) return null;
  const m = { ...e.manche };
  const now = new Date();
  const { reglages } = await infosDuDevoir(m.devoirId);

  // Une manche LIBRE ne se pilote pas : elle se clôt, ou se rouvre à zéro.
  if (m.phase === 'libre' && action !== 'terminer' && action !== 'ouvrir') return m;

  switch (action) {
    case 'lancer': {
      const quiz = await quizDuSondage(m);
      const questions = quiz?.questions ?? [];
      const total = questions.length;
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
      const q = questions[suivant];
      // Reposer une question la remet à zéro — un nouveau tour, pas la suite
      // du précédent (même règle qu'en compétition).
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
      // Le chrono est celui que le prof a fixé sur la question (0 = elle reste
      // ouverte jusqu'à ce qu'il la ferme — c'est aussi le cas du bloc
      // informatif, qui se lit et ne se joue pas).
      m.chronoSec = chronoDe(q);
      m.chronos = { ...(m.chronos ?? {}), [q.id]: m.chronoSec };
      m.clotureAt = null;
      break;
    }
    case 'stopper':
      if (m.phase === 'question') {
        m.phase = 'resultat';
        m.clotureAt = now.toISOString();
      }
      break;
    case 'terminer': {
      const etaitLibre = m.phase === 'libre';
      m.phase = 'finie';
      m.clotureAt = now.toISOString();
      // ANONYME : rien ne se verse nulle part — un sondage anonyme ne peut pas
      // devenir des copies nominatives, la manche est sa propre trace.
      // NOMINATIF joué en direct (2026-10-09) : la partie finie DEVIENT des
      // copies, comme en compétition — l'aval (regard du prof à l'aveugle,
      // lucidité, profil) lit alors une auto-évaluation ordinaire.
      if (!reglages.anonyme && !etaitLibre) {
        m.versement = await verserDansTravaux(e, m, now.toISOString(), 'autoevaluation');
      }
      break;
    }
    case 'ouvrir': {
      const libre = reglages.rythme === 'participant';
      m.phase = libre ? 'libre' : 'salle';
      m.questionIndex = -1;
      m.debutAt = null;
      m.clotureAt = null;
      m.posees = libre ? ((await quizDuSondage(m))?.questions ?? []).map((_, i) => i) : [];
      m.chronos = {};
      break;
    }
  }

  m.updatedAt = now.toISOString();
  const { id: _id, ...data } = m;
  await adminDb.collection('manches').doc(id).update({ ...data, genre: 'sondage' });

  // Cache rafraîchi SUR PLACE : l'action du prof est suivie dans la seconde
  // par vingt-cinq interrogations.
  e.manche = m;
  e.luA = Date.now();
  return m;
}

// ─── Réponse d'un élève ───

export interface ResultatEnvoiSondage {
  ok: boolean;
  motif?: 'phase' | 'question' | 'vide' | 'deja';
}

/**
 * Enregistre la réponse d'un élève à la question EN COURS.
 *
 * Une seule réponse par élève et par question : il compose librement, puis il
 * CONFIRME par le bouton — et c'est fini (règle de JP, 2026-09-08). Le temps de
 * réponse est mesuré ici par cohérence avec le cache partagé ; le sondage n'en
 * fait rien.
 */
export async function enregistrerReponseSondage(
  id: string,
  uid: string,
  questionId: string,
  answer: AutoEvalAnswer
): Promise<ResultatEnvoiSondage> {
  const e = await entree(id);
  if (!e) return { ok: false, motif: 'phase' };
  const m = e.manche;
  if (phaseEffective(m) !== 'question') return { ok: false, motif: 'phase' };
  if (reponseSondageVide(answer)) return { ok: false, motif: 'vide' };

  const quiz = await quizDuSondage(m);
  const courante = quiz?.questions[m.questionIndex];
  if (!courante || courante.id !== questionId) return { ok: false, motif: 'question' };
  if (reponsesSondage(e, questionId).has(uid)) return { ok: false, motif: 'deja' };

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

  // Le cache suit l'envoi : la répartition se tient au fil de l'eau.
  const copie = e.copies.get(uid) ?? {};
  (copie as Record<string, unknown>)[questionId] = answer;
  e.copies.set(uid, copie);
  const t = e.temps.get(uid) ?? {};
  t[questionId] = tempsMs;
  e.temps.set(uid, t);

  return { ok: true };
}

// ─── Manche LIBRE : le sondage anonyme au rythme de l'élève (2026-10-09) ───
//
// Pas de pilotage : l'élève reçoit le questionnaire entier (il n'y a rien à
// cacher, aucune bonne réponse), répond quand il veut, et envoie EN UNE FOIS.
// La manche n'est là que pour recevoir les réponses sans les attacher à une
// copie — `travaux` ne voit rien passer, le profil non plus. Même contrat
// d'anonymat que le direct : le serveur retient qui a envoyé (pour refuser un
// second envoi), et ne le sert jamais.

/**
 * La manche libre que CET élève doit rejoindre pour une activité, créée au
 * besoin : il n'y a pas de prof pour l'ouvrir. La session de sa classe doit
 * être OUVERTE — sinon il n'aurait pas dû voir l'activité.
 */
export async function mancheLibrePourEleve(
  devoirId: string,
  uid: string,
  email: string
): Promise<{ id: string; phase: 'libre' | 'finie' } | null> {
  const classes = await classesDeLEleve(uid, email);
  for (const classeId of classes) {
    const sid = sessionIdDe(devoirId, classeId);
    const sSnap = await adminDb.collection('sessions').doc(sid).get();
    if (!sSnap.exists) continue;
    const s = sSnap.data() as { profId?: string; disponible?: boolean; archive?: boolean };
    if (s.disponible !== true || s.archive === true) continue;

    const id = mancheId(sid);
    const existante = await entree(id);
    if (existante) {
      const phase = existante.manche.phase;
      if (phase === 'finie') return { id, phase: 'finie' };
      if (phase === 'libre') return { id, phase: 'libre' };
      // Une manche pilotée existe sur cette session : ce n'est pas un sondage libre
      continue;
    }
    const { quiz } = await infosDuDevoir(devoirId);
    const now = new Date().toISOString();
    const manche: Manche = {
      id,
      sessionId: sid,
      devoirId,
      classeId,
      profId: String(s.profId ?? ''),
      phase: 'libre',
      questionIndex: -1,
      debutAt: null,
      chronoSec: 0,
      clotureAt: null,
      posees: (quiz?.questions ?? []).map((_, i) => i),
      chronos: {},
      versement: null,
      equipes: null,
      genre: 'sondage',
      createdAt: now,
      updatedAt: now,
    };
    const { id: _id, ...data } = manche;
    await adminDb.collection('manches').doc(id).set(data);
    return { id, phase: 'libre' };
  }
  return null;
}

export interface ResultatEnvoiLibre {
  ok: boolean;
  motif?: 'phase' | 'vide' | 'deja';
}

/** L'élève envoie TOUTES ses réponses d'un coup — une seule fois. */
export async function enregistrerReponsesLibres(
  id: string,
  uid: string,
  answers: Record<string, AutoEvalAnswer>
): Promise<ResultatEnvoiLibre> {
  const e = await entree(id);
  if (!e) return { ok: false, motif: 'phase' };
  if (e.manche.phase !== 'libre') return { ok: false, motif: 'phase' };
  if (Object.keys(e.copies.get(uid) ?? {}).length > 0) return { ok: false, motif: 'deja' };

  // Seules les questions du questionnaire, et seulement celles qui ont une réponse
  const quiz = await quizDuSondage(e.manche);
  const ids = new Set((quiz?.questions ?? []).map((q) => q.id));
  const propres: Record<string, AutoEvalAnswer> = {};
  Object.entries(answers ?? {}).forEach(([qid, a]) => {
    if (ids.has(qid) && a && typeof a === 'object' && !reponseSondageVide(a)) propres[qid] = a;
  });
  if (Object.keys(propres).length === 0) return { ok: false, motif: 'vide' };

  await adminDb
    .collection('manches')
    .doc(id)
    .collection('reponses')
    .doc(uid)
    .set({ uid, answers: propres, tempsMs: {}, updatedAt: new Date().toISOString() }, { merge: true });
  e.copies.set(uid, propres as unknown as Record<string, never>);
  return { ok: true };
}

/** Où en est CET élève sur un sondage libre : a-t-il envoyé, est-ce clos ? */
export async function etatLibreDeLEleve(
  devoirId: string,
  uid: string,
  email: string
): Promise<{ aRepondu: boolean; ferme: boolean }> {
  const classes = await classesDeLEleve(uid, email);
  for (const classeId of classes) {
    const e = await entree(mancheId(sessionIdDe(devoirId, classeId)));
    if (!e) continue;
    return {
      aRepondu: Object.keys(e.copies.get(uid) ?? {}).length > 0,
      ferme: e.manche.phase === 'finie',
    };
  }
  return { aRepondu: false, ferme: false };
}
