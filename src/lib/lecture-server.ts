// Validation serveur du questionnaire de lecture (création/édition prof)
// et filtrage côté élève (jamais exposer correctIndex).

import type {
  LectureAnnotationCible,
  LectureAnswer,
  LectureEnsemble,
  LectureFluoCategorie,
  LectureJeton,
  LectureQuiz,
  LectureQuestion,
  LectureQuestionType,
  LectureResume,
} from '@/types/lecture';
import { FLUO_COULEUR_IDS, estAutoCorrigeable, melangeStable, partReussite } from '@/types/lecture';

const QUESTION_TYPES: LectureQuestionType[] = [
  'qcm',
  'texte-court',
  'texte-long',
  'fluorage',
  'matrice',
  'appariement',
  'ordre',
  'image-annotee',
  'ensembles',
  'info',
];

// ─── Petites moulinettes de nettoyage ───
//
// ⚠️ Elles ne posent JAMAIS `undefined` sur une propriété : Firestore refuse
// la valeur et fait échouer l'écriture entière. Le piège a déjà coûté deux
// 500 sur l'atelier Œuvre (cf. `chapitresPourFirestore`). Ici, un champ absent
// reste absent — on ne l'écrit pas.

const texteCourt = (v: unknown, max = 400): string =>
  typeof v === 'string' ? v.trim().slice(0, max) : '';

function nettoyerJetons(input: unknown, prefixe: string): LectureJeton[] {
  if (!Array.isArray(input)) return [];
  const out: LectureJeton[] = [];
  input.forEach((raw, i) => {
    if (!raw || typeof raw !== 'object') return;
    const j = raw as Record<string, unknown>;
    const kind = j.kind === 'image' || j.kind === 'audio' ? j.kind : 'texte';
    const jeton: LectureJeton = {
      id: typeof j.id === 'string' && j.id ? j.id : `${prefixe}-${i}`,
      kind,
    };
    const t = texteCourt(j.texte, 300);
    if (t) jeton.texte = t;
    const m = j.media as { url?: unknown; fileId?: unknown } | null | undefined;
    if (m && typeof m.url === 'string' && typeof m.fileId === 'string') {
      jeton.media = { url: m.url, fileId: m.fileId };
    }
    // Un jeton sans rien à montrer n'est pas un jeton
    if (kind === 'texte' && !jeton.texte) return;
    if (kind !== 'texte' && !jeton.media) return;
    out.push(jeton);
  });
  return out;
}

/** Table id -> id, restreinte aux ids réellement présents des deux côtés. */
function nettoyerCorrespondances(
  input: unknown,
  clesValides: Set<string>,
  valeursValides: Set<string>
): Record<string, string> {
  if (!input || typeof input !== 'object') return {};
  const out: Record<string, string> = {};
  Object.entries(input as Record<string, unknown>).forEach(([k, v]) => {
    if (typeof v === 'string' && clesValides.has(k) && valeursValides.has(v)) out[k] = v;
  });
  return out;
}

/** Indices de mots valides dans un texte donné, dédoublonnés et triés. */
function nettoyerIndices(input: unknown, nbMots: number): number[] {
  if (!Array.isArray(input)) return [];
  return [
    ...new Set(
      input.filter(
        (i): i is number => typeof i === 'number' && Number.isInteger(i) && i >= 0 && i < nbMots
      )
    ),
  ].sort((a, b) => a - b);
}

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

    if (type === 'qcm' || type === 'matrice') {
      const choices = Array.isArray(question.choices)
        ? question.choices.filter((c): c is string => typeof c === 'string' && c.trim() !== '')
        : [];
      if (choices.length < 2) continue;
      cleaned.choices = choices;
    }

    if (type === 'qcm') {
      const choices = cleaned.choices!;
      if (question.multiple === true) {
        cleaned.multiple = true;
        const idx = Array.isArray(question.correctIndexes)
          ? [
              ...new Set(
                question.correctIndexes.filter(
                  (i): i is number => typeof i === 'number' && i >= 0 && i < choices.length
                )
              ),
            ].sort((a, b) => a - b)
          : [];
        // Un QCM multiple sans aucune bonne réponse ne se corrige pas :
        // on retombe alors sur la première, comme le QCM simple le fait déjà.
        cleaned.correctIndexes = idx.length > 0 ? idx : [0];
      } else {
        const ci = question.correctIndex;
        cleaned.correctIndex =
          typeof ci === 'number' && ci >= 0 && ci < choices.length ? ci : 0;
      }
    }

    if (type === 'matrice') {
      const items = Array.isArray(question.matriceItems)
        ? question.matriceItems
            .filter((s): s is string => typeof s === 'string' && s.trim() !== '')
            .map((s) => s.trim())
        : [];
      if (items.length === 0) continue;
      cleaned.matriceItems = items;
      const nbCol = cleaned.choices!.length;
      // -1 = ligne sans réponse attendue (elle sort du barème)
      cleaned.matriceCorrect = items.map((_, i) => {
        const v = Array.isArray(question.matriceCorrect) ? question.matriceCorrect[i] : undefined;
        return typeof v === 'number' && v >= 0 && v < nbCol ? v : -1;
      });
    }

    if (type === 'fluorage') {
      cleaned.fluoSource = question.fluoSource === 'ressource' ? 'ressource' : 'extrait';

      // Catégories de marquage (le sujet en rouge, le verbe en vert…).
      // Sans catégorie, le fluorage garde son comportement historique.
      const cats: LectureFluoCategorie[] = Array.isArray(question.fluoCategories)
        ? (question.fluoCategories as unknown[])
            .map((raw, i) => {
              if (!raw || typeof raw !== 'object') return null;
              const c = raw as Record<string, unknown>;
              const label = texteCourt(c.label, 60);
              if (!label) return null;
              return {
                id: typeof c.id === 'string' && c.id ? c.id : `cat-${i}`,
                label,
                couleur: FLUO_COULEUR_IDS.includes(c.couleur as string)
                  ? (c.couleur as string)
                  : FLUO_COULEUR_IDS[i % FLUO_COULEUR_IDS.length],
              };
            })
            .filter((c): c is LectureFluoCategorie => c !== null)
        : [];
      if (cats.length > 0) cleaned.fluoCategories = cats;

      if (cleaned.fluoSource === 'extrait') {
        const texte = typeof question.fluoTexte === 'string' ? question.fluoTexte.trim() : '';
        if (!texte) continue;
        cleaned.fluoTexte = texte;
        const nbMots = texte.split(/\s+/).filter(Boolean).length;

        if (cats.length > 0) {
          const parCat: Record<string, number[]> = {};
          const brut = (question.fluoAttenduParCategorie ?? {}) as Record<string, unknown>;
          let total = 0;
          cats.forEach((c) => {
            const mots = nettoyerIndices(brut[c.id], nbMots);
            if (mots.length > 0) {
              parCat[c.id] = mots;
              total += mots.length;
            }
          });
          if (total > 0) cleaned.fluoAttenduParCategorie = parCat;
        } else {
          const attendu = nettoyerIndices(question.fluoAttendu, nbMots);
          if (attendu.length > 0) cleaned.fluoAttendu = attendu;
        }
      }
    }

    if (type === 'appariement') {
      const gauche = nettoyerJetons(question.appariementGauche, 'g');
      const droite = nettoyerJetons(question.appariementDroite, 'd');
      if (gauche.length === 0 || droite.length === 0) continue;
      cleaned.appariementGauche = gauche;
      cleaned.appariementDroite = droite;
      const paires = nettoyerCorrespondances(
        question.appariementPaires,
        new Set(gauche.map((j) => j.id)),
        new Set(droite.map((j) => j.id))
      );
      if (Object.keys(paires).length > 0) cleaned.appariementPaires = paires;
    }

    if (type === 'ordre') {
      const items = nettoyerJetons(question.ordreItems, 'o');
      if (items.length < 2) continue;
      cleaned.ordreItems = items;
    }

    if (type === 'image-annotee') {
      // L'image est celle de la question : sans elle, il n'y a rien à annoter
      if (!cleaned.image) continue;
      const cibles: LectureAnnotationCible[] = Array.isArray(question.annotations)
        ? (question.annotations as unknown[])
            .map((raw, i) => {
              if (!raw || typeof raw !== 'object') return null;
              const c = raw as Record<string, unknown>;
              const label = texteCourt(c.label, 80);
              const x = typeof c.x === 'number' ? c.x : NaN;
              const y = typeof c.y === 'number' ? c.y : NaN;
              if (!label || !Number.isFinite(x) || !Number.isFinite(y)) return null;
              return {
                id: typeof c.id === 'string' && c.id ? c.id : `a-${i}`,
                label,
                x: Math.max(0, Math.min(100, x)),
                y: Math.max(0, Math.min(100, y)),
                cote: c.cote === 'droite' ? ('droite' as const) : ('gauche' as const),
              };
            })
            .filter((c): c is LectureAnnotationCible => c !== null)
        : [];
      if (cibles.length === 0) continue;
      cleaned.annotations = cibles;
      cleaned.annotationsReserve = question.annotationsReserve === 'haut' ? 'haut' : 'bas';
    }

    if (type === 'ensembles') {
      const boites: LectureEnsemble[] = Array.isArray(question.ensembles)
        ? (question.ensembles as unknown[])
            .map((raw, i) => {
              if (!raw || typeof raw !== 'object') return null;
              const e = raw as Record<string, unknown>;
              const titre = texteCourt(e.titre, 80);
              if (!titre) return null;
              return { id: typeof e.id === 'string' && e.id ? e.id : `e-${i}`, titre };
            })
            .filter((e): e is LectureEnsemble => e !== null)
        : [];
      const items = nettoyerJetons(question.ensembleItems, 'i');
      if (boites.length < 2 || items.length === 0) continue;
      cleaned.ensembles = boites;
      cleaned.ensembleItems = items;
      const aff = nettoyerCorrespondances(
        question.ensembleAffectations,
        new Set(items.map((j) => j.id)),
        new Set(boites.map((b) => b.id))
      );
      if (Object.keys(aff).length > 0) cleaned.ensembleAffectations = aff;
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
/**
 * MÉLANGE DE PRÉSENTATION — à ne pas confondre avec le filtrage du corrigé.
 *
 * Le prof saisit les jetons d'une remise en ordre DANS LE BON ORDRE, et les
 * étiquettes d'une image annotée dans l'ordre de ses cases. Les servir tels
 * quels ne « laisserait pas voir le corrigé » : ça livrerait l'exercice déjà
 * résolu, ce qui n'est pas la même chose.
 *
 * D'où l'appel dans les DEUX chemins, y compris la liseuse d'œuvre où le
 * corrigé est pourtant volontairement ouvert (cf. `oeuvre-server.ts`).
 *
 * La graine est l'id de la question : le même élève qui revient sur sa copie
 * retrouve ses blocs au même endroit. Un mélange au hasard à chaque ouverture
 * effacerait son travail sous ses yeux.
 */
export function preparerPresentation(q: LectureQuestion): LectureQuestion {
  if (!q.ordreItems && !q.annotations) return q;
  const out: LectureQuestion = { ...q };
  if (q.ordreItems) {
    out.ordreItems = melangeStable(q.ordreItems, q.id);
  }
  if (q.annotations) {
    out.annotationsEtiquettes = melangeStable(
      q.annotations.map((c) => ({ id: c.id, kind: 'texte' as const, texte: c.label })),
      q.id
    );
  }
  return out;
}

export function lectureQuizForEleve(quiz: LectureQuiz | null | undefined): LectureQuiz | null {
  if (!quiz) return null;
  return {
    mode: quiz.mode,
    questions: quiz.questions.map(preparerPresentation).map((q) => {
      const {
        correctIndex: _correctIndex,
        correctIndexes: _correctIndexes,
        matriceCorrect: _matriceCorrect,
        reponseIdeale: _reponseIdeale,
        fluoAttendu: _fluoAttendu,
        fluoAttenduParCategorie: _fluoAttenduParCategorie,
        appariementPaires: _appariementPaires,
        ensembleAffectations: _ensembleAffectations,
        annotations,
        ...rest
      } = q;

      const filtre = rest as LectureQuestion;

      // Image annotée : les CASES doivent partir (l'élève voit où déposer),
      // mais pas leur libellé attendu — sinon la réponse est écrite dessus.
      // Les étiquettes à placer voyagent à part, déjà mélangées par
      // `preparerPresentation` : ne pas les recalculer ici.
      if (annotations) {
        filtre.annotations = annotations.map((c) => ({ ...c, label: '' }));
      }

      return filtre;
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
 * Se comptent tout seuls : les QCM, la matrice et les quatre types manipulés
 * (appariement, remise en ordre, image annotée, ensembles) — tous ont un
 * corrigé exact. Le fluorage n'en fait partie que s'il porte des catégories.
 * Restent au professeur les textes courts, les textes longs et le soulignage
 * sans catégorie, qui se comparent par degrés et pas en juste/faux.
 * (La règle vit dans `estAutoCorrigeable`, src/types/lecture.ts.)
 */
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
    // Le barème est partiel, mais ce récapitulatif compte des QUESTIONS, pas
    // des points : une question à moitié juste s'annonce juste. Elle n'est
    // « fausse » que si rien n'y est bon — sinon l'élève lirait « 6 erreurs »
    // pour six appariements dont il a réussi la moitié.
    const part = partReussite(q, answers?.[q.id]);
    if (part !== null && part > 0) correctes++;
    else erreurs++;
  }

  return { total: questions.length, correctes, erreurs, aCorrigerParProf };
}
