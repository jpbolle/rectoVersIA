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
  'matrice',
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

    // Le QCM et la matrice partagent leurs réponses : ce sont les mêmes
    // colonnes, saisies avec le même éditeur. La matrice y ajoute ses lignes.
    if (type === 'qcm' || type === 'matrice') {
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

    if (type === 'qcm' && question.multiple === true) {
      cleaned.multiple = true;
    }

    // Les lignes — celles de la matrice, et celles d'une échelle de 1 à 5 qui
    // porte plusieurs items (voir estLikertMatrice).
    if (type === 'matrice' || type === 'likert') {
      const items = Array.isArray(question.matriceItems)
        ? question.matriceItems
            .filter((s): s is string => typeof s === 'string')
            .map((s) => s.trim().slice(0, MAX_COURT * 2))
            .filter(Boolean)
        : [];
      // Une matrice à une seule ligne, c'est un QCM : autant le dire au prof
      // en refusant la question plutôt qu'en affichant un tableau d'une ligne.
      // Une ÉCHELLE, elle, se passe très bien d'items : sans eux, c'est le
      // curseur simple, et c'est le cas de tout ce qui a été écrit avant.
      if (type === 'matrice' && items.length < 2) continue;
      if (items.length >= 2) cleaned.matriceItems = items;
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
