'use client';

import { useState, useCallback } from 'react';
import Toggle from '@/components/Toggle/Toggle';
import DatePicker from '@/components/DatePicker/DatePicker';
import RessourcesInput from '@/components/RessourcesInput/RessourcesInput';
import QuestionnaireBuilder from '@/components/QuestionnaireBuilder/QuestionnaireBuilder';
import QuestionnairePreviewModal from '@/components/QuestionnairePreviewModal/QuestionnairePreviewModal';
import ClassesDropdown from '@/components/ClassesDropdown/ClassesDropdown';
import PlanDraft from '@/components/DraftEditor/PlanDraft';
import VocabListEditor from '@/components/VocabListEditor/VocabListEditor';
import LectureQuizBuilder from '@/components/LectureQuizBuilder/LectureQuizBuilder';
import AutoEvalBuilder from '@/components/AutoEvalBuilder/AutoEvalBuilder';
import MessageBox from '@/components/MessageBox/MessageBox';
import { getTodayString } from '@/lib/devoir-utils';
import { createPlanItem, planHasContent } from '@/lib/draft-utils';
import { useVocabulaireThemes } from '@/hooks/useVocabulaireThemes';
import type { CreateDevoirData, Classe, DevoirRessource, TypeTravail, EvaluationType, CorrigeReference } from '@/types/devoir';
import type { LectureQuiz } from '@/types/lecture';
import type { AutoEvalQuestionnaire } from '@/types/autoevaluation';
import type { DraftContent } from '@/types/travail';
import type { NavigKidQuestion } from '@/types/navigkid';
import HideCriteriaModal from '@/components/HideCriteriaModal/HideCriteriaModal';
import HabiletesPicker from '@/components/HabiletesPicker/HabiletesPicker';
import { useOeuvres } from '@/hooks/useOeuvres';
import { ATELIERS, findAtelier, TYPES_MODAUX } from '@/types/didactique';
import type { TypeModal } from '@/types/didactique';
import styles from './CreationForm.module.css';

type FormFace = 'recto' | 'verso';

// Libellés du bloc ressources au verso, selon le type d'activité
const RESSOURCE_LABELS: Record<TypeTravail, string> = {
  ecrire: '📄 Ressource.s',
  lire: '📄 Texte à lire',
  rechercher: '📄 Documents d’appui (facultatif)',
  vocabulaire: '📄 Documents (facultatif)',
  autoevaluation: '📄 Travail à commenter (facultatif)',
};

function createEmptyPlanDraft(): DraftContent {
  return { type: 'plan', plan: [createPlanItem()] };
}

// Rythme de lecture annoncé au prof pendant qu'il règle l'activité : autant
// qu'il voie tout de suite ce qu'il demande — 20 vérifications en 40 jours,
// c'est une tous les deux jours.
function rythmeLisible(minimum: number, echeance: string): string {
  const jours = Math.max(
    1,
    Math.round((new Date(echeance).getTime() - Date.now()) / 86_400_000)
  );
  const cadence = jours / minimum;
  const arrondi = cadence >= 1 ? Math.round(cadence * 10) / 10 : null;
  return arrondi
    ? `${minimum} vérifications en ${jours} jours — une tous les ${String(arrondi).replace('.', ',')} jours.`
    : `${minimum} vérifications en ${jours} jours — plus d’une par jour.`;
}

// Valeur spéciale du menu « Série lexicale » : créer une nouvelle liste au verso
const NEW_VOCAB_LIST = '__new__';

interface CreationFormProps {
  classeNames: string[];
  grilleTypes: string[];
  // Nom + ateliers de chaque grille — filtre les grilles proposées
  grilles?: { name: string; ateliers: string[] }[];
  isVisible: boolean;
  onSubmit: (data: CreateDevoirData) => Promise<void>;
  // Enregistre l'activité (non disponible) puis ouvre la vraie page élève en aperçu
  onPreview?: (data: CreateDevoirData) => Promise<void>;
  isSubmitting: boolean;
  onClose?: () => void;
  getAuthHeaders?: () => Promise<Record<string, string> | null>;
}

export default function CreationForm({
  classeNames,
  grilleTypes,
  grilles = [],
  isVisible,
  onSubmit,
  onPreview,
  isSubmitting,
  onClose,
  getAuthHeaders,
}: CreationFormProps) {
  // Face affichée du formulaire (recto : infos de base, verso : ressources)
  const [face, setFace] = useState<FormFace>('recto');
  const [isFlipping, setIsFlipping] = useState(false);

  // Champs obligatoires
  const [selectedClasses, setSelectedClasses] = useState<Classe[]>([]);
  const [dateRemise, setDateRemise] = useState('');
  const [grille, setGrille] = useState('');
  const [intitule, setIntitule] = useState('');
  // Critères de la grille masqués pour cette activité (popup au choix de la grille)
  const [hiddenCriteria, setHiddenCriteria] = useState<string[]>([]);
  const [showHideCriteria, setShowHideCriteria] = useState(false);

  // Consignes particulières (optionnel avec checkbox)
  const [showConsignes, setShowConsignes] = useState(false);
  const [consignes, setConsignes] = useState('');

  // Verso : ressources + corrigé de référence (type ecrire)
  const [ressources, setRessources] = useState<DevoirRessource | null>(null);
  const [profTheme, setProfTheme] = useState('');
  const [profDraft, setProfDraft] = useState<DraftContent>(createEmptyPlanDraft);
  const [profProduction, setProfProduction] = useState('');

  // Toggles « corrigé IA » : quels contenus du verso sont envoyés à l'IA
  // (désactivés par défaut — l'envoi est un choix explicite du prof)
  const [ressourcesToIA, setRessourcesToIA] = useState(false);
  const [planToIA, setPlanToIA] = useState(false);
  const [productionToIA, setProductionToIA] = useState(false);

  // Type d'activité (atelier) : c'est lui qui décide du dispositif ouvert par
  // l'app. Le mode principal dit la compétence en jeu — une recherche guidée
  // est un travail de lecture menée dans un atelier de recherche.
  const [atelier, setAtelier] = useState<string>('ecriture');
  const [modePrincipal, setModePrincipal] = useState<TypeModal>('ecrire');
  const typeTravail: TypeTravail = findAtelier(atelier)?.dispositif ?? 'ecrire';

  // Habiletés travaillées : null = toutes celles de l'atelier
  const [habiletes, setHabiletes] = useState<string[] | null>(null);

  // Changer d'atelier change le dispositif : la sélection d'habiletés ne veut
  // plus rien dire, et le mode principal reprend la valeur attendue
  const changeAtelier = (id: string) => {
    setAtelier(id);
    setHabiletes(null);
    // Seule l'écriture s'évalue par grille : ailleurs, ce sont les habiletés
    // qui portent la didactique
    setGrille('');
    setHiddenCriteria([]);
    setOeuvreId('');
    setOeuvreChapitres([]);
    const a = findAtelier(id);
    if (a) setModePrincipal(a.modeParDefaut);
  };

  // Grilles proposées : celles rattachées à l'atelier choisi. Une grille sans
  // type d'activité (créée avant le champ) reste proposée partout.
  const grillesDeLAtelier = grilles.length
    ? grilles.filter((g) => !g.ateliers.length || g.ateliers.includes(atelier)).map((g) => g.name)
    : grilleTypes;

  // Évaluation : formative (entraînement) ou certificative (comptabilisée)
  const [evaluation, setEvaluation] = useState<EvaluationType>('formatif');

  // NavigKid (type rechercher)
  const [nkQuestions, setNkQuestions] = useState<NavigKidQuestion[]>([]);
  const [nkThemes, setNkThemes] = useState<string[]>([]);

  // Messages de l'outil de listes de vocabulaire (erreur 409 nom déjà pris, succès...)
  const [vocabMessage, setVocabMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  // « Nouvelle liste » choisie dans le menu Série lexicale (création en cours au verso)
  const [vocabCreatingNew, setVocabCreatingNew] = useState(false);

  // Questionnaire de lecture (type lire) — composé au verso
  const [lectureQuiz, setLectureQuiz] = useState<LectureQuiz | null>(null);

  // ── Lecture d'une œuvre ──
  // L'œuvre n'est pas recopiée dans l'activité : on y renvoie. Le minimum de
  // vérifications, croisé avec la date, donne le rythme attendu.
  const [oeuvreId, setOeuvreId] = useState<string>('');
  const [oeuvreChapitres, setOeuvreChapitres] = useState<string[]>([]);
  const [oeuvreMinimum, setOeuvreMinimum] = useState<number>(8);
  const { oeuvres, loading: oeuvresLoading } = useOeuvres(atelier === 'lecture-oeuvre');
  const oeuvreChoisie = oeuvres.find((o) => o.id === oeuvreId) || null;

  // Questionnaire d'auto-évaluation (type autoevaluation) — composé au verso
  const [autoEvalQuiz, setAutoEvalQuiz] = useState<AutoEvalQuestionnaire | null>(null);

  // Vocabulaire (type vocabulaire) — les callbacks servent à l'outil de listes
  // au verso (même outil que Mes Ressources : les listes créées ici y apparaissent)
  const {
    themes: vocabThemes,
    otherThemes: otherProfsVocabThemes,
    createTheme,
    updateWords,
    updateThemeMeta,
  } = useVocabulaireThemes();

  // Toggles (initialement à false)
  const [accesIA, setAccesIA] = useState(false);
  const [disponible, setDisponible] = useState(false);

  // Inversion recto/verso (type ecrire uniquement)
  const [flipInverted, setFlipInverted] = useState(false);
  // Auto-évaluation intégrée — activée par défaut : c'est le geste qu'on
  // veut voir posé, le prof la retire quand elle n'a pas lieu d'être.
  const [autoEvaluation, setAutoEvaluation] = useState(true);

  // Aperçu du questionnaire de recherche (popup)
  const [showQuestionnairePreview, setShowQuestionnairePreview] = useState(false);

  // Classes et date de remise sont FACULTATIVES : un prof prépare ses activités
  // avant de connaître ses classes de l'année. Sans classe, l'activité n'est
  // simplement visible d'aucun élève ; sans date, la remise n'a pas d'échéance.
  const baseValid = intitule.trim();
  // Seules les activités d'écriture s'appuient sur une grille ; lecture,
  // recherche et vocabulaire portent leur didactique dans leurs habiletés
  const usesGrille = typeTravail === 'ecrire';

  // Auto-évaluation intégrée. Sans objet sur deux dispositifs : le vocabulaire
  // n'a rien à s'auto-évaluer (tout y est automatisé), et une activité
  // d'auto-évaluation EST déjà cela — le réglage y serait absurde.
  // La lecture d'une œuvre en est exclue : le smiley d'assurance se compare à
  // un résultat, et il n'y en a aucun ici. Même raison que le vocabulaire et
  // l'activité d'auto-évaluation.
  const supporteAutoEval =
    atelier !== 'lecture-oeuvre' &&
    (typeTravail === 'ecrire' || typeTravail === 'lire' || typeTravail === 'rechercher');
  // ── Ce que porte le verso ──
  // Deux groupes : les ressources DONNÉES à l'élève, et le contenu de
  // l'activité elle-même. Les intertitres ne servent qu'à les séparer : quand
  // un seul groupe s'affiche, ils répètent le titre du verso et n'apportent
  // rien (« Ajouter des contenus » suivi de « Contenus de l'activité »).
  const aRessources = typeTravail !== 'vocabulaire' && typeTravail !== 'autoevaluation';
  const aContenus = atelier !== 'lecture-oeuvre';
  const aDeuxGroupes = aRessources && aContenus;

  const grilleValid = !usesGrille || grille;
  const isValid = baseValid && grilleValid
    && (typeTravail !== 'rechercher' || nkQuestions.some(q => q.texte.trim()))
    && (atelier !== 'lecture-oeuvre' || !!oeuvreId);

  // Liste de vocabulaire sélectionnée (type vocabulaire : intitule = id du thème).
  // La liste d'un autre prof n'est modifiable que par son auteur → lecture seule
  const selectedVocabTheme = vocabThemes.find((t) => t.id === intitule) || null;
  const vocabThemeReadOnly = selectedVocabTheme
    ? otherProfsVocabThemes.some((t) => t.id === selectedVocabTheme.id)
    : false;

  // Le verso porte-t-il du contenu ? (point orange sur l'onglet Verso)
  const versoHasContent =
    ressources !== null ||
    (typeTravail === 'ecrire' && (planHasContent(profDraft.plan) || profProduction.trim() !== '')) ||
    (typeTravail === 'rechercher' && nkQuestions.some(q => q.texte.trim())) ||
    (typeTravail === 'vocabulaire' && selectedVocabTheme !== null) ||
    (typeTravail === 'lire' && (lectureQuiz?.questions.length ?? 0) > 0) ||
    (typeTravail === 'autoevaluation' && (autoEvalQuiz?.questions.length ?? 0) > 0);

  // Bascule animée recto ↔ verso
  const flip = useCallback(() => {
    if (isFlipping) return;
    setIsFlipping(true);
    setTimeout(() => {
      setFace(f => (f === 'recto' ? 'verso' : 'recto'));
      setTimeout(() => setIsFlipping(false), 30);
    }, 280);
  }, [isFlipping]);

  const goToFace = useCallback((target: FormFace) => {
    if (face !== target) flip();
  }, [face, flip]);

  const resetForm = useCallback(() => {
    setFace('recto');
    setSelectedClasses([]);
    setDateRemise('');
    setGrille('');
    setIntitule('');
    setShowConsignes(false);
    setConsignes('');
    setRessources(null);
    setProfTheme('');
    setProfDraft(createEmptyPlanDraft());
    setProfProduction('');
    setRessourcesToIA(false);
    setPlanToIA(false);
    setProductionToIA(false);
    setAccesIA(false);
    setDisponible(false);
    setAtelier('ecriture');
    setModePrincipal('ecrire');
    setHabiletes(null);
    setEvaluation('formatif');
    setNkQuestions([]);
    setNkThemes([]);
    setFlipInverted(false);
    setVocabMessage(null);
    setVocabCreatingNew(false);
    setLectureQuiz(null);
    setAutoEvalQuiz(null);
    setOeuvreId('');
    setOeuvreChapitres([]);
    setOeuvreMinimum(8);
    setHiddenCriteria([]);
    setShowHideCriteria(false);
  }, []);

  function buildData(): CreateDevoirData {
    const data: CreateDevoirData = {
      classes: selectedClasses,
      dateRemise,
      grille,
      intitule: intitule.trim(),
      consignes: showConsignes ? consignes.trim() : '',
      ressources,
      accesIA,
      disponible,
      typeTravail,
      // Toujours transmis : « absent = activé » ne vaut que pour les activités
      // antérieures au réglage, pas pour celles qu'on crée maintenant.
      autoEvaluation: supporteAutoEval ? autoEvaluation : false,
      modePrincipal,
      atelier,
      habiletes,
      evaluation,
      ...(hiddenCriteria.length > 0 && { hiddenCriteria }),
      ...(typeTravail === 'ecrire' && { flipInverted }),
    };

    // Corrigé de référence du prof (type ecrire uniquement)
    if (typeTravail === 'ecrire') {
      const corrigeReference: CorrigeReference = {};
      if (profTheme.trim() || planHasContent(profDraft.plan)) {
        if (profTheme.trim()) corrigeReference.theme = profTheme.trim();
        if (planHasContent(profDraft.plan)) corrigeReference.plan = profDraft.plan;
        corrigeReference.planToIA = planToIA;
      }
      if (profProduction.trim()) {
        corrigeReference.production = profProduction.trim();
        corrigeReference.productionToIA = productionToIA;
      }
      if (Object.keys(corrigeReference).length > 0) {
        data.corrigeReference = corrigeReference;
      }
      data.ressourcesToIA = ressourcesToIA;
    }

    if (typeTravail === 'rechercher') {
      const questionsValides = nkQuestions.filter(q => q.texte.trim());
      data.questionnaire = {
        themes: nkThemes.join(', '),
        questions: questionsValides,
      };
    }

    if (typeTravail === 'vocabulaire') {
      data.vocabulaireConfig = {
        themes: [intitule.trim()],
      };
    }

    if (typeTravail === 'lire' && lectureQuiz && lectureQuiz.questions.length > 0) {
      data.lectureQuiz = lectureQuiz;
    }

    if (atelier === 'lecture-oeuvre') {
      // Verrouillages propres à l'atelier — le formulaire les montre, le
      // payload doit les tenir.
      data.evaluation = 'formatif';
      data.autoEvaluation = false;
    }

    if (atelier === 'lecture-oeuvre' && oeuvreId) {
      data.oeuvreId = oeuvreId;
      // Aucun chapitre coché = l'œuvre entière
      data.oeuvreChapitres = oeuvreChapitres.length ? oeuvreChapitres : null;
      data.oeuvreMinimum = oeuvreMinimum > 0 ? oeuvreMinimum : null;
    }

    if (
      typeTravail === 'autoevaluation' &&
      autoEvalQuiz &&
      autoEvalQuiz.questions.length > 0
    ) {
      data.autoEvalQuiz = autoEvalQuiz;
    }

    return data;
  }

  async function handleSubmit() {
    if (!isValid) return;
    await onSubmit(buildData());
    resetForm();
  }

  // Enregistre (non disponible pour les élèves) puis ouvre la vraie page élève
  async function handlePreview() {
    if (!isValid || !onPreview) return;
    await onPreview({ ...buildData(), disponible: false });
  }

  const ressourceLabel = RESSOURCE_LABELS[typeTravail];

  // Toggle « Corrigé IA » : état visible uniquement au survol (info-bulle)
  const renderIaToggle = (checked: boolean, onChange: (v: boolean) => void) => (
    <div
      className={styles.iaToggle}
      title={checked
        ? "Envoyé à l'IA pour le corrigé — cliquez pour désactiver"
        : "Non envoyé à l'IA — cliquez pour activer"}
    >
      <span className={styles.iaToggleLabel}>Corrigé IA</span>
      <Toggle checked={checked} onChange={onChange} disabled={isSubmitting} />
    </div>
  );

  // ── Recto : infos de base (formulaire historique sans les ressources) ──
  const renderRecto = () => (
    <>
      <div className={styles.formHeader}>
        <h2 className={styles.formTitle}>Créer une nouvelle activité</h2>
        {onClose && (
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            title="Fermer"
          >
            &times;
          </button>
        )}
      </div>

      {/* Ligne 1 : Intitulé (double largeur) + Classes + Date + Évaluation.
          En vocabulaire, l'intitulé est un menu de séries lexicales : il garde
          sa propre ligne juste en dessous. */}
      <div className={typeTravail === 'vocabulaire' ? styles.formRowThree : styles.formRowIntitule}>
        {typeTravail !== 'vocabulaire' && (
          <div className={styles.formGroup}>
            <label className={styles.label}>
              Intitulé de l’activité <span className={styles.required}>*</span>
            </label>
            <input
              className={styles.input}
              type="text"
              value={intitule}
              onChange={(e) => setIntitule(e.target.value)}
              placeholder="Ex : Dissertation sur Molière"
            />
          </div>
        )}

        <div className={styles.formGroup}>
          <label className={styles.label}>
            Classe(s) <span className={styles.optional}>— facultatif</span>
          </label>
          <ClassesDropdown
            options={classeNames}
            selected={selectedClasses}
            onChange={setSelectedClasses}
            disabled={isSubmitting}
          />
        </div>

        <div className={styles.formGroup}>
          <DatePicker
            /* « Échéance » et non « date de remise » : la date est facultative
               et ne signifie pas toujours une remise — dans la lecture d'une
               œuvre, RIEN NE SE REMET (le parcours reste ouvert, le prof suit
               la progression). Un seul mot pour tous les dispositifs. */
            label="Échéance"
            value={dateRemise}
            onChange={setDateRemise}
            min={getTodayString()}
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>
            Évaluation <span className={styles.required}>*</span>
          </label>
          {/* La lecture d'une œuvre est TOUJOURS formative — « je suis juste là
              pour les inviter à lire ». Rien n'y est noté, le choix n'a pas
              lieu d'être : on l'affiche verrouillé plutôt que de le masquer,
              pour que le prof sache à quoi s'en tenir. */}
          <select
            className={styles.select}
            value={atelier === 'lecture-oeuvre' ? 'formatif' : evaluation}
            onChange={(e) => setEvaluation(e.target.value as EvaluationType)}
            disabled={atelier === 'lecture-oeuvre'}
          >
            <option value="formatif">
              {atelier === 'lecture-oeuvre' ? 'Formative — rien n’est noté' : 'Formative (entraînement)'}
            </option>
            {atelier !== 'lecture-oeuvre' && (
              <option value="certificatif">Certificative (notée)</option>
            )}
          </select>
        </div>
      </div>

      {/* Vocabulaire : la série lexicale tient lieu d'intitulé */}
      {typeTravail === 'vocabulaire' && (
        <div className={styles.formRowIntituleVocab}>
          <div className={styles.formGroup}>
            <label className={styles.label}>
              Série lexicale <span className={styles.required}>*</span>
            </label>
            <select
              className={styles.select}
              value={vocabCreatingNew ? NEW_VOCAB_LIST : intitule}
              onChange={(e) => {
                if (e.target.value === NEW_VOCAB_LIST) {
                  // Nouvelle liste : le verso demande le titre puis les mots
                  setVocabCreatingNew(true);
                  setIntitule('');
                  goToFace('verso');
                } else {
                  setVocabCreatingNew(false);
                  setIntitule(e.target.value);
                }
              }}
              disabled={isSubmitting}
            >
              <option value="">Sélectionnez une série...</option>
              <option value={NEW_VOCAB_LIST}>➕ Nouvelle liste…</option>
              {vocabThemes.map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {theme.name.charAt(0).toUpperCase() + theme.name.slice(1)} ({theme.wordCount} mots)
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Ligne 2 : Type d'activité (+ mode principal, qui en découle) puis, à
          droite, la grille pour l'écriture — les habiletés à sa place ailleurs */}
      <div className={supporteAutoEval ? styles.formRowAutoEval : styles.formRow}>
        <div className={styles.formGroup}>
          <label className={styles.label}>
            Type d&apos;activité <span className={styles.required}>*</span>
          </label>
          <select
            className={styles.select}
            value={atelier}
            onChange={(e) => changeAtelier(e.target.value)}
          >
            {ATELIERS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
          {/* Le mode principal découle du type d'activité — chercher, c'est lire */}
          <p className={styles.modeNote}>
            Mode principal : {TYPES_MODAUX.find((t) => t.id === modePrincipal)?.court}
          </p>
        </div>

        {usesGrille && (
          <div className={styles.formGroup}>
            <label className={styles.label}>
              Type de grille <span className={styles.required}>*</span>
            </label>
            <select
              className={styles.select}
              value={grille}
              onChange={(e) => {
                setGrille(e.target.value);
                setHiddenCriteria([]);
                // Choix d'une grille → proposer de masquer certains critères
                if (e.target.value) setShowHideCriteria(true);
              }}
            >
              <option value="">Sélectionnez...</option>
              {grillesDeLAtelier.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            {grille && (
              <button
                type="button"
                className={styles.hiddenCriteriaNote}
                onClick={() => setShowHideCriteria(true)}
              >
                {hiddenCriteria.length > 0
                  ? `🙈 ${hiddenCriteria.length} critère${hiddenCriteria.length > 1 ? 's' : ''} masqué${hiddenCriteria.length > 1 ? 's' : ''} — modifier`
                  : 'Masquer certains critères...'}
              </button>
            )}
          </div>
        )}

        {!usesGrille && (
          <div className={styles.formGroup}>
            <label className={styles.label}>Habiletés travaillées</label>
            <HabiletesPicker
              atelier={atelier}
              modePrincipal={modePrincipal}
              value={habiletes}
              onChange={setHabiletes}
              disabled={isSubmitting}
            />
          </div>
        )}

        {atelier === 'lecture-oeuvre' && (
          <>
            <div className={styles.formGroup}>
              <label className={styles.label}>
                Œuvre à lire <span className={styles.required}>*</span>
              </label>
              <select
                className={styles.select}
                value={oeuvreId}
                onChange={(e) => {
                  setOeuvreId(e.target.value);
                  setOeuvreChapitres([]);
                }}
                disabled={isSubmitting || oeuvresLoading}
              >
                <option value="">
                  {oeuvresLoading ? 'Chargement…' : 'Sélectionnez une œuvre...'}
                </option>
                {oeuvres.map((o) => (
                  <option key={o.id} value={o.id}>
                    {/* L'auteur n'est répété que s'il ne figure pas déjà dans
                        le titre — « Molière — Anthologie comique — Molière »
                        ne renseigne personne. */}
                    {o.titre}
                    {o.auteur && !o.titre.toLowerCase().includes(o.auteur.toLowerCase())
                      ? ` — ${o.auteur}`
                      : ''}
                  </option>
                ))}
              </select>
              {!oeuvresLoading && oeuvres.length === 0 && (
                <p className={styles.modeNote}>
                  Aucune œuvre dans la bibliothèque — elles se créent dans Mes Ressources.
                </p>
              )}
            </div>

            {oeuvreChoisie && oeuvreChoisie.chapitres.length > 0 && (
              <div className={styles.formGroup}>
                <label className={styles.label}>Chapitres donnés à lire</label>
                <div className={styles.chapitresListe}>
                  {oeuvreChoisie.chapitres.map((c) => (
                    <label key={c.id} className={styles.chapitreItem}>
                      <input
                        type="checkbox"
                        checked={oeuvreChapitres.includes(c.id)}
                        onChange={(e) =>
                          setOeuvreChapitres((prev) =>
                            e.target.checked ? [...prev, c.id] : prev.filter((x) => x !== c.id)
                          )
                        }
                        disabled={isSubmitting}
                      />
                      <span>
                        {c.titre}
                        <span className={styles.chapitreCompte}>
                          {c.sections.length} section{c.sections.length > 1 ? 's' : ''}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                <p className={styles.modeNote}>
                  Aucun chapitre coché : l’œuvre entière.
                </p>
              </div>
            )}

            <div className={styles.formGroup}>
              <label className={styles.label}>Vérifications de lecture à compléter</label>
              <input
                type="number"
                min={0}
                className={styles.select}
                value={oeuvreMinimum}
                onChange={(e) => setOeuvreMinimum(Number(e.target.value))}
                disabled={isSubmitting}
              />
              {/* Le rythme se déduit de l'échéance : c'est lui qui déclenchera
                  la notification si l'élève prend du retard. */}
              <p className={styles.modeNote}>
                {oeuvreMinimum > 0 && dateRemise
                  ? rythmeLisible(oeuvreMinimum, dateRemise)
                  : oeuvreMinimum > 0
                    ? 'Sans date, aucun rythme n’est attendu : l’élève lit à son gré.'
                    : 'Aucune vérification imposée : l’élève lit ce qu’il veut.'}
              </p>
            </div>
          </>
        )}

        {supporteAutoEval && (
          <div className={styles.formGroup}>
            <label className={styles.label}>Auto-évaluation</label>
            {/* L'explication vit dans l'infobulle : la ligne porte déjà deux
                sélecteurs, une phrase de plus l'alourdirait pour rien. */}
            <label
              className={styles.autoEvalToggle}
              title={
                autoEvaluation
                  ? usesGrille
                    ? 'L’élève s’évalue sur la grille avant la correction.'
                    : 'L’élève pose un smiley d’assurance sous chaque réponse.'
                  : 'L’élève ne se prononce pas sur son travail.'
              }
            >
              <input
                type="checkbox"
                checked={autoEvaluation}
                onChange={(e) => setAutoEvaluation(e.target.checked)}
                disabled={isSubmitting}
              />
              <span className={styles.autoEvalSwitch} />
              <span className={styles.autoEvalText}>
                {autoEvaluation ? 'Activée' : 'Désactivée'}
              </span>
            </label>
          </div>
        )}
      </div>

      {/* Recto / Verso de l'espace élève (uniquement pour type ecrire) */}
      {typeTravail === 'ecrire' && (
        <div className={styles.flipChoice}>
          <span className={styles.flipChoiceLabel}>Espace d’écriture</span>
          <div className={styles.flipChoiceRow}>
            <div className={styles.flipChoiceFace}>
              <span className={styles.flipChoiceTag}>Recto</span>
              <span className={styles.flipChoiceContent}>
                {flipInverted ? '📝 Espace de planification' : '✏️ Espace de rédaction'}
              </span>
            </div>
            <button
              type="button"
              className={styles.flipChoiceSwap}
              onClick={() => setFlipInverted((v) => !v)}
              title="Inverser recto et verso"
              aria-label="Inverser recto et verso"
            >
              ⇄
            </button>
            <div className={styles.flipChoiceFace}>
              <span className={styles.flipChoiceTag}>Verso</span>
              <span className={styles.flipChoiceContent}>
                {flipInverted ? '✏️ Espace de rédaction' : '📝 Espace de planification'}
              </span>
            </div>
          </div>
          <p className={styles.flipChoiceHint}>
            Le recto est la face affichée à l’ouverture de l’activité par l’élève.
          </p>
        </div>
      )}
      {/* Consignes particulières (optionnel avec checkbox) */}
      <div className={styles.optionalSection}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={showConsignes}
            onChange={(e) => setShowConsignes(e.target.checked)}
            className={styles.checkbox}
          />
          <span>Ajouter des consignes particulières</span>
        </label>
        {showConsignes && (
          <textarea
            className={styles.textarea}
            value={consignes}
            onChange={(e) => setConsignes(e.target.value)}
            placeholder="Instructions détaillées pour les élèves..."
            rows={4}
          />
        )}
      </div>

      {/* Toggles */}
      <div className={styles.toggleSection}>
        <div className={styles.toggleGroup}>
          <Toggle
            checked={accesIA}
            onChange={setAccesIA}
            labelOn="Accès IA activé"
            labelOff="Accès IA désactivé"
            disabled={isSubmitting}
          />
          <p className={styles.toggleHint}>
            Permet aux élèves d&apos;utiliser l&apos;assistant IA pour cette activité
          </p>
        </div>

        <div className={styles.toggleGroup}>
          <Toggle
            checked={disponible}
            onChange={setDisponible}
            labelOn="Disponible"
            labelOff="Non disponible"
            disabled={isSubmitting}
          />
          <p className={styles.toggleHint}>
            Rend l&apos;activité visible et accessible aux élèves
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className={styles.formActions}>
        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={handleSubmit}
          disabled={isSubmitting || !isValid}
        >
          {isSubmitting ? 'Création en cours...' : 'Créer l’activité'}
        </button>
        <button
          className={`${styles.btn} ${styles.btnSecondary}`}
          onClick={resetForm}
          type="button"
          disabled={isSubmitting}
        >
          Réinitialiser
        </button>
      </div>
    </>
  );

  // ── Verso : ressources pédagogiques, variable selon le type d'activité ──
  const renderVerso = () => (
    <>
      <div className={styles.formHeader}>
        <h2 className={styles.formTitle}>Ajouter des contenus</h2>
        <span className={styles.versoContext}>
          {typeTravail === 'ecrire' && `Écrire${grille ? ` · ${grille}` : ''}`}
          {typeTravail === 'lire' && 'Lire'}
          {typeTravail === 'rechercher' && 'Rechercher'}
          {typeTravail === 'vocabulaire' && 'Vocabulaire'}
          {typeTravail === 'autoevaluation' && 'Auto-évaluation'}
        </span>
      </div>

      {aRessources && (
        <>
          {/* Les intertitres n'existent que pour SÉPARER les deux groupes.
              Quand un seul est affiché, ils répètent le titre du verso — d'où
              le `aDeuxGroupes`. */}
          {aDeuxGroupes && (
            <div className={styles.versoGroup}>
              <h4 className={styles.versoGroupTitle}>Ressources pour l’élève</h4>
              <p className={styles.versoGroupHint}>
                Visibles par l’élève dans l’onglet «&nbsp;Ressources&nbsp;» de sa colonne de droite.
              </p>
            </div>
          )}
          <div className={styles.versoSection}>
            <div className={styles.versoSectionHeader}>
              <h3 className={styles.versoSectionTitle}>{ressourceLabel}</h3>
              {typeTravail === 'ecrire' && renderIaToggle(ressourcesToIA, setRessourcesToIA)}
            </div>
            <RessourcesInput
              ressources={ressources}
              onRessourcesChange={setRessources}
              disabled={isSubmitting}
            />
          </div>
        </>
      )}

      {aContenus && aDeuxGroupes && (
      <div className={styles.versoGroup}>
        <h4 className={styles.versoGroupTitle}>
          Contenus de l’activité
          <span
            className={styles.versoGroupInfo}
            title={
              typeTravail === 'ecrire'
                ? 'Corrigé de référence : transmis à l’IA selon les interrupteurs « Corrigé IA » ; seule la production est montrée à l’élève, quand le corrigé est disponible.'
                : typeTravail === 'lire'
                  ? 'Le questionnaire de lecture : rempli par l’élève dans sa colonne de gauche. QCM corrigés automatiquement, le reste par vous. Les compétences cochées alimenteront le profil de lecteur.'
                  : typeTravail === 'rechercher'
                    ? 'Le questionnaire est utilisé par l’extension NavigKid — il n’apparaît pas dans les ressources de l’élève.'
                    : typeTravail === 'autoevaluation'
                      ? 'Le questionnaire d’auto-évaluation : l’élève y dit où il en est. Rien n’est noté — les gestes cochés alimentent l’onglet réflexif de son profil.'
                      : 'La liste sert de support à l’activité (apprentissage et évaluation). Elle est aussi enregistrée dans Mes Ressources.'
            }
          >
            i
          </span>
        </h4>
      </div>
      )}

      {/* Questionnaire d'auto-évaluation (type autoevaluation) */}
      {typeTravail === 'autoevaluation' && (
        <AutoEvalBuilder
          quiz={autoEvalQuiz}
          onChange={setAutoEvalQuiz}
          disabled={isSubmitting}
          allowedHabiletes={habiletes}
        />
      )}

      {/* Questionnaire de lecture (type lire) — sauf lecture d'une œuvre, dont
          les vérifications se construisent section par section dans l'œuvre */}
      {typeTravail === 'lire' && atelier !== 'lecture-oeuvre' && (
        <LectureQuizBuilder
          value={lectureQuiz}
          onChange={setLectureQuiz}
          disabled={isSubmitting}
          getAuthHeaders={getAuthHeaders}
          allowedHabiletes={habiletes}
        />
      )}

      {/* Corrigé de référence (type ecrire uniquement) */}
      {typeTravail === 'ecrire' && (
        <>
          <div className={styles.versoSection}>
            <div className={styles.versoSectionHeader}>
              <h3 className={styles.versoSectionTitle}>🗂️ Espace de planification</h3>
              {renderIaToggle(planToIA, setPlanToIA)}
            </div>
            <div className={styles.themeRow}>
              <label className={styles.themeLabel}>Thème ou thèse :</label>
              <input
                className={styles.input}
                type="text"
                value={profTheme}
                onChange={(e) => setProfTheme(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <PlanDraft
              draft={profDraft}
              onChange={setProfDraft}
              disabled={isSubmitting}
              hideHeader
            />
          </div>

          <div className={styles.versoSection}>
            <div className={styles.versoSectionHeader}>
              <h3 className={styles.versoSectionTitle}>✒️ Production du professeur</h3>
              {renderIaToggle(productionToIA, setProductionToIA)}
            </div>
            <textarea
              className={styles.textarea}
              value={profProduction}
              onChange={(e) => setProfProduction(e.target.value)}
              placeholder="Rédigez ici votre version de référence..."
              rows={6}
              disabled={isSubmitting}
            />
          </div>
        </>
      )}

      {/* Questionnaire NavigKid (type rechercher) */}
      {typeTravail === 'rechercher' && (
        <div className={styles.versoSection}>
          <QuestionnaireBuilder
            questions={nkQuestions}
            onQuestionsChange={setNkQuestions}
            themes={nkThemes}
            onThemesChange={setNkThemes}
            titre={intitule}
            disabled={isSubmitting}
            getAuthHeaders={getAuthHeaders}
            allowedHabiletes={habiletes}
          />
        </div>
      )}

      {/* Type vocabulaire : outil de listes de vocabulaire (même outil que
          Mes Ressources — la liste créée ici apparaît aussi là-bas) */}
      {typeTravail === 'vocabulaire' && (
        vocabCreatingNew || selectedVocabTheme ? (
          <>
            <MessageBox
              message={vocabMessage?.text || null}
              type={vocabMessage?.type || 'success'}
              onDismiss={() => setVocabMessage(null)}
            />
            <VocabListEditor
              mode={selectedVocabTheme ?? 'create'}
              readOnly={vocabThemeReadOnly}
              createTheme={createTheme}
              updateWords={updateWords}
              updateThemeMeta={updateThemeMeta}
              getAuthHeaders={getAuthHeaders}
              onCreated={(theme) => {
                setIntitule(theme.id);
                setVocabCreatingNew(false);
              }}
              onMessage={(text, type) => setVocabMessage({ text, type })}
            />
          </>
        ) : (
          <div className={styles.versoEmpty}>
            Choisissez une série lexicale au recto — ou «&nbsp;➕ Nouvelle liste…&nbsp;» pour en créer une ici.
          </div>
        )
      )}

      {/* Prévisualisation. Sur une activité de recherche, la page élève est
          voilée tant que rien n'a été envoyé : on montre le questionnaire dans
          une popup, tel que l'élève le lira dans l'extension. */}
      {typeTravail === 'rechercher' ? (
        <div className={styles.previewBar}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnAccent}`}
            onClick={() => setShowQuestionnairePreview(true)}
            disabled={isSubmitting || nkQuestions.length === 0}
          >
            👁 Aperçu du questionnaire
          </button>
          {/* Le questionnaire s'écrit au verso : on doit pouvoir créer
              l'activité d'ici, sans retourner au recto pour un seul clic. */}
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={handleSubmit}
            disabled={isSubmitting || !isValid}
          >
            {isSubmitting ? 'Création en cours...' : 'Créer l’activité'}
          </button>
          <span className={styles.previewNote}>
            Le questionnaire tel que l’élève le lira dans le panneau NavigKid!.
          </span>
        </div>
      ) : (
        onPreview && (
          <div className={styles.previewBar}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnAccent}`}
              onClick={handlePreview}
              disabled={isSubmitting || !isValid}
            >
              👁 Prévisualiser l’espace élève
            </button>
            <span className={styles.previewNote}>
              Enregistre l’activité (non disponible pour les élèves) puis ouvre la vraie page élève.
            </span>
          </div>
        )
      )}

      {showQuestionnairePreview && (
        <QuestionnairePreviewModal
          titre={intitule}
          consignes={consignes}
          questions={nkQuestions}
          onClose={() => setShowQuestionnairePreview(false)}
        />
      )}
    </>
  );

  return (
    <div className={`${styles.form} ${isVisible ? styles.formVisible : ''}`}>
      {/* Barre de bascule recto/verso */}
      <div className={styles.flipBar}>
        <div className={styles.flipToggle}>
          <button
            type="button"
            className={`${styles.flipToggleButton} ${face === 'recto' ? styles.flipToggleActive : ''}`}
            onClick={() => goToFace('recto')}
          >
            📋 Description de l’activité
          </button>
          <button
            type="button"
            className={`${styles.flipToggleButton} ${face === 'verso' ? styles.flipToggleActive : ''}`}
            onClick={() => goToFace('verso')}
          >
            📚 Ajout de contenus
            {versoHasContent && <span className={styles.flipToggleDot} />}
          </button>
        </div>
        <button
          type="button"
          className={styles.flipTurnButton}
          onClick={flip}
          disabled={isSubmitting}
        >
          <span className={styles.flipTurnIcon}>⟳</span> Retourner
        </button>
      </div>

      {/* Carte animée */}
      <div className={`${styles.flipCard} ${isFlipping ? styles.flipCardOut : ''} ${face === 'verso' ? styles.flipCardVerso : ''}`}>
        {face === 'recto' ? renderRecto() : renderVerso()}
      </div>

      {showHideCriteria && grille && (
        <HideCriteriaModal
          grilleName={grille}
          initialHidden={hiddenCriteria}
          getAuthHeaders={getAuthHeaders}
          onConfirm={(ids) => {
            setHiddenCriteria(ids);
            setShowHideCriteria(false);
          }}
          onClose={() => setShowHideCriteria(false)}
        />
      )}
    </div>
  );
}
