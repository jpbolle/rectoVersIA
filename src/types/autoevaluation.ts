// Questionnaire d'AUTO-ÉVALUATION (activités de type « autoevaluation »).
//
// Objectif pédagogique posé par JP le 2026-08-14 : amener l'élève à porter un
// regard sur l'un de ses travaux, ou sur son attitude pendant une période.
// Ce n'est donc PAS une évaluation du prof : rien n'est « juste » ou « faux »,
// et le questionnaire ne produit pas de note. Ce qu'il produit, c'est une
// parole de l'élève sur son propre travail.
//
// Conséquences dans tout le code :
//  - aucun `points`, aucun `correctIndex` : il n'y a rien à corriger ;
//  - les gestes travaillés sont ceux du SAVOIR-ÊTRE et les gestes RÉFLEXIFS,
//    jamais les gestes cognitifs (cf. TYPES_SAVOIR_ETRE) ;
//  - une grille n'a pas de sens ici — l'activité s'appuie sur les habiletés.
//
// Même forme que le questionnaire de lecture (`src/types/lecture.ts`) : le
// prof compose des blocs au verso de la création d'activité, l'élève y répond
// et ses réponses sont enregistrées en JSON dans `travail.content`.

// Six manières de répondre. Les trois dernières n'existent que pour
// l'auto-évaluation : dire une compétence ressentie, une humeur, ou se situer
// sur une échelle — trois choses qu'une question ouverte capte mal chez un
// adolescent qui n'a pas les mots.
export type AutoEvalQuestionType =
  | 'qcm'
  | 'texte-court'
  | 'texte-long'
  | 'competence'  // emoji : sentiment de compétence
  | 'humeur'      // emoji : émotion ressentie
  | 'likert'      // curseur de 1 à 5
  | 'matrice'     // plusieurs items qui partagent les mêmes réponses
  | 'info';       // bloc informatif : le prof introduit, l'élève ne répond pas

// ─── Échelles à emoji ───
//
// La valeur STOCKÉE est l'identifiant, jamais l'emoji : les libellés peuvent
// changer sans rendre illisibles les réponses déjà données.

export interface EchelonEmoji {
  id: string;
  emoji: string;
  label: string;
}

// Sentiment de compétence — « où j'en suis »
export const ECHELLE_COMPETENCE: EchelonEmoji[] = [
  { id: 'perdu', emoji: '😵‍💫', label: 'Je suis perdu' },
  { id: 'fragile', emoji: '😟', label: 'C’est fragile' },
  { id: 'presque', emoji: '🙂', label: 'Presque acquis' },
  { id: 'acquis', emoji: '😀', label: 'Je sais faire' },
  { id: 'expert', emoji: '🤩', label: 'Je peux l’expliquer aux autres' },
];

// Émotion ressentie pendant le travail — « comment je l'ai vécu »
export const ECHELLE_HUMEUR: EchelonEmoji[] = [
  { id: 'decourage', emoji: '😞', label: 'Découragé' },
  { id: 'agace', emoji: '😤', label: 'Agacé' },
  { id: 'perplexe', emoji: '🤔', label: 'Perplexe' },
  { id: 'serein', emoji: '😌', label: 'Serein' },
  { id: 'fier', emoji: '😃', label: 'Fier de moi' },
];

export function echelleDe(type: AutoEvalQuestionType): EchelonEmoji[] {
  if (type === 'competence') return ECHELLE_COMPETENCE;
  if (type === 'humeur') return ECHELLE_HUMEUR;
  return [];
}

export function echelonLabel(type: AutoEvalQuestionType, id: string): string {
  const e = echelleDe(type).find((x) => x.id === id);
  return e ? `${e.emoji} ${e.label}` : id;
}

// Bornes par défaut d'une échelle de Likert — le prof les réécrit
export const LIKERT_MIN_DEFAUT = 'Pas du tout';
export const LIKERT_MAX_DEFAUT = 'Tout à fait';
export const LIKERT_NIVEAUX = 5;

/**
 * Échelles prêtes pour les colonnes d'une matrice.
 * Le prof part de l'une d'elles ou écrit les siennes — sans ces modèles, il
 * ressaisirait « Jamais / Parfois / Souvent » à chaque questionnaire.
 */
export const MATRICE_MODELES: { id: string; label: string; colonnes: string[] }[] = [
  { id: 'frequence', label: 'Fréquence', colonnes: ['Jamais', 'Parfois', 'Souvent', 'Toujours'] },
  { id: 'accord', label: 'Accord', colonnes: ['Pas du tout', 'Un peu', 'Assez', 'Tout à fait'] },
  { id: 'facilite', label: 'Facilité', colonnes: ['Très difficile', 'Difficile', 'Facile', 'Très facile'] },
  { id: 'maitrise', label: 'Maîtrise', colonnes: ['Pas encore', 'En cours', 'Acquis'] },
];

export interface AutoEvalQuestion {
  id: string; // AE-{timestamp}-{rand}
  type: AutoEvalQuestionType;
  enonce: string;
  // Gestes de savoir-être et gestes réflexifs travaillés (config didactique).
  // Alimentent l'onglet réflexif du profil de l'élève.
  competences: string[];
  // Une réponse peut être exigée avant la remise
  obligatoire?: boolean;
  // QCM — pas de bonne réponse : ce sont des positions, pas des solutions
  choices?: string[];
  // L'élève peut-il en cocher plusieurs ? Absent = une seule.
  multiple?: boolean;
  // Matrice : les lignes. Les colonnes réutilisent `choices` — c'est le même
  // éditeur que le QCM, et surtout la même chose : des réponses partagées.
  // Ici aucune colonne n'est « juste » : ce sont des positions.
  matriceItems?: string[];
  // Likert : les deux bornes de l'échelle
  likertMin?: string;
  likertMax?: string;
  // Texte d'accompagnement affiché sous l'énoncé (rappel de consigne, extrait
  // du travail à commenter…)
  document?: string;
}

export interface AutoEvalQuestionnaire {
  // Ce sur quoi l'élève se prononce — figure en tête de son questionnaire
  intention?: string;
  questions: AutoEvalQuestion[];
}

// ── Réponses de l'élève — stockées en JSON dans travail.content ──

export interface AutoEvalAnswer {
  choiceIndex?: number | null;   // qcm à réponse unique
  choiceIndexes?: number[];      // qcm à réponses multiples
  text?: string;                 // texte court (brut) / texte long (HTML)
  echelon?: string | null;       // competence / humeur : id de l'échelon
  likert?: number | null;        // 1 à 5
  // Matrice : index de colonne choisi par ligne (clé = index de ligne)
  matrice?: Record<number, number>;
}

export interface AutoEvalAnswersState {
  type: 'autoevaluation';
  answers: Record<string, AutoEvalAnswer>; // clé = AutoEvalQuestion.id
}

export function generateAutoEvalQuestionId(): string {
  return `AE-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function parseAutoEvalAnswers(
  content: string | undefined | null
): AutoEvalAnswersState | null {
  if (!content) return null;
  try {
    const parsed = JSON.parse(content);
    if (parsed && parsed.type === 'autoevaluation' && parsed.answers) {
      return parsed as AutoEvalAnswersState;
    }
    return null;
  } catch {
    return null;
  }
}

// Une question attend-elle une réponse de l'élève ?
export function estQuestion(q: AutoEvalQuestion): boolean {
  return q.type !== 'info';
}

// Réponse donnée ou non — sert au décompte de progression et à la remise
export function aRepondu(q: AutoEvalQuestion, a: AutoEvalAnswer | undefined): boolean {
  if (!estQuestion(q)) return true;
  if (!a) return false;
  switch (q.type) {
    case 'qcm':
      return q.multiple
        ? (a.choiceIndexes?.length ?? 0) > 0
        : a.choiceIndex !== null && a.choiceIndex !== undefined;
    case 'matrice':
      // Une matrice n'est complète que si TOUTES ses lignes sont renseignées :
      // une ligne oubliée n'est pas une position, c'est un oubli.
      return (q.matriceItems ?? []).every((_, i) => typeof a.matrice?.[i] === 'number');
    case 'competence':
    case 'humeur':
      return !!a.echelon;
    case 'likert':
      return typeof a.likert === 'number' && a.likert > 0;
    case 'texte-court':
      return !!a.text?.trim();
    case 'texte-long':
      // Tiptap laisse un paragraphe vide : on regarde le texte réel
      return !!a.text?.replace(/<[^>]*>/g, '').trim();
    default:
      return false;
  }
}

// Libellés des types, pour le constructeur et la relecture
export const AUTOEVAL_TYPE_LABELS: Record<AutoEvalQuestionType, string> = {
  qcm: 'Choix multiple',
  'texte-court': 'Réponse courte',
  'texte-long': 'Réponse longue',
  competence: 'Sentiment de compétence',
  humeur: 'Émotion ressentie',
  likert: 'Échelle de 1 à 5',
  matrice: 'Matrice',
  info: 'Bloc informatif',
};
