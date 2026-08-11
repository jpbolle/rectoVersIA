'use client';

import { useState, useEffect, useCallback } from 'react';
import Toggle from '@/components/Toggle/Toggle';
import DatePicker from '@/components/DatePicker/DatePicker';
import RessourcesInput from '@/components/RessourcesInput/RessourcesInput';
import QuestionnaireBuilder from '@/components/QuestionnaireBuilder/QuestionnaireBuilder';
import ClassesDropdown from '@/components/ClassesDropdown/ClassesDropdown';
import PlanDraft from '@/components/DraftEditor/PlanDraft';
import LectureQuizBuilder from '@/components/LectureQuizBuilder/LectureQuizBuilder';
import { getTodayString } from '@/lib/devoir-utils';
import { createPlanItem, planHasContent } from '@/lib/draft-utils';
import type { Devoir, Classe, DevoirRessource, EvaluationType, TypeTravail, CorrigeReference } from '@/types/devoir';
import type { LectureQuiz } from '@/types/lecture';
import type { DraftContent } from '@/types/travail';
import type { NavigKidQuestion } from '@/types/navigkid';
import styles from './EditDevoirModal.module.css';

type FormFace = 'recto' | 'verso';

// Libellés du bloc ressources au verso, selon le type d'activité
const RESSOURCE_LABELS: Record<TypeTravail, string> = {
  ecrire: '📄 Ressource.s',
  lire: '📄 Texte à lire',
  rechercher: '📄 Documents d’appui (facultatif)',
  vocabulaire: '📄 Documents (facultatif)',
};

const TYPE_LABELS: Record<TypeTravail, string> = {
  ecrire: 'Écrire',
  lire: 'Lire',
  rechercher: 'Rechercher',
  vocabulaire: 'Vocabulaire',
};

function createEmptyPlanDraft(): DraftContent {
  return { type: 'plan', plan: [createPlanItem()] };
}

interface EditDevoirModalProps {
  devoir: Devoir | null;
  classeNames: string[];
  grilleTypes: string[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, data: Partial<Devoir>) => Promise<void>;
  isSaving: boolean;
  getAuthHeaders: () => Promise<Record<string, string> | null>;
}

export default function EditDevoirModal({
  devoir,
  classeNames,
  grilleTypes,
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
  const [grille, setGrille] = useState('');
  const [intitule, setIntitule] = useState('');
  const [consignes, setConsignes] = useState('');
  const [accesIA, setAccesIA] = useState(false);
  const [disponible, setDisponible] = useState(false);
  const [flipInverted, setFlipInverted] = useState(false);
  const [evaluation, setEvaluation] = useState<EvaluationType>('formatif');

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

  useEffect(() => {
    if (devoir) {
      setFace('recto');
      setIsFlipping(false);
      setSelectedClasses(devoir.classes || []);
      const date = devoir.dateRemise ? devoir.dateRemise.split('T')[0] : '';
      setDateRemise(date);
      setGrille(devoir.grille || '');
      setIntitule(devoir.intitule || '');
      setConsignes(devoir.consignes || '');
      setAccesIA(devoir.accesIA || false);
      setDisponible(devoir.disponible || false);
      setFlipInverted(devoir.flipInverted ?? false);
      setEvaluation(devoir.evaluation ?? 'formatif');
      setRessources(devoir.ressources || null);
      setRessourcesToIA(devoir.ressourcesToIA ?? false);
      setLectureQuiz(devoir.lectureQuiz || null);

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
  }, [devoir, getAuthHeaders]);

  const typeTravail = devoir?.typeTravail ?? 'ecrire';

  const isValid =
    selectedClasses.length > 0 &&
    dateRemise &&
    (typeTravail === 'vocabulaire' || grille) &&
    intitule.trim();

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

  const handleSave = async () => {
    if (!devoir || !isValid) return;

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
      intitule: intitule.trim(),
      consignes: consignes.trim(),
      accesIA,
      disponible,
      ressources,
      evaluation,
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

    await onSave(devoir.id, data);
  };

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
          Classe(s) <span className={styles.required}>*</span>
        </label>
        <ClassesDropdown
          options={classeNames}
          selected={selectedClasses}
          onChange={setSelectedClasses}
          disabled={isSaving}
        />
      </div>

      {/* Date et Grille */}
      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <DatePicker
            label="Date de remise"
            value={dateRemise}
            onChange={setDateRemise}
            min={getTodayString()}
            required
          />
        </div>

        {typeTravail !== 'vocabulaire' && (
          <div className={styles.formGroup}>
            <label className={styles.label}>
              Type de grille <span className={styles.required}>*</span>
            </label>
            <select
              className={styles.select}
              value={grille}
              onChange={(e) => setGrille(e.target.value)}
            >
              <option value="">Sélectionnez...</option>
              {grilleTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
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

      {/* ── Groupe 1 : ressources pour l'élève (tous les types sauf vocabulaire) ── */}
      {typeTravail !== 'vocabulaire' && (
        <>
          <div className={styles.versoGroup}>
            <h4 className={styles.versoGroupTitle}>Ressources pour l’élève</h4>
            <p className={styles.versoGroupHint}>
              Visibles par l’élève dans l’onglet «&nbsp;Ressources&nbsp;» de sa colonne de droite.
            </p>
          </div>
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

      {/* ── Groupe 2 : contenus de l'activité (selon le type) ── */}
      {typeTravail !== 'vocabulaire' && (
        <div className={styles.versoGroup}>
          <h4 className={styles.versoGroupTitle}>Contenus de l’activité</h4>
          <p className={styles.versoGroupHint}>
            {typeTravail === 'ecrire' &&
              'Corrigé de référence : transmis à l’IA selon les interrupteurs « Corrigé IA » ; seule la production est montrée à l’élève, quand le corrigé est disponible.'}
            {typeTravail === 'lire' &&
              'Le questionnaire de lecture : rempli par l’élève dans sa colonne de gauche. QCM corrigés automatiquement, le reste par vous.'}
            {typeTravail === 'rechercher' &&
              'Le questionnaire est utilisé par l’extension NavigKid — il n’apparaît pas dans les ressources de l’élève.'}
          </p>
        </div>
      )}

      {/* Questionnaire de lecture (type lire) */}
      {typeTravail === 'lire' && (
        <LectureQuizBuilder
          value={lectureQuiz}
          onChange={setLectureQuiz}
          disabled={isSaving}
          getAuthHeaders={getAuthHeaders}
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
          />
        </div>
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
          <button
            className={styles.cancelButton}
            onClick={onClose}
            disabled={isSaving}
          >
            Annuler
          </button>
          <button
            className={styles.saveButton}
            onClick={handleSave}
            disabled={isSaving || !isValid}
          >
            {isSaving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
