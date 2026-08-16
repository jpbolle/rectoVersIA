// Questionnaire de lecture (activités de type « lire ») :
// le prof compose des blocs de questions au verso de la création d'activité,
// l'élève y répond dans sa colonne de gauche (mode worksheet ou quiz).

import type { DrawShape } from './draw';
import type { NiveauConfiance } from './confiance';

export type LectureQuizMode = 'worksheet' | 'quiz';

// 'info' : bloc informatif — pas une question, le prof introduit ou commente
// à même le questionnaire (pas de points, pas de réponse)
//
// Les quatre derniers types manipulés (appariement, ordre, image-annotee,
// ensembles) reposent sur DEUX mécaniques seulement, et pas quatre :
//  - RELIER   : tirer un trait d'une pastille à une autre  → appariement
//  - DÉPLACER : prendre un jeton et le reposer ailleurs     → ordre,
//               image-annotee (l'étiquette tombe dans une case), ensembles
// Le socle vit dans `src/components/QuestionInteractions/`. Ajouter un
// cinquième type manipulé, c'est habiller l'un de ces deux moteurs, jamais
// en écrire un troisième — sinon ils divergent au premier ajustement.
export type LectureQuestionType =
  | 'qcm'
  | 'texte-court'
  | 'texte-long'
  | 'fluorage'
  | 'matrice'
  | 'appariement'
  | 'ordre'
  | 'image-annotee'
  | 'ensembles'
  | 'info';

// Gestes de lecture exercés (alimentent l'onglet Lire du profil élève).
// Les 7 slugs historiques ci-dessous servent de valeurs par défaut ; la liste
// vivante est gérée par l'admin (configuration/didactique) et une question
// peut donc porter n'importe quel id de geste (champ competences: string[]).
export type LectureCompetence =
  | 'explicite'
  | 'inferer'
  | 'interpreter'
  | 'forme'
  | 'modes-medias'
  | 'esprit-critique'
  | 'structures';

export const LECTURE_COMPETENCE_LABELS: Record<LectureCompetence, string> = {
  explicite: "Comprendre l'explicite",
  inferer: 'Inférer',
  interpreter: 'Interpréter',
  forme: 'Analyser la forme',
  'modes-medias': 'Modes et médias',
  'esprit-critique': 'Exercer son esprit critique',
  structures: 'Identifier des structures',
};

export const LECTURE_COMPETENCES: LectureCompetence[] = [
  'explicite',
  'inferer',
  'interpreter',
  'forme',
  'modes-medias',
  'esprit-critique',
  'structures',
];

// Image jointe à une question — stockée en base64 Firestore (ressourceImages),
// servie par /api/ressources/image/[id]
export interface LectureQuestionImage {
  url: string;
  fileId: string;
}

// Audio joint à une question — même stockage que les images (base64 Firestore,
// ≤ 700 Ko soit ~2 min en qualité voix), servi par /api/ressources/image/[id]
export interface LectureQuestionAudio {
  url: string;
  fileId: string;
  // Nombre d'écoutes autorisées côté élève — absent/null = illimité.
  // Contrôle côté navigateur (compteur dans la réponse), pas inviolable.
  maxEcoutes?: number | null;
}

// ─── Briques partagées par les types manipulés ───

/**
 * Un JETON : ce que l'élève déplace ou relie. Trois natures possibles, et
 * c'est volontaire — un appariement dont la colonne de gauche ne saurait
 * porter qu'du texte n'aurait pas d'intérêt pour un cours de français
 * (on veut y mettre un enregistrement, une gravure, un extrait).
 */
export interface LectureJeton {
  id: string;
  kind: 'texte' | 'image' | 'audio';
  texte?: string;                   // kind === 'texte', ou légende d'un média
  media?: LectureQuestionImage;     // kind === 'image' | 'audio' (même stockage)
}

/** Catégorie de fluorage : un libellé, une couleur. */
export interface LectureFluoCategorie {
  id: string;
  label: string;
  couleur: string;                  // clé de FLUO_COULEURS, pas un code hexa
}

/**
 * Une case de dépôt de l'image annotée, et le point auquel elle est reliée.
 * `x` / `y` sont en POURCENTAGE de la taille de l'image — même convention que
 * `DrawShape` (src/types/draw.ts), donc indépendante de la résolution.
 * Le trait case ↔ point est posé par le prof : l'élève n'y touche jamais,
 * il ne fait que remplir la case.
 */
export interface LectureAnnotationCible {
  id: string;
  label: string;                    // l'étiquette attendue dans cette case
  x: number;
  y: number;
  cote: 'gauche' | 'droite';
}

/** Un ensemble (boîte de tri) nommé par le prof. */
export interface LectureEnsemble {
  id: string;
  titre: string;
}

// Couleurs de fluorage — nommées, jamais saisies en hexadécimal par le prof :
// une palette fermée reste lisible sur fond clair et se relit à l'identique
// dans la correction. Les valeurs vivent aussi en CSS (fluo-*).
export const FLUO_COULEURS: Record<string, { label: string; hex: string }> = {
  rouge: { label: 'Rouge', hex: '#ffb3b3' },
  vert: { label: 'Vert', hex: '#b3e6b3' },
  jaune: { label: 'Jaune', hex: '#ffe680' },
  bleu: { label: 'Bleu', hex: '#b3d9ff' },
  violet: { label: 'Violet', hex: '#dcc6ff' },
  orange: { label: 'Orange', hex: '#ffd1a3' },
};

export const FLUO_COULEUR_IDS = Object.keys(FLUO_COULEURS);

export function fluoHex(couleur: string | undefined): string {
  return (couleur && FLUO_COULEURS[couleur]?.hex) || FLUO_COULEURS.jaune.hex;
}

export interface LectureQuestion {
  id: string;                       // LQ-{timestamp}-{rand}
  type: LectureQuestionType;
  enonce: string;
  points: number;
  competences: string[];   // ids de gestes de lecture (config didactique)
  // Toute question peut porter une image : vignette + agrandissement,
  // et atelier de tracé complet côté élève (tracés enregistrés avec la réponse)
  image?: LectureQuestionImage | null;
  // Toute question peut porter un audio (dictée, compréhension orale),
  // avec un nombre d'écoutes limité ou non
  audio?: LectureQuestionAudio | null;
  // Texte joint à la question — un extrait, un document court, une consigne
  // longue. Affiché sous l'énoncé, avant la zone de réponse.
  document?: string;
  // Réponse idéale du prof — jamais exposée à l'élève (filtrée côté serveur),
  // affichée dans la correction pour comparaison
  reponseIdeale?: string;
  // QCM
  choices?: string[];
  correctIndex?: number;            // jamais exposé à l'élève (filtré côté serveur)
  // QCM à réponses multiples. `multiple` change la forme à l'écran (cases à
  // cocher au lieu de boutons ronds) et le corrigé lu : `correctIndexes`
  // remplace alors `correctIndex`. Absent = QCM à réponse unique, donc tous
  // les questionnaires déjà écrits gardent exactement leur comportement.
  multiple?: boolean;
  correctIndexes?: number[];        // jamais exposé à l'élève

  // ── Matrice : plusieurs items qui partagent les mêmes réponses ──
  // Les colonnes réutilisent `choices` (même éditeur que le QCM), les lignes
  // sont `matriceItems`. `matriceCorrect[i]` = index de colonne attendu pour
  // la ligne i ; -1 = aucune réponse attendue (ligne non notée).
  matriceItems?: string[];
  matriceCorrect?: number[];        // jamais exposé à l'élève

  // Souligner du texte (« fluorage ») : extrait collé dans la question, ou la
  // ressource de l'activité (l'élève souligne alors dans l'onglet Ressources)
  fluoSource?: 'extrait' | 'ressource';
  fluoTexte?: string;
  // Mots attendus soulignés par le prof (indices dans fluoTexte) — jamais
  // exposés à l'élève avant le corrigé ; servent à la comparaison automatique
  fluoAttendu?: number[];
  // Marquage par CATÉGORIES (le sujet en rouge, le verbe en vert…).
  // Sans catégorie, le fluorage garde son comportement historique : une seule
  // couleur, `fluoAttendu` seul. Avec catégories, l'attendu est indexé par
  // id de catégorie et `fluoAttendu` n'est plus lu.
  fluoCategories?: LectureFluoCategorie[];
  fluoAttenduParCategorie?: Record<string, number[]>;  // jamais exposé à l'élève

  // ── Appariement (moteur RELIER) ──
  // La colonne de droite peut être plus fournie que celle de gauche : les
  // intrus sont permis. Deux items de gauche peuvent viser la même cible.
  appariementGauche?: LectureJeton[];
  appariementDroite?: LectureJeton[];
  appariementPaires?: Record<string, string>;  // idGauche -> idDroite ; jamais exposé

  // ── Remise en ordre (moteur DÉPLACER) ──
  // Le prof saisit les jetons DANS LE BON ORDRE ; le mélange se fait à
  // l'affichage, avec une graine stable par élève (voir melangeStable).
  ordreItems?: LectureJeton[];

  // ── Image à annoter (moteur DÉPLACER) ──
  // L'image est celle de la question (`image`). Le prof pose des points et
  // leur case de dépôt ; l'élève tire les étiquettes de la réserve.
  annotations?: LectureAnnotationCible[];
  annotationsReserve?: 'haut' | 'bas';         // où s'affiche la réserve (défaut : bas)
  // La réserve d'étiquettes, mélangée. CALCULÉE PAR LE SERVEUR pour l'élève
  // (`lectureQuizForEleve`) : l'ordre de saisie du prof donnerait le corrigé.
  // Jamais écrite en base — c'est une vue, pas une donnée.
  annotationsEtiquettes?: LectureJeton[];

  // ── Ensembles (moteur DÉPLACER) ──
  ensembles?: LectureEnsemble[];
  ensembleItems?: LectureJeton[];
  ensembleAffectations?: Record<string, string>;  // idJeton -> idEnsemble ; jamais exposé
}

export interface LectureQuiz {
  mode: LectureQuizMode;
  questions: LectureQuestion[];
}

// ── Réponses de l'élève — stockées en JSON dans travail.content ──

export interface LectureAnswer {
  choiceIndex?: number | null;      // qcm à réponse unique
  choiceIndexes?: number[];         // qcm à réponses multiples
  text?: string;                    // texte court (brut) / texte long (HTML Tiptap)
  shapes?: DrawShape[];             // tracés sur l'image de la question
  fluoWords?: number[];             // indices des mots fluorés (fluorage « extrait »)
  // Fluorage par catégories : idCategorie -> indices de mots. Un mot ne peut
  // appartenir qu'à une catégorie à la fois (le dernier clic gagne).
  fluoParCategorie?: Record<string, number[]>;
  audioPlays?: number;              // nombre d'écoutes de l'audio déjà consommées
  // Matrice : index de colonne choisi pour chaque ligne (clé = index de ligne)
  matrice?: Record<number, number>;
  // Appariement : idGauche -> idDroite
  paires?: Record<string, string>;
  // Remise en ordre : les ids des jetons, dans l'ordre où l'élève les a mis
  ordre?: string[];
  // Image annotée : idCible -> idÉtiquette (l'étiquette a l'id de sa cible
  // attendue, donc idCible === valeur quand c'est juste)
  annotations?: Record<string, string>;
  // Ensembles : idJeton -> idEnsemble (absent = resté dans la réserve)
  ensembles?: Record<string, string>;
  // Degré d'assurance annoncé par l'élève au moment de répondre — facultatif,
  // n'entre dans AUCUN score. Voir src/types/confiance.ts.
  confiance?: NiveauConfiance;
}

export interface LectureAnswersState {
  type: 'lecture';
  answers: Record<string, LectureAnswer>;   // clé = LectureQuestion.id
}

/**
 * Récapitulatif de remise, CALCULÉ SUR LE SERVEUR (`computeLectureResume`) :
 * le navigateur de l'élève n'a pas les bonnes réponses et ne peut donc rien
 * compter. Même forme que le récapitulatif d'une recherche — c'est le même
 * moment du parcours, il doit se lire pareil.
 */
export interface LectureResume {
  total: number;
  correctes: number;
  erreurs: number;
  aCorrigerParProf: number;
}

export function generateLectureQuestionId(): string {
  return `LQ-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function generateJetonId(): string {
  return `J-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// Libellés des types — un seul endroit, lu par le constructeur, l'écran élève
// et la correction. Trois listes divergentes se sont déjà installées ailleurs
// dans ce projet ; on ne recommence pas.
export const LECTURE_TYPE_LABELS: Record<LectureQuestionType, string> = {
  qcm: 'Choix multiple',
  'texte-court': 'Réponse courte',
  'texte-long': 'Réponse longue',
  fluorage: 'Souligner du texte',
  matrice: 'Matrice',
  appariement: 'Appariement',
  ordre: 'Remise en ordre',
  'image-annotee': 'Image à annoter',
  ensembles: 'Ensembles',
  info: 'Bloc informatif',
};

/**
 * Mélange STABLE : deux ouvertures de la même question par le même élève
 * doivent donner le même désordre, sinon l'élève qui revient sur sa copie
 * retrouve ses blocs ailleurs — et son travail est perdu.
 * Pas de Math.random() : la graine est l'id de la question, complété par
 * l'identifiant du travail quand on l'a.
 */
export function melangeStable<T>(items: T[], graine: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < graine.length; i++) {
    h ^= graine.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    const j = Math.abs(h >>> 0) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Les types que la machine sait corriger seule. Le fluorage n'en fait partie
 * QUE s'il porte des catégories : sans catégorie, un soulignage se compare par
 * degrés et c'est le professeur qui tranche (comportement historique inchangé).
 */
export function estAutoCorrigeable(q: LectureQuestion): boolean {
  switch (q.type) {
    case 'qcm':
      return q.multiple
        ? Array.isArray(q.correctIndexes) && q.correctIndexes.length > 0
        : typeof q.correctIndex === 'number';
    case 'matrice':
      return Array.isArray(q.matriceCorrect) && q.matriceCorrect.some((c) => c >= 0);
    case 'appariement':
      return !!q.appariementPaires && Object.keys(q.appariementPaires).length > 0;
    case 'ordre':
      return Array.isArray(q.ordreItems) && q.ordreItems.length > 1;
    case 'image-annotee':
      return Array.isArray(q.annotations) && q.annotations.length > 0;
    case 'ensembles':
      return !!q.ensembleAffectations && Object.keys(q.ensembleAffectations).length > 0;
    case 'fluorage':
      return !!q.fluoCategories?.length && !!q.fluoAttenduParCategorie;
    default:
      return false;
  }
}

/**
 * Part de réussite d'une question auto-corrigeable, entre 0 et 1.
 * BARÈME PARTIEL (décision de JP, 2026-08-16) : 6 lignes justes sur 8 valent
 * 75 % des points. Le tout-ou-rien annulerait sept bonnes réponses pour une
 * étourderie, ce qui ne dit rien de ce que l'élève sait.
 *
 * Renvoie null quand la question n'est pas auto-corrigeable, ou quand le
 * corrigé n'a pas été transmis (il est filtré côté serveur tant que le prof
 * n'a pas ouvert la correction).
 */
export function partReussite(q: LectureQuestion, a: LectureAnswer | undefined): number | null {
  if (!estAutoCorrigeable(q)) return null;
  const part = (justes: number, total: number) => (total > 0 ? justes / total : null);

  switch (q.type) {
    case 'qcm': {
      if (!q.multiple) return a?.choiceIndex === q.correctIndex ? 1 : 0;
      // Une coche fausse annule une coche juste : sans cela, tout cocher
      // rapporterait tous les points.
      const attendu = new Set(q.correctIndexes ?? []);
      const donne = new Set(a?.choiceIndexes ?? []);
      let bons = 0;
      let faux = 0;
      donne.forEach((i) => (attendu.has(i) ? bons++ : faux++));
      return Math.max(0, (bons - faux) / attendu.size);
    }
    case 'matrice': {
      const attendu = q.matriceCorrect ?? [];
      const notees = attendu.map((c, i) => ({ c, i })).filter((x) => x.c >= 0);
      const justes = notees.filter((x) => a?.matrice?.[x.i] === x.c).length;
      return part(justes, notees.length);
    }
    case 'appariement': {
      const attendu = Object.entries(q.appariementPaires ?? {});
      const justes = attendu.filter(([g, d]) => a?.paires?.[g] === d).length;
      return part(justes, attendu.length);
    }
    case 'ordre': {
      // Combien de jetons sont à la bonne place — pas « la suite est-elle
      // exacte » : un seul décalage ne doit pas tout annuler.
      const bon = (q.ordreItems ?? []).map((j) => j.id);
      const donne = a?.ordre ?? [];
      const justes = bon.filter((id, i) => donne[i] === id).length;
      return part(justes, bon.length);
    }
    case 'image-annotee': {
      const cibles = q.annotations ?? [];
      const justes = cibles.filter((c) => a?.annotations?.[c.id] === c.id).length;
      return part(justes, cibles.length);
    }
    case 'ensembles': {
      const attendu = Object.entries(q.ensembleAffectations ?? {});
      const justes = attendu.filter(([jeton, ens]) => a?.ensembles?.[jeton] === ens).length;
      return part(justes, attendu.length);
    }
    case 'fluorage': {
      // Un mot bien marqué compte ; un mot marqué dans la mauvaise catégorie
      // ou marqué à tort retire un point — même logique que le QCM multiple.
      const attendu = q.fluoAttenduParCategorie ?? {};
      const donne = a?.fluoParCategorie ?? {};
      let total = 0;
      let bons = 0;
      let faux = 0;
      Object.entries(attendu).forEach(([cat, mots]) => {
        total += mots.length;
        const marques = new Set(donne[cat] ?? []);
        bons += mots.filter((m) => marques.has(m)).length;
      });
      // Un mot marqué dans la mauvaise couleur, ou marqué alors qu'il
      // n'attendait rien : les deux coûtent pareil.
      Object.entries(donne).forEach(([cat, mots]) => {
        const bonsDeLaCat = new Set(attendu[cat] ?? []);
        faux += mots.filter((m) => !bonsDeLaCat.has(m)).length;
      });
      return total > 0 ? Math.max(0, (bons - faux) / total) : null;
    }
    default:
      return null;
  }
}

/**
 * La liseuse d'œuvre stocke ses réponses à plat (`Record<string, unknown>`) :
 * un index pour un QCM, une chaîne pour un texte, un objet pour les types
 * manipulés. Ici on ramène tout à un `LectureAnswer`, pour que la notation
 * (`partReussite`) soit la MÊME dans l'œuvre et dans le questionnaire.
 *
 * Deux comptages parallèles finiraient par diverger, et c'est le genre d'écart
 * qui ne se voit qu'au moment où un élève conteste sa note.
 */
export function reponseLiseuseVersAnswer(q: LectureQuestion, valeur: unknown): LectureAnswer {
  if (valeur === undefined || valeur === null) return {};
  if (q.type === 'qcm') {
    if (q.multiple) return { choiceIndexes: Array.isArray(valeur) ? (valeur as number[]) : [] };
    return { choiceIndex: typeof valeur === 'number' ? valeur : null };
  }
  if (typeof valeur === 'string') return { text: valeur };
  if (typeof valeur === 'object') return valeur as LectureAnswer;
  return {};
}

/** Une réponse a-t-elle été donnée ? Sert au décompte de progression. */
export function lectureARepondu(q: LectureQuestion, a: LectureAnswer | undefined): boolean {
  if (q.type === 'info') return true;
  if (!a) return false;
  switch (q.type) {
    case 'qcm':
      return q.multiple
        ? (a.choiceIndexes?.length ?? 0) > 0
        : a.choiceIndex !== null && a.choiceIndex !== undefined;
    case 'texte-court':
      return !!a.text?.trim();
    case 'texte-long':
      return !!a.text?.replace(/<[^>]*>/g, '').trim();
    case 'fluorage':
      return (a.fluoWords?.length ?? 0) > 0
        || Object.values(a.fluoParCategorie ?? {}).some((m) => m.length > 0);
    case 'matrice':
      return Object.keys(a.matrice ?? {}).length > 0;
    case 'appariement':
      return Object.keys(a.paires ?? {}).length > 0;
    case 'ordre':
      return (a.ordre?.length ?? 0) > 0;
    case 'image-annotee':
      return Object.keys(a.annotations ?? {}).length > 0;
    case 'ensembles':
      return Object.keys(a.ensembles ?? {}).length > 0;
    default:
      return false;
  }
}

export function parseLectureAnswers(content: string | undefined | null): LectureAnswersState | null {
  if (!content) return null;
  try {
    const parsed = JSON.parse(content);
    if (parsed && parsed.type === 'lecture' && parsed.answers) return parsed as LectureAnswersState;
    return null;
  } catch {
    return null;
  }
}
