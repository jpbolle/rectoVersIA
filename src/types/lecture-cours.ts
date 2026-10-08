// ═══ LECTURE D'UNE SÉQUENCE DE COURS — l'outil de l'élève FLE (2026-10-08) ═══
//
// L'élève DASPA importe un cours (Google Docs/Slides/Sheets, PDF ≤ 5 pages,
// page web, texte collé) et Claude le lui rend lisible en six sections,
// générées UNE À UNE et enregistrées dès qu'elles sont prêtes. Ce n'est ni une
// activité (`devoirs`) ni une copie (`travaux`) : une lecture appartient à
// l'élève, le prof la LIT depuis la fiche élève de sa classe FLE.
//
// Document Firestore lecturesCours/{id}, accès serveur uniquement
// (/api/fle/lectures). Plan : harnais/plans/2026-10-08-lecture-sequence-de-cours-fle.md

import type { Diagram } from '@/types/diagram';

export type SourceLectureType = 'gdoc' | 'gslides' | 'gsheet' | 'pdf' | 'web' | 'texte';

export interface SourceLecture {
  type: SourceLectureType;
  url?: string;
  nomFichier?: string;
  // PDF : nombre de pages compté à l'import
  pages?: number;
}

// Les six sections, dans l'ordre d'apparition (et de génération)
export type SectionCle =
  | 'resume'
  | 'saillants'
  | 'vocabulaire'
  | 'reformulation'
  | 'grammaire'
  | 'passerelle'
  | 'resumeEleve';

export const SECTIONS_ORDRE: SectionCle[] = [
  'resume',
  'saillants',
  'vocabulaire',
  'reformulation',
  'grammaire',
  'passerelle',
  'resumeEleve',
];

// Les sections que Claude GÉNÈRE à l'ouverture ; « Mon résumé » n'en est pas :
// c'est l'élève qui écrit, Claude ne vient qu'à sa demande (bouton)
export const SECTIONS_GENEREES: SectionCle[] = SECTIONS_ORDRE.filter((c) => c !== 'resumeEleve');

export const SECTION_LIBELLES: Record<SectionCle, { titre: string; picto: string; sousTitre: string }> = {
  resume: { titre: 'Le cours en bref', picto: '📝', sousTitre: 'Un résumé court, avec les mots difficiles traduits' },
  saillants: { titre: 'Les 10 points importants', picto: '📌', sousTitre: 'Ce qu’il faut retenir' },
  vocabulaire: { titre: 'Le vocabulaire', picto: '🔤', sousTitre: 'Des fiches et des exercices' },
  reformulation: { titre: 'Le cours, partie par partie', picto: '📖', sousTitre: 'Reformulé plus simplement, avec des questions' },
  grammaire: { titre: 'Des phrases à la loupe', picto: '🔍', sousTitre: 'Cinq phrases difficiles, expliquées' },
  passerelle: { titre: 'Et dans mon pays ?', picto: '🌍', sousTitre: 'Le même thème, vu depuis chez moi' },
  resumeEleve: { titre: 'Mon résumé', picto: '✍️', sousTitre: 'Ce que j’ai compris, dans mes mots — puis l’avis de Claude' },
};

export type SectionStatut = 'a-faire' | 'en-cours' | 'prete' | 'erreur';

export interface UsageClaude {
  in: number;
  out: number;
  cacheRead: number;
  cacheWrite: number;
  modele: string;
}

export interface SectionLecture {
  statut: SectionStatut;
  // JSON produit par Claude (forme propre à chaque section, voir ci-dessous)
  contenu: unknown | null;
  generatedAt: string | null;
  erreur?: string | null;
  usage?: UsageClaude | null;
}

// ── Formes des contenus ──

export interface AideLexicale {
  mot: string;
  traduction: string;
}

export interface ContenuResume {
  // Dix lignes au plus ; mots difficiles suivis de « (traduction) »
  texte: string;
}

export interface ContenuSaillants {
  points: { texte: string; aides: AideLexicale[] }[];
}

export interface MotVocabulaire {
  mot: string;
  traduction: string;
  definitionSimple: string;
  exemple: string;
}

// Les exercices de l'extension Daspalecte, mêmes formes de données (2.0.x) :
// Claude produit associations, étiquettes, texte à trous, famille et lecture ;
// « écoute et associe » et « phrase avec le vocabulaire » se construisent sur
// place à partir des mêmes données.
export interface ExercicesVocabulaire {
  matching?: { pairs: { fr: string; tr: string }[] };
  tags?: { items: { sentence: string; word: string }[] };
  cloze?: { items: { text: string; answer: string }[] };
  family?: { items: { mainWord: string; related: string[] }[] };
  reading?: { text: string };
  // Le TEST DE LECTURE de l'extension : des QCM sur le cours (l'appariement
  // réutilise les paires de `matching`)
  test?: { questions: { question: string; options: string[]; correct: number }[] };
}

export interface ContenuVocabulaire {
  mots: MotVocabulaire[];
  exercices?: ExercicesVocabulaire | null;
}

// Résultat d'un exercice (clé de réponse `vocab_<type>`)
export interface ResultatExercice {
  score: number;
  total: number;
  essais: number;
  at: string;
}

export interface QuestionReformulation {
  type: 'qcm' | 'vrai-faux' | 'ouverte';
  enonce: string;
  choix?: string[];
  // Index du bon choix (qcm) ou 0 = vrai / 1 = faux (vrai-faux)
  bonne?: number;
  exempleReponse?: string;
  aide?: string;
}

export interface PartieReformulation {
  titre: string;
  texte: string;
  questions: QuestionReformulation[];
}

export interface ContenuReformulation {
  parties: PartieReformulation[];
}

export interface SegmentPhrase {
  texte: string;
  fonction: string;
  explication: string;
}

// L'arbre tel que Claude le produit : emboîté, un nœud = un groupe de mots
export interface NoeudArbre {
  label: string;
  enfants?: NoeudArbre[];
}

export interface PhraseAnalysee {
  phrase: string;
  segments: SegmentPhrase[];
  explication: string;
  // L'arbre de la phrase, converti au format du moteur de schémas
  // (`Diagram`, type hierarchy) par le serveur à la génération
  arbre?: Diagram | null;
}

export interface ContenuGrammaire {
  phrases: PhraseAnalysee[];
}

export interface ContenuPasserelle {
  intro: string;
  // Le pays ou la région que Claude a choisi comme point de vue
  pays?: string;
  paralleles: { titre: string; texte: string }[];
  question: string;
}

// ── Les corrections à la demande (bouton IA) ──

// Phrase par phrase : remarques de grammaire et de lexique, puis la même idée bien dite
export interface CorrectionPhrases {
  phrases: { phrase: string; remarques: string; reformulation: string }[];
  commentaire: string;
  at: string;
}

// L'avis sur le résumé de l'élève, comparé au cours
export interface AvisResume {
  avis: 'positif' | 'mitige' | 'negatif';
  commentaire: string;
  ideesVues: string[];
  ideesManquantes: string[];
  // Les phrases problématiques : la phrase, ce qui ne va pas, des exemples de bonne phrase
  phrases: { phrase: string; probleme: string; exemples: string[] }[];
  at: string;
}

// ── Le document ──

export interface LectureCours {
  id: string;
  eleveUid: string;
  // La fiche `eleves` de sa classe FLE, et cette classe
  eleveId: string;
  classeId: string;
  titre: string;
  source: SourceLecture;
  // Le texte extrait, borné (TEXTE_MAX)
  texte: string;
  // Copiés au moment de l'import : la langue (code) et le niveau (id CECR)
  langue: string;
  niveau: string;
  sections: Record<SectionCle, SectionLecture>;
  // Ce que l'élève a fait (réponses aux questions, résultats d'exercices)
  reponses: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// La liste (fiche prof, card élève) ne transporte pas le texte ni les sections
export interface LectureCoursResume {
  id: string;
  titre: string;
  source: SourceLecture;
  niveau: string;
  langue: string;
  sectionsPretes: number;
  createdAt: string;
}

// ≈ 5 pages de texte. Au-delà, l'élève doit choisir une partie du cours :
// c'est le sens même de la limite des 5 pages (demande JP).
export const TEXTE_MAX = 25_000;
export const PDF_PAGES_MAX = 5;
export const PDF_OCTETS_MAX = 4 * 1024 * 1024;

export function sectionsVides(): Record<SectionCle, SectionLecture> {
  const out = {} as Record<SectionCle, SectionLecture>;
  SECTIONS_ORDRE.forEach((cle) => {
    // « Mon résumé » n'a rien à générer : toujours ouverte
    out[cle] = { statut: cle === 'resumeEleve' ? 'prete' : 'a-faire', contenu: null, generatedAt: null };
  });
  return out;
}

export function libelleSource(source: SourceLecture): string {
  switch (source.type) {
    case 'gdoc':
      return 'Google Docs';
    case 'gslides':
      return 'Google Slides';
    case 'gsheet':
      return 'Google Sheets';
    case 'pdf':
      return source.pages ? `PDF · ${source.pages} page${source.pages > 1 ? 's' : ''}` : 'PDF';
    case 'web':
      return 'Page web';
    default:
      return 'Texte collé';
  }
}
