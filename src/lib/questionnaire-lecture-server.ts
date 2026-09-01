// Bibliothèque de questionnaires de lecture — accès serveur.
//
// Accès SERVEUR UNIQUEMENT (adminDb) : aucune règle Firestore à écrire, comme
// pour `oeuvres`, `scenarisations` et `sessions`.
//
// Le service central est `quizDuDevoir()` : il dit QUEL questionnaire une
// activité utilise, en respectant l'ordre de priorité qui rend la migration
// indolore.

import { adminDb } from '@/lib/firebase/admin';
import { lectureQuizDepuisFirestore, lectureQuizPourFirestore } from '@/lib/lecture-server';
import { resumerQuiz } from '@/types/questionnaire-lecture';
import type {
  QuestionnaireLecture,
  QuestionnaireLectureResume,
} from '@/types/questionnaire-lecture';
import type { LectureQuiz } from '@/types/lecture';

const COLLECTION = 'questionnairesLecture';

function toISO(v: unknown): string {
  if (!v) return '';
  const d = v as { toDate?: () => Date };
  if (typeof d.toDate === 'function') return d.toDate().toISOString();
  if (v instanceof Date) return v.toISOString();
  return typeof v === 'string' ? v : '';
}

function docToQuestionnaire(id: string, data: Record<string, unknown>): QuestionnaireLecture {
  return {
    id,
    nom: String(data.nom ?? ''),
    description: data.description ? String(data.description) : undefined,
    profId: String(data.profId ?? ''),
    anneeScolaire: String(data.anneeScolaire ?? ''),
    archive: data.archive === true,
    shared: data.shared === true ? true : undefined,
    quiz: lectureQuizDepuisFirestore(data.quiz) ?? { mode: 'worksheet', questions: [] },
    createdAt: toISO(data.createdAt),
    updatedAt: toISO(data.updatedAt),
  };
}

export async function lireQuestionnaire(id: string): Promise<QuestionnaireLecture | null> {
  const snap = await adminDb.collection(COLLECTION).doc(id).get();
  return snap.exists ? docToQuestionnaire(snap.id, snap.data()!) : null;
}

/** La bibliothèque d'un prof : les siens, plus les exemples partagés. */
export async function listerQuestionnaires(
  profId: string
): Promise<{ miens: QuestionnaireLectureResume[]; exemples: QuestionnaireLectureResume[] }> {
  const [aMoi, partages] = await Promise.all([
    adminDb.collection(COLLECTION).where('profId', '==', profId).get(),
    adminDb.collection(COLLECTION).where('shared', '==', true).get(),
  ]);

  const resumer = (id: string, data: Record<string, unknown>): QuestionnaireLectureResume => {
    const quiz = lectureQuizDepuisFirestore(data.quiz);
    const { nbQuestions, points } = resumerQuiz(quiz);
    return {
      id,
      nom: String(data.nom ?? ''),
      description: data.description ? String(data.description) : undefined,
      profId: String(data.profId ?? ''),
      anneeScolaire: String(data.anneeScolaire ?? ''),
      archive: data.archive === true,
      shared: data.shared === true ? true : undefined,
      nbQuestions,
      points,
      mode: quiz?.mode ?? 'worksheet',
      updatedAt: toISO(data.updatedAt),
    };
  };

  const miens = aMoi.docs.map((d) => resumer(d.id, d.data()));
  const aMoiIds = new Set(miens.map((q) => q.id));
  const exemples = partages.docs
    .filter((d) => !aMoiIds.has(d.id))
    .map((d) => resumer(d.id, d.data()));

  const parNom = (a: QuestionnaireLectureResume, b: QuestionnaireLectureResume) =>
    a.nom.localeCompare(b.nom);
  return { miens: miens.sort(parNom), exemples: exemples.sort(parNom) };
}

/** Prépare le document Firestore (la matrice multiple s'y emballe). */
export function quizPourFirestore(quiz: LectureQuiz | null) {
  return lectureQuizPourFirestore(quiz);
}

/**
 * ═══ QUEL QUESTIONNAIRE CETTE ACTIVITÉ UTILISE-T-ELLE ? ═══
 *
 * Trois sources, dans cet ordre — et l'ordre EST la règle :
 *
 *  1. la copie FIGÉE de la session, quand il y en a une : ce que les élèves de
 *     cette classe ont réellement eu sous les yeux. Rien ne doit pouvoir le
 *     changer après coup, sinon leurs réponses cesseraient d'avoir un sens ;
 *  2. le questionnaire de la BIBLIOTHÈQUE, si l'activité y renvoie : c'est le
 *     matériel vivant, celui qu'on améliore d'une année sur l'autre ;
 *  3. le questionnaire EMBARQUÉ dans l'activité : toutes celles d'avant la
 *     bibliothèque. Sans ce repli, elles deviendraient illisibles.
 *
 * (Le point 1 n'a pas encore d'écriture : le figeage se branchera ici, et rien
 * d'autre n'aura à bouger.)
 */
export async function quizDuDevoir(
  devoir: { lectureQuizId?: string | null; lectureQuiz?: unknown },
  session?: { quizFige?: unknown } | null
): Promise<LectureQuiz | null> {
  if (session?.quizFige) return lectureQuizDepuisFirestore(session.quizFige);
  if (devoir.lectureQuizId) {
    const q = await lireQuestionnaire(devoir.lectureQuizId);
    if (q) return q.quiz;
    // Référence cassée (questionnaire supprimé) : on ne rend pas une activité
    // muette pour autant, on retombe sur ce qu'elle porte encore.
  }
  return lectureQuizDepuisFirestore(devoir.lectureQuiz);
}
