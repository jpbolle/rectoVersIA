// Validation serveur du questionnaire d'auto-évaluation (création/édition prof).
//
// Pendant de `lecture-server.ts`, en plus simple : il n'y a RIEN à filtrer pour
// l'élève. Un questionnaire d'auto-évaluation ne contient ni bonne réponse ni
// corrigé — l'élève peut donc recevoir le document tel quel.

import type { AutoEvalQuestion, AutoEvalQuestionType, AutoEvalQuestionnaire } from '@/types/autoevaluation';

const TYPES: AutoEvalQuestionType[] = [
  'qcm',
  'texte-court',
  'texte-long',
  'competence',
  'humeur',
  'likert',
  'info',
];

const MAX_ENONCE = 4000;
const MAX_COURT = 200;

function texte(v: unknown, max = MAX_ENONCE): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

// Nettoie un questionnaire reçu du client — renvoie null si vide ou invalide
export function sanitizeAutoEvalQuiz(input: unknown): AutoEvalQuestionnaire | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as { intention?: unknown; questions?: unknown };
  if (!Array.isArray(raw.questions)) return null;

  const questions: AutoEvalQuestion[] = [];
  for (const q of raw.questions) {
    if (!q || typeof q !== 'object') continue;
    const question = q as Record<string, unknown>;
    const type = TYPES.includes(question.type as AutoEvalQuestionType)
      ? (question.type as AutoEvalQuestionType)
      : null;
    const enonce = texte(question.enonce);
    // Une question sans énoncé ne veut rien dire : on la laisse tomber
    if (!type || !enonce) continue;

    const cleaned: AutoEvalQuestion = {
      id:
        typeof question.id === 'string' && question.id
          ? question.id.slice(0, 60)
          : `AE-${Date.now()}-${questions.length}`,
      type,
      enonce,
      // Ids de gestes (savoir-être, réflexifs) : la liste vit dans la config
      // didactique, tenue par l'admin — on ne la valide pas ici
      competences: Array.isArray(question.competences)
        ? [
            ...new Set(
              question.competences.filter(
                (c): c is string => typeof c === 'string' && c.trim() !== '' && c.length <= 60
              )
            ),
          ]
        : [],
      obligatoire: question.obligatoire === true,
    };

    const document = texte(question.document);
    if (document) cleaned.document = document;

    if (type === 'qcm') {
      const choices = Array.isArray(question.choices)
        ? question.choices
            .filter((c): c is string => typeof c === 'string')
            .map((c) => c.trim().slice(0, MAX_COURT))
            .filter(Boolean)
        : [];
      // Un choix multiple qui n'offre pas au moins deux positions n'en est pas un
      if (choices.length < 2) continue;
      cleaned.choices = choices;
    }

    if (type === 'likert') {
      cleaned.likertMin = texte(question.likertMin, MAX_COURT);
      cleaned.likertMax = texte(question.likertMax, MAX_COURT);
    }

    questions.push(cleaned);
  }

  if (questions.length === 0) return null;
  return { intention: texte(raw.intention, MAX_COURT * 4), questions };
}
