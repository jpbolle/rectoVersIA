// Validation serveur du questionnaire de lecture (création/édition prof)
// et filtrage côté élève (jamais exposer correctIndex).

import type {
  LectureAnswer,
  LectureQuiz,
  LectureQuestion,
  LectureQuestionType,
  LectureResume,
} from '@/types/lecture';

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
    // Bloc informatif en HTML (Tiptap) : ignorer les blocs visuellement vides
    if (
      type === 'info' &&
      enonce.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim() === ''
    ) {
      continue;
    }

    const cleaned: LectureQuestion = {
      id: typeof question.id === 'string' && question.id ? question.id : `LQ-${Date.now()}-${questions.length}`,
      type,
      enonce,
      points: typeof question.points === 'number' && question.points >= 0 ? question.points : 1,
      // Ids de gestes de lecture : liste gérée par l'admin (didactique), on
      // accepte donc tout id raisonnable sans le valider contre une liste fixe
      competences: Array.isArray(question.competences)
        ? [
            ...new Set(
              question.competences.filter(
                (c): c is string => typeof c === 'string' && c.trim() !== '' && c.length <= 60
              )
            ),
          ]
        : [],
    };

    // Image jointe (référence ressourceImages)
    const img = question.image as { url?: unknown; fileId?: unknown } | null | undefined;
    if (img && typeof img.url === 'string' && typeof img.fileId === 'string') {
      cleaned.image = { url: img.url, fileId: img.fileId };
    }

    // Audio joint (même stockage que les images) + limite d'écoutes
    const aud = question.audio as
      | { url?: unknown; fileId?: unknown; maxEcoutes?: unknown }
      | null
      | undefined;
    if (aud && typeof aud.url === 'string' && typeof aud.fileId === 'string') {
      cleaned.audio = { url: aud.url, fileId: aud.fileId };
      if (typeof aud.maxEcoutes === 'number' && aud.maxEcoutes >= 1) {
        cleaned.audio.maxEcoutes = Math.floor(aud.maxEcoutes);
      }
    }

    // Texte joint à la question (extrait, document court) — visible de l'élève
    if (typeof question.document === 'string' && question.document.trim()) {
      cleaned.document = question.document;
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
        // Mots attendus soulignés par le prof : indices valides dans l'extrait
        const wordCount = texte.split(/\s+/).filter(Boolean).length;
        if (Array.isArray(question.fluoAttendu)) {
          const attendu = [
            ...new Set(
              question.fluoAttendu.filter(
                (i): i is number => typeof i === 'number' && Number.isInteger(i) && i >= 0 && i < wordCount
              )
            ),
          ].sort((a, b) => a - b);
          if (attendu.length > 0) cleaned.fluoAttendu = attendu;
        }
      }
    }

    questions.push(cleaned);
  }

  if (questions.length === 0) return null;
  return { mode, questions };
}

// Version élève : retire les bonnes réponses des QCM, les réponses idéales
// et le soulignage attendu. À n'appliquer que tant qu'aucune des deux portes
// n'est ouverte pour cet élève :
//  - `devoir.corrigeDisponible` — le prof ouvre le corrigé à toute la classe ;
//  - `correction.visibleParEleve` — la correction de CET élève lui est rendue.
// La seconde n'est pas un confort : l'onglet Évaluation calcule le score côté
// client, et sans ces champs les QCM et les soulignages sortent du total.
// Voir /api/devoirs/[id] (`quizComplet`).
export function lectureQuizForEleve(quiz: LectureQuiz | null | undefined): LectureQuiz | null {
  if (!quiz) return null;
  return {
    mode: quiz.mode,
    questions: quiz.questions.map((q) => {
      const {
        correctIndex: _correctIndex,
        reponseIdeale: _reponseIdeale,
        fluoAttendu: _fluoAttendu,
        ...rest
      } = q;
      return rest as LectureQuestion;
    }),
  };
}

// ─── Récapitulatif de remise (élève) ───
//
// Après avoir envoyé son questionnaire, l'élève a droit à un premier retour :
// combien de réponses sont justes, combien sont fausses, combien attendent son
// professeur. Ce calcul ne peut PAS se faire dans le navigateur — le corrigé y
// est justement absent (`lectureQuizForEleve`). Il se fait donc ici, et seuls
// les trois compteurs voyagent : aucune bonne réponse ne transite.
//
// Même forme et mêmes mots que le récapitulatif d'une recherche
// (`computeRechercheResume`) : c'est le même moment du parcours élève.

/**
 * Seuls les QCM dont le prof a désigné la bonne réponse se comptent tout seuls.
 * Tout le reste — textes courts, textes longs, soulignages — attend le regard
 * du professeur : un soulignage se compare par degrés, pas en juste/faux.
 */
function estAutoCorrigeable(q: LectureQuestion): boolean {
  return q.type === 'qcm' && typeof q.correctIndex === 'number';
}

export function computeLectureResume(
  quiz: LectureQuiz | null | undefined,
  answers: Record<string, LectureAnswer> | null | undefined
): LectureResume | null {
  if (!quiz?.questions?.length) return null;

  // Les blocs informatifs ne sont pas des questions, et une question à 0 point
  // n'est pas notée : ni l'une ni l'autre n'entre dans les compteurs.
  const questions = quiz.questions.filter((q) => q.type !== 'info' && (q.points || 0) > 0);
  if (questions.length === 0) return null;

  let correctes = 0;
  let erreurs = 0;
  let aCorrigerParProf = 0;

  for (const q of questions) {
    if (!estAutoCorrigeable(q)) {
      aCorrigerParProf++;
      continue;
    }
    // Une question laissée vide est une erreur, pas une question en attente :
    // le prof n'a rien à y corriger.
    if (answers?.[q.id]?.choiceIndex === q.correctIndex) correctes++;
    else erreurs++;
  }

  return { total: questions.length, correctes, erreurs, aCorrigerParProf };
}
