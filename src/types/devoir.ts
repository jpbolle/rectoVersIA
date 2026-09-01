import type { PlanItem } from './travail';
import type { LectureQuiz, LectureResume } from './lecture';
import type { AutoEvalQuestionnaire } from './autoevaluation';
import type { TypeModal } from './didactique';

export type Classe = string;
// Le DISPOSITIF d'une activité : la machinerie que l'app sait afficher.
// « autoevaluation » depuis le 2026-08-14 — l'élève se prononce sur son
// propre travail (cf. src/types/autoevaluation.ts).
export type TypeTravail = 'ecrire' | 'lire' | 'rechercher' | 'vocabulaire' | 'autoevaluation';
// formatif : entraînement, ne compte pas — certificatif : compte pour la note
export type EvaluationType = 'formatif' | 'certificatif';

// Corrigé de référence du prof (types écrire uniquement) :
// plan hiérarchisé + production rédigée. Transmis à l'IA lors de l'évaluation ;
// la production est montrée à l'élève quand la correction est disponible.
export interface CorrigeReference {
  theme?: string;           // thème ou thèse du texte attendu (au-dessus du plan)
  plan?: PlanItem[];
  production?: string;
  planToIA?: boolean;       // envoyer le plan (+ thème) à l'IA
  productionToIA?: boolean; // envoyer la production à l'IA
}

// Image déposée sur le serveur (onglet Image des ressources) —
// stockée dans public/uploads/ressources/, servie statiquement
export interface RessourceFile {
  name: string;         // nom d'origine (affiché)
  url: string;          // chemin public (/uploads/ressources/...)
  fileId?: string;      // nom de fichier stocké (pour la suppression)
  mimeType?: string;
}

/**
 * Un contenu interactif joint aux ressources (onglet Interactif).
 *
 * DEUX natures, et la distinction n'est pas cosmétique :
 *  · `url`  — une page tierce (Genially, frise, exerciseur) sur un domaine de
 *    la LISTE BLANCHE (`src/lib/integration.ts`), vérifiée côté serveur ;
 *  · `code` — une animation HTML/CSS/JS écrite par le professeur, exécutée en
 *    BAC À SABLE FERMÉ (`srcdoc` + `sandbox="allow-scripts"`, sans
 *    `allow-same-origin`). Réservée à l'administrateur : c'est du code qui
 *    s'exécute dans une page ouverte par des mineurs.
 */
export interface RessourceInteractif {
  id: string;
  kind: 'url' | 'code';
  url?: string;
  code?: string;
  legende?: string;
  /** Hauteur du cadre en pixels — défaut 520 */
  hauteur?: number;
  /** Plafond de largeur en pixels (jamais une largeur imposée) */
  largeur?: number;
  /** Proportions d'origine conservées (largeur/hauteur du code collé) */
  proportions?: boolean;
  ratio?: number;
}

export interface DevoirRessource {
  type: 'text';
  content: string;
  outils?: string;      // HTML avec liens cliquables (onglet Lien)
  document?: string;    // Rich HTML content from Tiptap editor (onglet Texte)
  files?: RessourceFile[]; // Fichiers Drive (onglet Fichier)
  videos?: string[];    // URLs YouTube (onglet Vidéo) — lecteur intégré côté élève
  interactifs?: RessourceInteractif[]; // Contenus embarqués (onglet Interactif)
}

export interface Devoir {
  id: string;
  classes: Classe[];  // Plusieurs classes possibles
  dateRemise: string;
  grille: string;
  intitule: string;
  consignes: string;
  ressources: DevoirRessource | null;
  accesIA: boolean;
  disponible: boolean;
  archive: boolean;
  corrige: boolean;
  corrigeDisponible: boolean;
  createdAt: string;
  anneeScolaire: string;
  profId: string;
  // Dispositif : quelle machinerie l'app ouvre (éditeur, questionnaire,
  // NavigKid, vocabulaire). Déduit de l'atelier choisi — conservé tel quel pour
  // ne rien casser des activités existantes.
  typeTravail: TypeTravail;
  // Mode principal : quelle compétence est en jeu (lire, écrire, parler…).
  // Découplé du dispositif : une recherche guidée est un travail de LECTURE
  // menée dans un ATELIER de recherche. Absent sur les activités antérieures.
  modePrincipal?: TypeModal;
  // Type d'activité : l'atelier (ids de ATELIERS dans types/didactique)
  atelier?: string;
  // Habiletés travaillées dans CETTE activité. Absent ou null = toutes celles
  // rattachées à l'atelier (cas par défaut) ; un tableau = sélection du prof.
  habiletes?: string[] | null;
  evaluation?: EvaluationType;    // absent sur les devoirs antérieurs au champ
  hiddenCriteria?: string[];      // ids de critères de la grille masqués pour CE devoir
  uaa?: number[];                 // UAA de la grille liée (enrichi côté serveur, lecture seule)
  questionnaireId?: string;       // Référence vers questionnaires/{id} (type rechercher)
  codeAcces?: string;             // Code 6 chars pour l'extension Chrome (type rechercher)
  vocabulaireThemes?: string[];   // Séries lexicales imposées (type vocabulaire)
  vocabulaireDiagnostic?: boolean; // Mode diagnostic activé (type vocabulaire)
  // Inverse recto/verso de la colonne 1 (type ecrire uniquement)
  // false (defaut) : recto = espace de redaction, verso = espace de planification
  // true           : recto = espace de planification, verso = espace de redaction
  flipInverted?: boolean;
  // Corrigé de référence du prof (type ecrire) — côté élève, seul `production`
  // est exposé, et uniquement quand corrigeDisponible est vrai
  corrigeReference?: CorrigeReference | null;
  // Envoyer les ressources à l'IA pour le corrigé (défaut true) — seuls le
  // texte (onglet Texte) et les images sont transmis, jamais les PDF ni les liens
  ressourcesToIA?: boolean;
  // Nombre de copies remises (enrichi côté serveur, liste prof uniquement)
  submittedCount?: number;
  // Questionnaire de lecture (type lire) — côté élève, correctIndex est filtré
  lectureQuiz?: LectureQuiz | null;
  // ─── Lecture d'une œuvre (atelier `lecture-oeuvre`) ───
  // L'œuvre n'est PAS copiée dans l'activité : elle vit dans la bibliothèque
  // (collection `oeuvres`) et l'activité y renvoie. Corriger une coquille dans
  // l'œuvre profite du coup à toutes les classes qui l'ont reçue.
  oeuvreId?: string | null;
  // Chapitres donnés à lire — vide ou absent = l'œuvre entière. C'est ce qui
  // permet de donner les deux premiers actes à une classe et tout à une autre.
  oeuvreChapitres?: string[] | null;
  // Nombre de vérifications de lecture à compléter. L'élève CHOISIT lesquelles :
  // il n'est pas tenu de tout lire. Avec `dateRemise` (lue ici comme une
  // ÉCHÉANCE de lecture, puisque rien ne se remet), il donne le rythme attendu
  // — voir calculerRythme() dans src/types/oeuvre.ts.
  oeuvreMinimum?: number | null;
  // Récapitulatif de remise (justes / erreurs / à corriger) — ENRICHI À LA
  // LECTURE par /api/devoirs/[id], jamais stocké. Servi au seul élève, entre sa
  // remise et la correction du prof : c'est le calcul que son navigateur ne
  // peut pas faire, faute d'avoir les bonnes réponses.
  lectureResume?: LectureResume | null;
  // Renvoi vers la BIBLIOTHÈQUE de questionnaires (Mes Ressources). Quand il
  // est posé, c'est ce questionnaire-là qui sert — celui que porte encore
  // l'activité ne reste qu'en filet. Voir `quizDuDevoir`.
  lectureQuizId?: string | null;
  // Questionnaire d'auto-évaluation (type autoevaluation). Rien n'y est filtré
  // pour l'élève : il n'y a ni bonne réponse ni corrigé à protéger.
  autoEvalQuiz?: AutoEvalQuestionnaire | null;
  // AUTO-ÉVALUATION INTÉGRÉE — l'élève se prononce sur son propre travail
  // avant d'en connaître la note. Ce qu'elle recouvre dépend du dispositif :
  //  - écriture  : il s'auto-évalue sur la grille ;
  //  - lecture et recherche : il pose un smiley d'assurance sous chaque réponse.
  // L'écart avec la correction nourrit son onglet « Me connaître ».
  // ABSENT = ACTIVÉ : les activités antérieures gardent le comportement
  // qu'elles avaient, où l'auto-évaluation a toujours existé.
  autoEvaluation?: boolean;
  // Passerelle en retour vers la scénarisation didactique : posée par
  // /api/scenarisations/[id] quand l'activité est rattachée à un module,
  // effacée quand le lien est rompu. Jamais écrite depuis les formulaires.
  scenarisationRef?: { scenarisationId: string; nom: string } | null;
}

export interface CreateDevoirData {
  classes: Classe[];  // Plusieurs classes possibles
  dateRemise: string;
  grille: string;
  intitule: string;
  consignes: string;
  ressources: DevoirRessource | null;
  accesIA: boolean;
  disponible: boolean;
  typeTravail: TypeTravail;
  modePrincipal?: TypeModal;      // compétence en jeu (didactique)
  atelier?: string;               // type d'activité — id de ATELIERS
  habiletes?: string[] | null;    // null = toutes celles de l'atelier
  evaluation?: EvaluationType;
  hiddenCriteria?: string[];      // ids de critères masqués pour ce devoir
  // NavigKid (type rechercher uniquement)
  questionnaire?: {
    themes: string;
    questions: import('./navigkid').NavigKidQuestion[];
  };
  // Vocabulaire (type vocabulaire uniquement)
  vocabulaireConfig?: {
    themes: string[];
    diagnostic?: boolean;
  };
  // Inversion recto/verso (type ecrire uniquement)
  flipInverted?: boolean;
  // Corrigé de référence du prof (type ecrire uniquement)
  corrigeReference?: CorrigeReference | null;
  // Envoyer les ressources à l'IA (type ecrire uniquement)
  ressourcesToIA?: boolean;
  // Questionnaire de lecture (type lire uniquement) — l'un OU l'autre :
  // une référence à la bibliothèque, ou un contenu écrit pour cette activité
  // (que le serveur versera ensuite dans la bibliothèque).
  lectureQuizId?: string | null;
  lectureQuiz?: LectureQuiz | null;
  // Questionnaire d'auto-évaluation (type autoevaluation uniquement)
  autoEvalQuiz?: AutoEvalQuestionnaire | null;
  // Lecture d'une œuvre (atelier lecture-oeuvre uniquement)
  oeuvreId?: string | null;
  oeuvreChapitres?: string[] | null;
  oeuvreMinimum?: number | null;
  // AUTO-ÉVALUATION INTÉGRÉE — l'élève se prononce sur son propre travail
  // avant d'en connaître la note. Ce qu'elle recouvre dépend du dispositif :
  //  - écriture  : il s'auto-évalue sur la grille ;
  //  - lecture et recherche : il pose un smiley d'assurance sous chaque réponse.
  // L'écart avec la correction nourrit son onglet « Me connaître ».
  // ABSENT = ACTIVÉ : les activités antérieures gardent le comportement
  // qu'elles avaient, où l'auto-évaluation a toujours existé.
  autoEvaluation?: boolean;
}
