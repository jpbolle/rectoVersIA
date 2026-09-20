// « Cette copie est-elle corrigée ? » — une seule réponse, côté serveur.
//
// La question paraît triviale ; elle ne l'est pas, parce que les dispositifs ne
// rangent pas leur note au même endroit :
//
//   • ÉCRITURE (grille)              → `correction.score`, écrit en base
//   • QUESTIONNAIRE DE LECTURE       → RIEN en base : le total se recalcule à
//                                      l'affichage (`lecture-scoring.ts`), et
//                                      `score` y reste à 0 pour toujours
//   • RECHERCHE, AUTO-ÉVALUATION     → idem, leurs scores ne sont pas agrégés
//
// D'où ce module : le test vivait dans la page du prof, en client, et tout ce
// qui avait besoin de la même réponse ailleurs se trompait en silence.
//
// La définition retenue (2026-09-20) est celle de la colonne « Corrigés » de la
// liste des copies : **plus rien n'attend le professeur**.

import { parseLectureAnswers } from '@/types/lecture';
import { scoreLectureQuiz } from '@/lib/lecture-scoring';
import type { LectureQuiz } from '@/types/lecture';

export interface DevoirPourEtat {
  typeTravail?: string | null;
  lectureQuiz?: LectureQuiz | null;
}

export interface TravailPourEtat {
  content?: string | null;
  status?: string | null;
  nonRendu?: string | null;
}

export interface CorrectionPourEtat {
  score?: number | null;
  questionScores?: Record<string, number> | null;
}

export function copieCorrigee(
  devoir: DevoirPourEtat | null | undefined,
  travail: TravailPourEtat | null | undefined,
  correction: CorrectionPourEtat | null | undefined
): boolean {
  if (!devoir || !travail) return false;
  // Une copie déclarée non rendue n'est pas corrigée : elle est constatée.
  if (travail.nonRendu) return false;

  const quiz = devoir.typeTravail === 'lire' ? devoir.lectureQuiz : null;
  if (quiz?.questions?.length) {
    // ⚠ Sans cette garde, une copie jamais ouverte serait « corrigée » : un QCM
    // sans réponse vaut 0, pas « à noter », donc `aNoter` tomberait à 0 tout
    // seul. C'est la réponse de l'élève qui ouvre la correction.
    const etat = parseLectureAnswers(travail.content);
    if (!etat || Object.keys(etat.answers).length === 0) return false;

    return (
      scoreLectureQuiz(quiz, etat.answers, correction?.questionScores ?? undefined).aNoter === 0
    );
  }

  // Tous les autres dispositifs : la note de la grille. ⚠ Une correction
  // simplement ouverte existe en base avec `score: 0` — elle ne compte pas.
  return typeof correction?.score === 'number' && correction.score > 0;
}
