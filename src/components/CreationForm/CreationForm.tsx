'use client';

import { useState, useCallback } from 'react';
import Toggle from '@/components/Toggle/Toggle';
import DatePicker from '@/components/DatePicker/DatePicker';
import RessourcesInput from '@/components/RessourcesInput/RessourcesInput';
import QuestionnaireBuilder from '@/components/QuestionnaireBuilder/QuestionnaireBuilder';
import ClassesDropdown from '@/components/ClassesDropdown/ClassesDropdown';
import PlanDraft from '@/components/DraftEditor/PlanDraft';
import { getTodayString } from '@/lib/devoir-utils';
import { createPlanItem, planHasContent } from '@/lib/draft-utils';
import { useVocabulaireThemes } from '@/hooks/useVocabulaireThemes';
import type { CreateDevoirData, Classe, DevoirRessource, TypeTravail, EvaluationType, CorrigeReference } from '@/types/devoir';
import type { DraftContent } from '@/types/travail';
import type { NavigKidQuestion } from '@/types/navigkid';
import styles from './CreationForm.module.css';

type FormFace = 'recto' | 'verso';

// Libellés du bloc ressources au verso, selon le type d'activité
const RESSOURCE_LABELS: Record<TypeTravail, string> = {
  ecrire: '📄 Ressource.s',
  lire: '📄 Texte à lire',
  rechercher: '📄 Documents d’appui (facultatif)',
  vocabulaire: '📄 Documents (facultatif)',
};

function createEmptyPlanDraft(): DraftContent {
  return { type: 'plan', plan: [createPlanItem()] };
}

interface CreationFormProps {
  classeNames: string[];
  grilleTypes: string[];
  isVisible: boolean;
  onSubmit: (data: CreateDevoirData) => Promise<void>;
  isSubmitting: boolean;
  onClose?: () => void;
  getAuthHeaders?: () => Promise<Record<string, string> | null>;
}

export default function CreationForm({
  classeNames,
  grilleTypes,
  isVisible,
  onSubmit,
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

  // Type de travail
  const [typeTravail, setTypeTravail] = useState<TypeTravail>('ecrire');

  // Évaluation : formative (entraînement) ou certificative (comptabilisée)
  const [evaluation, setEvaluation] = useState<EvaluationType>('formatif');

  // NavigKid (type rechercher)
  const [nkQuestions, setNkQuestions] = useState<NavigKidQuestion[]>([]);
  const [nkThemes, setNkThemes] = useState<string[]>([]);

  // Vocabulaire (type vocabulaire)
  const { themes: vocabThemes } = useVocabulaireThemes();

  // Toggles (initialement à false)
  const [accesIA, setAccesIA] = useState(false);
  const [disponible, setDisponible] = useState(false);

  // Inversion recto/verso (type ecrire uniquement)
  const [flipInverted, setFlipInverted] = useState(false);

  const baseValid = selectedClasses.length > 0 && dateRemise && intitule.trim();
  const grilleValid = typeTravail === 'vocabulaire' || grille;
  const isValid = baseValid && grilleValid
    && (typeTravail !== 'rechercher' || nkQuestions.some(q => q.texte.trim()));

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
    setTypeTravail('ecrire');
    setEvaluation('formatif');
    setNkQuestions([]);
    setNkThemes([]);
    setFlipInverted(false);
  }, []);

  async function handleSubmit() {
    if (!isValid) return;

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
      evaluation,
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

    await onSubmit(data);

    resetForm();
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

      {/* Ligne 1: Classes + Date + Type travail + Évaluation + (Grille si pas vocabulaire) */}
      <div className={typeTravail === 'vocabulaire' ? styles.formRowFour : styles.formRowFive}>
        <div className={styles.formGroup}>
          <label className={styles.label}>
            Classe(s) <span className={styles.required}>*</span>
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
            label="Date de remise"
            value={dateRemise}
            onChange={setDateRemise}
            min={getTodayString()}
            required
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>
            Type de travail <span className={styles.required}>*</span>
          </label>
          <select
            className={styles.select}
            value={typeTravail}
            onChange={(e) => setTypeTravail(e.target.value as TypeTravail)}
          >
            <option value="ecrire">Écrire</option>
            <option value="lire">Lire</option>
            <option value="rechercher">Rechercher</option>
            <option value="vocabulaire">Vocabulaire</option>
          </select>
        </div>

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

      {/* Ligne 2: Intitulé (+ mode si vocabulaire) */}
      {typeTravail === 'vocabulaire' ? (
        <div className={styles.formRowIntituleVocab}>
          <div className={styles.formGroup}>
            <label className={styles.label}>
              Série lexicale <span className={styles.required}>*</span>
            </label>
            <select
              className={styles.select}
              value={intitule}
              onChange={(e) => setIntitule(e.target.value)}
              disabled={isSubmitting}
            >
              <option value="">Sélectionnez une série...</option>
              {vocabThemes.map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {theme.name.charAt(0).toUpperCase() + theme.name.slice(1)} ({theme.wordCount} mots)
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <>
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
        </>
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
        <h2 className={styles.formTitle}>Ajouter des ressources</h2>
        <span className={styles.versoContext}>
          {typeTravail === 'ecrire' && `Écrire${grille ? ` · ${grille}` : ''}`}
          {typeTravail === 'lire' && 'Lire'}
          {typeTravail === 'rechercher' && 'Rechercher'}
          {typeTravail === 'vocabulaire' && 'Vocabulaire'}
        </span>
      </div>

      {/* Bloc ressources (tous les types sauf vocabulaire) */}
      {typeTravail !== 'vocabulaire' && (
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
          />
        </div>
      )}

      {/* Type vocabulaire : rien de spécifique */}
      {typeTravail === 'vocabulaire' && (
        <div className={styles.versoEmpty}>
          Pas de ressource spécifique pour ce type d&apos;activité.
        </div>
      )}

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
          className={`${styles.btn} ${styles.btnAccent}`}
          onClick={flip}
          type="button"
          disabled={isSubmitting}
        >
          Revenir à l’activité ⟳
        </button>
      </div>
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
            📚 Ajout de ressources
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
    </div>
  );
}
