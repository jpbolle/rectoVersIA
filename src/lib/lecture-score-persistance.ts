/**
 * Le score d'un questionnaire de lecture, ÉCRIT sur la correction.
 *
 * ── Pourquoi écrire une valeur qui se recalcule ───────────────────────────
 * `scoreLectureQuiz` (lib/lecture-scoring.ts) recalcule tout à l'affichage, et
 * c'est la bonne façon de faire *ici* : le total reste juste si le prof
 * retouche le questionnaire. Mais ce total n'existait **nulle part en base** —
 * `corrections.score` reste à 0 pour une activité de lecture, il ne vaut que
 * pour les activités à grille.
 *
 * Conséquence, mesurée le 2026-09-21 : KitSchool, qui importe les notes d'une
 * activité pour son bulletin, lisait `score` et ramenait **0 % pour les 39
 * copies** d'un diagnostic de lecture — sans erreur, avec les élèves
 * correctement appariés et l'évaluation reconnue. Le seul écran qui aurait
 * montré la faute est celui d'un prof qui connaît ses copies.
 *
 * ⇒ On écrit le total au moment où il est établi, dans un champ **distinct**
 * de `score` (qui, lui, appartient aux grilles : les confondre ferait passer
 * un pourcentage de lecture pour un score de grille dans tous les écrans qui
 * lisent déjà `score`).
 *
 * ⚠ C'est une **trace de la note donnée**, pas une source : l'affichage
 * continue de recalculer. Si le prof retouche le corrigé d'un QCM après coup,
 * la valeur écrite vieillit — elle sera réécrite au prochain enregistrement de
 * la correction, et le script `scripts/backfill-score-lecture.ts` la rafraîchit
 * en masse.
 */

import type { Firestore } from 'firebase-admin/firestore';
import { scoreLectureQuiz } from '@/lib/lecture-scoring';
import { parseLectureAnswers, type LectureQuiz } from '@/types/lecture';

/** Ce qu'on écrit sur la correction — jamais dans `score`. */
export interface ScoreLectureStocke {
  /** 0 → 100, arrondi comme à l'écran. `null` si rien n'est encore notable. */
  percent: number | null;
  points: number;
  max: number;
  /** Questions ouvertes encore sans note du prof — hors total, ici comme à l'écran. */
  aNoter: number;
  calculeLe: string;
}

/**
 * Le total d'une correction de lecture, ou `null` si l'activité n'en est pas
 * une (une grille, une recherche, une auto-évaluation : leur note vit ailleurs).
 */
export async function calculerScoreLecture(
  db: Firestore,
  correction: { devoirId: string; travailId: string; questionScores?: Record<string, number> }
): Promise<ScoreLectureStocke | null> {
  const [devoirSnap, travailSnap] = await Promise.all([
    db.collection('devoirs').doc(correction.devoirId).get(),
    db.collection('travaux').doc(correction.travailId).get(),
  ]);

  const quiz = devoirSnap.data()?.lectureQuiz as LectureQuiz | undefined;
  if (!quiz?.questions?.length) return null;

  // ⚠ `content` est une CHAÎNE JSON, pas un objet : `parseLectureAnswers` le
  // sait. Une copie sans réponses n'est pas une erreur — l'élève n'a rien
  // rendu, les questions auto valent 0 et les ouvertes restent à noter.
  const answers = parseLectureAnswers(travailSnap.data()?.content as string | undefined)?.answers ?? {};
  const score = scoreLectureQuiz(quiz, answers, correction.questionScores);

  return {
    percent: score.percent,
    points: score.points,
    max: score.max,
    aNoter: score.aNoter,
    calculeLe: new Date().toISOString(),
  };
}

/**
 * Recalcule et écrit le score de lecture d'une correction déjà enregistrée.
 *
 * Appelée après chaque écriture de correction : une seule des deux sources du
 * total passe par le prof (`questionScores`), l'autre — les questions
 * auto-corrigées — est acquise dès la remise de la copie. Ne rien écrire tant
 * que le prof n'a pas noté une question ouverte laisserait sans note toutes
 * les copies d'un questionnaire entièrement automatique.
 *
 * Ne lève jamais : une correction qui s'enregistre ne doit pas échouer parce
 * que son total n'a pas pu être recalculé.
 */
export async function ecrireScoreLecture(db: Firestore, correctionId: string): Promise<void> {
  try {
    const ref = db.collection('corrections').doc(correctionId);
    const snap = await ref.get();
    if (!snap.exists) return;
    const data = snap.data()!;
    const score = await calculerScoreLecture(db, {
      devoirId: data.devoirId,
      travailId: data.travailId,
      questionScores: data.questionScores,
    });
    if (!score) return;
    await ref.update({ scoreLecture: score });
  } catch (error) {
    console.error('Score de lecture non recalculé pour', correctionId, error);
  }
}
