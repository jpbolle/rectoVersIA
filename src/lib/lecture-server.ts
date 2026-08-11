// Validation serveur du questionnaire de lecture (création/édition prof)
// et filtrage côté élève (jamais exposer correctIndex).

import type {
  LectureQuiz,
  LectureQuestion,
  LectureQuestionType,
  LectureCompetence,
} from '@/types/lecture';
import { LECTURE_COMPETENCES } from '@/types/lecture';

const QUESTION_TYPES: LectureQuestionType[] = ['qcm', 'texte-court', 'texte-long', 'fluorage', 'info'];

// Nettoie un lectureQuiz reçu du client — renvoie null si vide/invalide
export function sanitizeLectureQuiz(input: unknown): LectureQuiz | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as { mode?: unknown; questions?: unknown };
  const mode = raw.mode === 'quiz' ? 'quiz' : 'worksheet';
  if (!Array.isArray(raw.questions)) return null;

  const questions: LectureQuestion[] = [];
  for (const q of raw.questions) {
    if (!q || typeof q !== 'object') continue;
    const question = q as Record<string, unknown>;
    const type = QUESTION_TYPES.includes(question.type as LectureQuestionType)
      ? (question.type as LectureQuestionType)
      : null;
    const enonce = typeof question.enonce === 'string' ? question.enonce.trim() : '';
    if (!type || !enonce) continue;

    const cleaned: LectureQuestion = {
      id: typeof question.id === 'string' && question.id ? question.id : `LQ-${Date.now()}-${questions.length}`,
      type,
      enonce,
      points: typeof question.points === 'number' && question.points >= 0 ? question.points : 1,
      competences: Array.isArray(question.competences)
        ? (question.competences.filter((c) =>
            LECTURE_COMPETENCES.includes(c as LectureCompetence)
          ) as LectureCompetence[])
        : [],
    };

    // Image jointe (référence ressourceImages)
    const img = question.image as { url?: unknown; fileId?: unknown } | null | undefined;
    if (img && typeof img.url === 'string' && typeof img.fileId === 'string') {
      cleaned.image = { url: img.url, fileId: img.fileId };
    }

    // Réponse idéale du prof (pas pour les blocs informatifs)
    if (type !== 'info' && typeof question.reponseIdeale === 'string' && question.reponseIdeale.trim()) {
      cleaned.reponseIdeale = question.reponseIdeale.trim();
    }
    if (type === 'info') {
      cleaned.points = 0;
    }

    if (type === 'qcm') {
      const choices = Array.isArray(question.choices)
        ? question.choices.filter((c): c is string => typeof c === 'string' && c.trim() !== '')
        : [];
      if (choices.length < 2) continue;
      cleaned.choices = choices;
      const ci = question.correctIndex;
      cleaned.correctIndex =
        typeof ci === 'number' && ci >= 0 && ci < choices.length ? ci : 0;
    }

    if (type === 'fluorage') {
      cleaned.fluoSource = question.fluoSource === 'ressource' ? 'ressource' : 'extrait';
      if (cleaned.fluoSource === 'extrait') {
        const texte = typeof question.fluoTexte === 'string' ? question.fluoTexte.trim() : '';
        if (!texte) continue;
        cleaned.fluoTexte = texte;
      }
    }

    questions.push(cleaned);
  }

  if (questions.length === 0) return null;
  return { mode, questions };
}

// Version élève : retire les bonnes réponses des QCM et les réponses idéales
export function lectureQuizForEleve(quiz: LectureQuiz | null | undefined): LectureQuiz | null {
  if (!quiz) return null;
  return {
    mode: quiz.mode,
    questions: quiz.questions.map((q) => {
      const { correctIndex: _correctIndex, reponseIdeale: _reponseIdeale, ...rest } = q;
      return rest as LectureQuestion;
    }),
  };
}
