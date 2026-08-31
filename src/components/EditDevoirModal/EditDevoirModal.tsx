'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Toggle from '@/components/Toggle/Toggle';
import DatePicker from '@/components/DatePicker/DatePicker';
import RessourcesInput from '@/components/RessourcesInput/RessourcesInput';
import QuestionnaireBuilder from '@/components/QuestionnaireBuilder/QuestionnaireBuilder';
import QuestionnairePreviewModal from '@/components/QuestionnairePreviewModal/QuestionnairePreviewModal';
import ClassesDropdown from '@/components/ClassesDropdown/ClassesDropdown';
import PlanDraft from '@/components/DraftEditor/PlanDraft';
import LectureQuizBuilder from '@/components/LectureQuizBuilder/LectureQuizBuilder';
import AutoEvalBuilder from '@/components/AutoEvalBuilder/AutoEvalBuilder';
import { getTodayString } from '@/lib/devoir-utils';
import { createPlanItem, planHasContent } from '@/lib/draft-utils';
import type { Devoir, Classe, DevoirRessource, EvaluationType, TypeTravail, CorrigeReference } from '@/types/devoir';
import type { LectureQuiz } from '@/types/lecture';
import type { AutoEvalQuestionnaire } from '@/types/autoevaluation';
import type { DraftContent } from '@/types/travail';
import type { NavigKidQuestion } from '@/types/navigkid';
import HideCriteriaModal from '@/components/HideCriteriaModal/HideCriteriaModal';
import HabiletesPicker from '@/components/HabiletesPicker/HabiletesPicker';
import { atelierParDispositif, findAtelier, TYPES_MODAUX } from '@/types/didactique';
import type { TypeModal } from '@/types/didactique';
import styles from './EditDevoirModal.module.css';
import FlipChoice from '@/components/FlipChoice/FlipChoice';

type FormFace = 'recto' | 'verso';

// Libellés du bloc ressources au verso, selon le type d'activité
const RESSOURCE_LABELS: Record<TypeTravail, string> = {
  ecrire: '📄 Ressource.s',
  lire: '📄 Documents à utiliser',
  rechercher: '📄 Documents d’appui (facultatif)',
  vocabulaire: '📄 Documents (facultatif)',
  autoevaluation: '📄 Travail à commenter (facultatif)',
};

const TYPE_LABELS: Record<TypeTravail, string> = {
  ecrire: 'Écrire',
  lire: 'Lire',
  rechercher: 'Rechercher',
  vocabulaire: 'Vocabulaire',
  autoevaluation: 'Auto-évaluation',
};

function createEmptyPlanDraft(): DraftContent {
  return { type: 'plan', plan: [createPlanItem()] };
}

interface EditDevoirModalProps {
  devoir: Devoir | null;
  classeNames: string[];
  grilleTypes: string[];
  // Nom + ateliers de chaque grille — filtre les grilles proposées
  grilles?: { name: string; ateliers: string[] }[];
  isOpen: boolean;
  onClose: () => void;
  /**
   * Enregistre et dit si ça a marché — la popup en a besoin pour savoir si
   * elle peut se fermer. `silencieux` : enregistrement automatique, pas de
   * message de confirmation (il s'afficherait derrière la fenêtre).
   */
  onSave: (id: string, data: Partial<Devoir>, silencieux?: boolean) => Promise<boolean>;
  isSaving: boolean;
  getAuthHeaders: () => Promise<Record<string, string> | null>;
}

export default function EditDevoirModal({
  devoir,
  classeNames,
  grilleTypes,
  grilles = [],
  isOpen,
  onClose,
  onSave,
  isSaving,
  getAuthHeaders,
}: EditDevoirModalProps) {
  // Face affichée (recto : description, verso : ressources)
  const [face, setFace] = useState<FormFace>('recto');
  const [isFlipping, setIsFlipping] = useState(false);

  const [selectedClasses, setSelectedClasses] = useState<Classe[]>([]);
  const [dateRemise, setDateRemise] = useState('');
  // Aperçu du questionnaire de recherche (popup)
  const [showQuestionnairePreview, setShowQuestionnairePreview] = useState(false);
  const [grille, setGrille] = useState('');
  const [intitule, setIntitule] = useState('');
  // Critères de la grille masqués pour cette activité (popup au choix de la grille)
  const [hiddenCriteria, setHiddenCriteria] = useState<string[]>([]);
  const [showHideCriteria, setShowHideCriteria] = useState(false);
  const [consignes, setConsignes] = useState('');
  const [accesIA, setAccesIA] = useState(false);
  const [disponible, setDisponible] = useState(false);
  const [flipInverted, setFlipInverted] = useState(false);
  // Auto-évaluation intégrée — absent = activé (activités antérieures)
  const [autoEvaluation, setAutoEvaluation] = useState(true);
  const [evaluation, setEvaluation] = useState<EvaluationType>('formatif');
  // Didactique : le mode principal et les habiletés se modifient ; l'atelier
  // non — il commande le dispositif, le changer transformerait l'activité
  const [modePrincipal, setModePrincipal] = useState<TypeModal>('ecrire');
  const [habiletes, setHabiletes] = useState<string[] | null>(null);

  // Verso : ressources + corrigé de référence (type ecrire)
  const [ressources, setRessources] = useState<DevoirRessource | null>(null);
  const [profTheme, setProfTheme] = useState('');
  const [profDraft, setProfDraft] = useState<DraftContent>(createEmptyPlanDraft);
  const [profProduction, setProfProduction] = useState('');

  // Toggles « corrigé IA » : quels contenus du verso sont envoyés à l'IA
  const [ressourcesToIA, setRessourcesToIA] = useState(false);
  const [planToIA, setPlanToIA] = useState(false);
  const [productionToIA, setProductionToIA] = useState(false);

  // Questionnaire (type rechercher)
  const [nkQuestions, setNkQuestions] = useState<NavigKidQuestion[]>([]);
  const [nkThemes, setNkThemes] = useState<string[]>([]);

  // Questionnaire de lecture (type lire)
  const [lectureQuiz, setLectureQuiz] = useState<LectureQuiz | null>(null);

  // Questionnaire d'auto-évaluation (type autoevaluation)
  const [autoEvalQuiz, setAutoEvalQuiz] = useState<AutoEvalQuestionnaire | null>(null);

  // `devoir` est un objet INSTABLE (recréé à chaque rendu du parent) : le mettre
  // dans les dépendances rejouait cet effet en cours de saisie et écrasait le
  // formulaire par les valeurs enregistrées — les habiletés cochées
  // disparaissaient au moindre repli/dépli. On ne réinitialise donc que quand
  // l'activité change vraiment d'identité, ou quand la modale se rouvre.
  const devoirRef = useRef(devoir);
  devoirRef.current = devoir;

  useEffect(() => {
    const devoir = devoirRef.current;
    if (devoir) {
      setFace('recto');
      setIsFlipping(false);
      setSelectedClasses(devoir.classes || []);
      const date = devoir.dateRemise ? devoir.dateRemise.split('T')[0] : '';
      setDateRemise(date);
      setGrille(devoir.grille || '');
      setHiddenCriteria(devoir.hiddenCriteria || []);
      setShowHideCriteria(false);
      setIntitule(devoir.intitule || '');
      setConsignes(devoir.consignes || '');
      setAccesIA(devoir.accesIA || false);
      setDisponible(devoir.disponible || false);
      setFlipInverted(devoir.flipInverted ?? false);
      setAutoEvaluation(devoir.autoEvaluation !== false);
      setEvaluation(devoir.evaluation ?? 'formatif');
      setModePrincipal(
        devoir.modePrincipal ??
          atelierParDispositif(devoir.typeTravail ?? 'ecrire').modeParDefaut
      );
      setHabiletes(devoir.habiletes ?? null);
      setRessources(devoir.ressources || null);
      setRessourcesToIA(devoir.ressourcesToIA ?? false);
      setLectureQuiz(devoir.lectureQuiz || null);
      setAutoEvalQuiz(devoir.autoEvalQuiz || null);

      // Corrigé de référence existant (type ecrire)
      const ref = devoir.corrigeReference;
      setProfTheme(ref?.theme || '');
      setProfDraft(
        ref?.plan && ref.plan.length > 0
          ? { type: 'plan', plan: ref.plan }
          : createEmptyPlanDraft()
      );
      setProfProduction(ref?.production || '');
      setPlanToIA(ref?.planToIA ?? false);
      setProductionToIA(ref?.productionToIA ?? false);

      // Charger le questionnaire si type rechercher
      if (devoir.typeTravail === 'rechercher' && devoir.questionnaireId) {
        getAuthHeaders().then((headers) => {
          if (!headers) return;
          fetch(`/api/navigkid/questionnaire?id=${devoir.questionnaireId}`, { headers })
            .then((r) => r.json())
            .then((json) => {
              if (json.success) {
                setNkQuestions(json.data.questions || []);
                setNkThemes(
                  json.data.theme ? json.data.theme.split(',').map((t: string) => t.trim()).filter(Boolean) : []
                );
              }
            })
            .catch(() => {});
        });
      } else {
        setNkQuestions([]);
        setNkThemes([]);
      }
    }
  }, [devoir?.id, isOpen, getAuthHeaders]);

  const typeTravail = devoir?.typeTravail ?? 'ecrire';
  const atelierId = devoir?.atelier ?? atelierParDispositif(typeTravail).id;
  // Seules les activités d'écriture s'appuient sur une grille
  const usesGrille = typeTravail === 'ecrire';
  // Le contenu de la lecture d'une œuvre vit dans la bibliothèque, pas ici :
  // ni questionnaire à composer, ni ressources à joindre au verso.
  const isOeuvre = atelierId === 'lecture-oeuvre';
  // Sans objet en vocabulaire (tout y est automatisé) et sur une activité
  // d'auto-évaluation, qui EST déjà cela. La lecture d'une œuvre en est exclue
  // aussi : le smiley d'assurance se compare à un résultat, il n'y en a aucun.
  const supporteAutoEval =
    !isOeuvre &&
    (typeTravail === 'ecrire' || typeTravail === 'lire' || typeTravail === 'rechercher');

  // ── Ce que porte le verso ──
  // Deux groupes : les ressources DONNÉES à l'élève, et le contenu de
  // l'activité elle-même. Les intertitres ne servent qu'à les séparer.
  const aRessources = typeTravail !== 'vocabulaire' && typeTravail !== 'autoevaluation';
  const aContenus = typeTravail !== 'vocabulaire' && !isOeuvre;
  const aDeuxGroupes = aRessources && aContenus;
  const grillesDeLAtelier = grilles.length
    ? grilles.filter((g) => !g.ateliers.length || g.ateliers.includes(atelierId)).map((g) => g.name)
    : grilleTypes;

  // Classes et date de remise facultatives — cf. CreationForm
  const isValid = (!usesGrille || grille) && intitule.trim();

  // Le verso porte-t-il du contenu ? (point orange sur l'onglet Verso)
  const versoHasContent =
    ressources !== null ||
    (typeTravail === 'ecrire' && (planHasContent(profDraft.plan) || profProduction.trim() !== '')) ||
    (typeTravail === 'rechercher' && nkQuestions.some(q => q.texte.trim()));

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

  const enregistrer = async (fermer: boolean, silencieux = false): Promise<boolean> => {
    if (!devoir || !isValid) return false;

    // Sauvegarder le questionnaire si type rechercher
    if (devoir.typeTravail === 'rechercher' && devoir.questionnaireId) {
      const headers = await getAuthHeaders();
      if (headers) {
        await fetch(`/api/navigkid/questionnaire?id=${devoir.questionnaireId}`, {
          method: 'PATCH',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questions: nkQuestions,
            theme: nkThemes.join(', '),
          }),
        });
      }
    }

    const data: Partial<Devoir> = {
      classes: selectedClasses,
      dateRemise,
      grille,
      hiddenCriteria,
      intitule: intitule.trim(),
      consignes: consignes.trim(),
      accesIA,
      disponible,
      ressources,
      evaluation,
      modePrincipal,
      habiletes,
    };

    // Corrigé de référence du prof (type ecrire uniquement)
    if (devoir.typeTravail === 'ecrire') {
      data.flipInverted = flipInverted;
      data.ressourcesToIA = ressourcesToIA;
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
      // null explicite pour pouvoir effacer un corrigé existant
      data.corrigeReference = Object.keys(corrigeReference).length > 0 ? corrigeReference : null;
    }

    // Questionnaire de lecture (type lire) — null explicite pour l'effacer
    if (devoir.typeTravail === 'lire') {
      data.lectureQuiz =
        lectureQuiz && lectureQuiz.questions.length > 0 ? lectureQuiz : null;
    }

    // Questionnaire d'auto-évaluation — même règle
    if (devoir.typeTravail === 'autoevaluation') {
      data.autoEvalQuiz =
        autoEvalQuiz && autoEvalQuiz.questions.length > 0 ? autoEvalQuiz : null;
    }

    // Auto-évaluation intégrée (écriture, lecture, recherche)
    if (supporteAutoEval) {
      data.autoEvaluation = autoEvaluation;
    }

    const ok = await onSave(devoir.id, data, silencieux);
    if (ok && fermer) onClose();
    return ok;
  };

  // ═══ ENREGISTREMENT AUTOMATIQUE ═══
  //
  // Tant que l'activité N'EST PAS DISPONIBLE. Une activité déjà ouverte aux
  // élèves verrait sinon ses questions leur arriver à mesure qu'on les écrit :
  // un énoncé à moitié rédigé, un barème pas encore ajusté. On prépare avant
  // d'ouvrir — c'est la règle de travail, la mécanique la suit.
  //
  // Le professeur composait jusqu'ici tout un questionnaire en mémoire, et un
  // clic sur ✕ emportait le tout.
  const autoEnregistre = !disponible;

  // Ce qui serait écrit, ramené à une empreinte : c'est elle qui dit s'il y a
  // quelque chose de neuf. Comparer les états un à un obligerait à tenir une
  // seconde liste, qui divergerait de `data` au premier champ ajouté.
  const signature = JSON.stringify([
    selectedClasses, dateRemise, grille, hiddenCriteria, intitule, consignes,
    accesIA, disponible, ressources, evaluation, modePrincipal, habiletes,
    flipInverted, ressourcesToIA, profTheme, profDraft, planToIA,
    profProduction, productionToIA, lectureQuiz, autoEvalQuiz, autoEvaluation,
    nkQuestions, nkThemes,
  ]);

  // `enregistrer` est recréée à chaque rendu : passée en dépendance, elle
  // relancerait le minuteur en boucle (le piège des objets instables, cf.
  // AGENTS.md). D'où la référence, posée dans un effet et non pendant le rendu.
  const enregistrerRef = useRef(enregistrer);
  useEffect(() => {
    enregistrerRef.current = enregistrer;
  });

  // La PREMIÈRE empreinte est celle de l'activité telle qu'elle est en base :
  // elle sert de point de comparaison, pas de déclencheur. Sans cette remise à
  // zéro, ouvrir une activité sans y toucher l'aurait réécrite.
  const signatureRef = useRef<string | null>(null);
  useEffect(() => {
    signatureRef.current = null;
  }, [devoir?.id, isOpen]);

  // Tant que la fenêtre est ouverte, la page derrière ne défile plus. Sans ce
  // blocage, une fenêtre dont le contenu tient dans la hauteur n'a rien à faire
  // défiler : la molette « traverse » et fait défiler le tableau de bord.
  useEffect(() => {
    if (!isOpen) return;
    const overflowPrecedent = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflowPrecedent;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!autoEnregistre || !isOpen || !isValid) return;
    if (signatureRef.current === null) {
      signatureRef.current = signature;
      return;
    }
    if (signatureRef.current === signature) return;
    // 2,5 s après la dernière frappe — même cadence que l'espace de l'élève.
    const minuteur = setTimeout(() => {
      signatureRef.current = signature;
      enregistrerRef.current(false, true);
    }, 2500);
    return () => clearTimeout(minuteur);
  }, [signature, autoEnregistre, isOpen, isValid]);

  if (!isOpen || !devoir) return null;

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
      <Toggle checked={checked} onChange={onChange} disabled={isSaving} />
    </div>
  );

  // ── Recto : description de l'activité ──
  const renderRecto = () => (
    <>
      {/* Classes */}
      <div className={styles.formGroup}>
        <label className={styles.label}>
          Classe(s) <span className={styles.optional}>— facultatif</span>
        </label>
        <ClassesDropdown
          options={classeNames}
          selected={selectedClasses}
          onChange={setSelectedClasses}
          disabled={isSaving}
        />
      </div>

      {/* Didactique : l'atelier est figé (il commande le dispositif), le mode
          principal et les habiletés se modifient */}
      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label className={styles.label}>Type d&apos;activité</label>
          <select className={styles.select} value={atelierId} disabled>
            <option value={atelierId}>{findAtelier(atelierId)?.label ?? atelierId}</option>
          </select>
          {/* Le mode principal découle du type d'activité — chercher, c'est lire */}
          <p className={styles.modeNote}>
            Mode principal : {TYPES_MODAUX.find((t) => t.id === modePrincipal)?.court}
          </p>
        </div>

        {!usesGrille && (
          <div className={styles.formGroup}>
            <label className={styles.label}>Habiletés travaillées</label>
            <HabiletesPicker
              atelier={atelierId}
              modePrincipal={modePrincipal}
              value={habiletes}
              onChange={setHabiletes}
              disabled={isSaving}
            />
          </div>
        )}
      </div>

      {/* Date et Grille */}
      <div className={supporteAutoEval ? styles.formRowAutoEval : styles.formRow}>
        <div className={styles.formGroup}>
          <DatePicker
            /* « Échéance » et non « date de remise » : la date est facultative
               et ne signifie pas toujours une remise (lecture d'une œuvre,
               activité préparée d'avance). */
            label="Échéance"
            value={dateRemise}
            onChange={setDateRemise}
            min={getTodayString()}
          />
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
                // Changement de grille → proposer de masquer certains critères
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
              />
              <span className={styles.autoEvalSwitch} />
              <span className={styles.autoEvalText}>
                {autoEvaluation ? 'Activée' : 'Désactivée'}
              </span>
            </label>
          </div>
        )}
      </div>

      {/* Évaluation */}
      <div className={styles.formGroup}>
        <label className={styles.label}>
          Évaluation <span className={styles.required}>*</span>
        </label>
        <select
          className={styles.select}
          value={evaluation}
          onChange={(e) => setEvaluation(e.target.value as EvaluationType)}
        >
          <option value="formatif">Formative (entraînement)</option>
          <option value="certificatif">Certificative (notée)</option>
        </select>
      </div>

      {/* Intitule */}
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

      {/* Recto / Verso de l'espace élève (uniquement pour type ecrire) */}
      {typeTravail === 'ecrire' && (
        <FlipChoice
          label="Espace d’écriture"
          faces={['✏️ Espace de rédaction', '📝 Espace de planification']}
          inverse={flipInverted}
          onChange={setFlipInverted}
          disabled={isSaving}
        />
      )}

      {/* Consignes */}
      <div className={styles.formGroup}>
        <label className={styles.label}>Consignes particulières</label>
        <textarea
          className={styles.textarea}
          value={consignes}
          onChange={(e) => setConsignes(e.target.value)}
          placeholder="Instructions détaillées pour les élèves..."
          rows={3}
        />
      </div>

      {/* Toggles */}
      <div className={styles.toggleSection}>
        <div className={styles.toggleGroup}>
          <Toggle
            checked={accesIA}
            onChange={setAccesIA}
            labelOn="Accès IA activé"
            labelOff="Accès IA désactivé"
            disabled={isSaving}
          />
        </div>
        <div className={styles.toggleGroup}>
          <Toggle
            checked={disponible}
            onChange={setDisponible}
            labelOn="Disponible"
            labelOff="Non disponible"
            disabled={isSaving}
          />
        </div>
      </div>
    </>
  );

  // ── Verso : ressources pédagogiques, variable selon le type d'activité ──
  const renderVerso = () => (
    <>
      <div className={styles.versoHeader}>
        <h3 className={styles.versoTitle}>Contenus de l’activité</h3>
        <span className={styles.versoContext}>
          {TYPE_LABELS[typeTravail]}
          {typeTravail === 'ecrire' && grille ? ` · ${grille}` : ''}
        </span>
      </div>

      {aRessources && (
        <>
          {/* Les intertitres n'existent que pour SÉPARER les deux groupes.
              Quand un seul est affiché, « Contenus de l'activité » se répétait
              mot pour mot sous le titre du verso, dans deux styles différents. */}
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
              disabled={isSaving}
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
                    : 'Le questionnaire est utilisé par l’extension NavigKid — il n’apparaît pas dans les ressources de l’élève.'
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
          disabled={isSaving}
          allowedHabiletes={habiletes}
        />
      )}

      {/* Questionnaire de lecture (type lire) — sauf lecture d'une œuvre, dont
          les vérifications se construisent section par section dans l'œuvre */}
      {typeTravail === 'lire' && !isOeuvre && (
        <LectureQuizBuilder
          value={lectureQuiz}
          onChange={setLectureQuiz}
          disabled={isSaving}
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
                disabled={isSaving}
              />
            </div>
            <PlanDraft
              draft={profDraft}
              onChange={setProfDraft}
              disabled={isSaving}
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
              disabled={isSaving}
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
            disabled={isSaving}
            getAuthHeaders={getAuthHeaders}
            allowedHabiletes={habiletes}
          />
          <button
            type="button"
            className={styles.previewBtn}
            onClick={() => setShowQuestionnairePreview(true)}
            disabled={isSaving || nkQuestions.length === 0}
          >
            👁 Aperçu du questionnaire — tel que l’élève le lira dans NavigKid!
          </button>
        </div>
      )}

      {showQuestionnairePreview && (
        <QuestionnairePreviewModal
          titre={intitule}
          consignes={consignes}
          questions={nkQuestions}
          onClose={() => setShowQuestionnairePreview(false)}
        />
      )}

      {/* Type vocabulaire : rien de spécifique */}
      {typeTravail === 'vocabulaire' && (
        <div className={styles.versoEmpty}>
          Pas de ressource spécifique pour ce type d&apos;activité.
        </div>
      )}
    </>
  );

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Modifier l’activité</h2>
          <button className={styles.closeButton} onClick={onClose}>
            &times;
          </button>
        </div>

        <div className={styles.body}>
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
              disabled={isSaving}
            >
              <span className={styles.flipTurnIcon}>⟳</span> Retourner
            </button>
          </div>

          {/* Carte animée */}
          <div className={`${styles.flipCard} ${isFlipping ? styles.flipCardOut : ''} ${face === 'verso' ? styles.flipCardVerso : ''}`}>
            {face === 'recto' ? renderRecto() : renderVerso()}
          </div>
        </div>

        <div className={styles.footer}>
          {autoEnregistre ? (
            /* « Annuler » ne peut plus rien annuler : c'est déjà en base. On
               dit à la place où en est l'enregistrement. */
            <span className={styles.autoEtat}>
              {isSaving ? 'Enregistrement…' : 'Enregistrement automatique'}
            </span>
          ) : (
            <button
              className={styles.cancelButton}
              onClick={onClose}
              disabled={isSaving}
            >
              Annuler
            </button>
          )}
          <button
            className={styles.saveButton}
            onClick={() => enregistrer(true)}
            disabled={isSaving || !isValid}
          >
            {isSaving
              ? 'Enregistrement...'
              : autoEnregistre
                ? 'Fermer la fenêtre'
                : 'Enregistrer'}
          </button>
        </div>
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
