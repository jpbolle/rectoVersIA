// ─── NavigKid côté serveur : filtrage des questions et calcul du récapitulatif ───
//
// Les questions d'un questionnaire de recherche portent les éléments de correction
// (`correctes`, `reponseAttendue`, `referencesProf`). Elles ne doivent JAMAIS partir
// telles quelles vers un élève : la page activité et l'extension appellent la même
// route que le prof. Même logique que `src/lib/lecture-server.ts` pour la lecture.

import type { NavigKidQuestion, NavigKidQuestionData } from '@/types/navigkid';

/** Récapitulatif calculé sur le serveur (aucune bonne réponse ne transite). */
export interface NavigKidResume {
  total: number;
  correctes: number;
  erreurs: number;
  aCorrigerParProf: number;
}

/**
 * Retire les éléments de correction d'une question.
 * `avecCorrectes` : conserve les indices des bonnes réponses QCM — réservé au cas où
 * le prof a rendu le corrigé disponible.
 */
export function sanitizeQuestionForStudent(
  question: NavigKidQuestion,
  avecCorrectes: boolean,
): NavigKidQuestion {
  const { correctes, reponseAttendue, referencesProf, ...rest } = question;
  void reponseAttendue;
  void referencesProf;
  return avecCorrectes && correctes ? { ...rest, correctes } : rest;
}

export function sanitizeQuestionsForStudent(
  questions: NavigKidQuestion[],
  avecCorrectes: boolean,
): NavigKidQuestion[] {
  return questions.map((q) => sanitizeQuestionForStudent(q, avecCorrectes));
}

/**
 * Une question est auto-corrigeable si c'est un QCM dont le prof a désigné
 * les bonnes réponses. Tout le reste attend la correction du professeur.
 */
function estAutoCorrigeable(question: NavigKidQuestion): boolean {
  return (
    question.type === 'qcm' &&
    Array.isArray(question.correctes) &&
    question.correctes.length > 0 &&
    Array.isArray(question.options) &&
    question.options.length > 0
  );
}

/**
 * L'extension enregistre la réponse QCM sous forme de **texte** de l'option choisie
 * (`question.options[i]`), pas d'indice — la comparaison passe donc par le texte.
 */
export function estReponseCorrecte(
  question: NavigKidQuestion,
  reponse: string | undefined,
): boolean {
  if (!estAutoCorrigeable(question) || !reponse) return false;
  const index = question.options!.findIndex((opt) => opt === reponse);
  return index !== -1 && question.correctes!.includes(index);
}

/** Compte les réussites, les erreurs et ce qui reste à corriger par le prof. */
export function computeRechercheResume(
  questions: NavigKidQuestion[],
  reponses: NavigKidQuestionData[] | undefined,
): NavigKidResume {
  let correctes = 0;
  let erreurs = 0;
  let aCorrigerParProf = 0;

  questions.forEach((question, index) => {
    const donnees = reponses?.find((r) => r.questionIndex === index);
    if (!estAutoCorrigeable(question)) {
      aCorrigerParProf++;
      return;
    }
    if (estReponseCorrecte(question, donnees?.reponse)) {
      correctes++;
    } else {
      erreurs++;
    }
  });

  return { total: questions.length, correctes, erreurs, aCorrigerParProf };
}
