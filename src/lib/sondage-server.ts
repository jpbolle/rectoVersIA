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
  effectif,
  entree,
  ouvrirManche,
  reponsesA,
} from '@/lib/manche-server';
import type { Entree } from '@/lib/manche-server';
import { DELAI_DEPART_MS, phaseEffective, tempsDeReponse } from '@/types/manche';
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
} from '@/types/autoevaluation';

// ─── Le questionnaire du sondage ───
//
// Il vit sur l'activité (`devoirs.autoEvalQuiz`) — pas de bibliothèque, pas de
// copie figée : un sondage se compose pour une heure de cours. On le garde
// quelques secondes en mémoire : le relire à chaque interrogation coûterait
// une lecture par élève et par seconde.

const QUIZ_CACHE_MS = 5000;
const quizCache = new Map<string, { quiz: AutoEvalQuestionnaire | null; luA: number }>();

async function quizDuSondage(m: Manche): Promise<AutoEvalQuestionnaire | null> {
  const courant = quizCache.get(m.devoirId);
  const now = Date.now();
  if (courant && now - courant.luA < QUIZ_CACHE_MS) return courant.quiz;
  const snap = await adminDb.collection('devoirs').doc(m.devoirId).get();
  const data = snap.exists ? (snap.data() as { autoEvalQuiz?: AutoEvalQuestionnaire | null }) : null;
  const quiz = data?.autoEvalQuiz ?? null;
  quizCache.set(m.devoirId, { quiz, luA: now });
  return quiz;
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

  const quiz = await quizDuSondage(m);
  const questions = quiz?.questions ?? [];
  const brute = m.questionIndex >= 0 ? questions[m.questionIndex] ?? null : null;
  const nums = numeros(questions);

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
    if (brute && estQuestion(brute)) {
      vue.compteur = {
        repondu: reponsesSondage(e, brute.id).size,
        attendus: await effectif(e),
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
  } else if (brute) {
    vue.aRepondu = reponsesSondage(e, brute.id).has(uid);
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
export async function ouvrirSondage(sessionId: string, profId: string): Promise<Manche | null> {
  const manche = await ouvrirManche(sessionId, profId);
  if (!manche) return null;
  // `ouvrirManche` a vidé le cache : la prochaine lecture relit la base, où le
  // genre est désormais posé.
  await adminDb.collection('manches').doc(manche.id).update({ genre: 'sondage' });
  return { ...manche, genre: 'sondage' };
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
    case 'terminer':
      // Rien ne se verse nulle part : un sondage anonyme ne peut pas devenir
      // des copies nominatives. La manche est sa propre trace.
      m.phase = 'finie';
      m.clotureAt = now.toISOString();
      break;
    case 'ouvrir':
      m.phase = 'salle';
      m.questionIndex = -1;
      m.debutAt = null;
      m.clotureAt = null;
      m.posees = [];
      m.chronos = {};
      break;
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
