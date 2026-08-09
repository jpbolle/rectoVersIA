'use client';

import { useState, useCallback } from 'react';
import Toggle from '@/components/Toggle/Toggle';
import DatePicker from '@/components/DatePicker/DatePicker';
import RessourcesInput from '@/components/RessourcesInput/RessourcesInput';
import QuestionnaireBuilder from '@/components/QuestionnaireBuilder/QuestionnaireBuilder';
import ClassesDropdown from '@/components/ClassesDropdown/ClassesDropdown';
import { getTodayString } from '@/lib/devoir-utils';
import { useVocabulaireThemes } from '@/hooks/useVocabulaireThemes';
import type { CreateDevoirData, Classe, DevoirRessource, TypeTravail, EvaluationType } from '@/types/devoir';
import type { NavigKidQuestion } from '@/types/navigkid';
import styles from './CreationForm.module.css';

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
  // Champs obligatoires
  const [selectedClasses, setSelectedClasses] = useState<Classe[]>([]);
  const [dateRemise, setDateRemise] = useState('');
  const [grille, setGrille] = useState('');
  const [intitule, setIntitule] = useState('');

  // Champs optionnels avec checkbox
  const [showConsignes, setShowConsignes] = useState(false);
  const [showRessources, setShowRessources] = useState(false);
  const [consignes, setConsignes] = useState('');
  const [ressources, setRessources] = useState<DevoirRessource | null>(null);

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

  const resetForm = useCallback(() => {
    setSelectedClasses([]);
    setDateRemise('');
    setGrille('');
    setIntitule('');
    setShowConsignes(false);
    setShowRessources(false);
    setConsignes('');
    setRessources(null);
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
      ressources: showRessources ? ressources : null,
      accesIA,
      disponible,
      typeTravail,
      evaluation,
      ...(typeTravail === 'ecrire' && { flipInverted }),
    };

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

  return (
    <div className={`${styles.form} ${isVisible ? styles.formVisible : ''}`}>
      <div className={styles.formHeader}>
        <h2 className={styles.formTitle}>Créer un nouveau devoir</h2>
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

          {/* Recto / Verso (uniquement pour type ecrire) */}
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

      {/* Ressources (optionnel avec checkbox) */}
      <div className={styles.optionalSection}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={showRessources}
            onChange={(e) => setShowRessources(e.target.checked)}
            className={styles.checkbox}
          />
          <span>Ajouter des ressources</span>
        </label>
        {showRessources && (
          <RessourcesInput
            ressources={ressources}
            onRessourcesChange={setRessources}
            disabled={isSubmitting}
          />
        )}
      </div>

      {/* Questionnaire NavigKid (type rechercher) */}
      {typeTravail === 'rechercher' && (
        <QuestionnaireBuilder
          questions={nkQuestions}
          onQuestionsChange={setNkQuestions}
          themes={nkThemes}
          onThemesChange={setNkThemes}
          titre={intitule}
          disabled={isSubmitting}
          getAuthHeaders={getAuthHeaders}
        />
      )}

      {/* Config Vocabulaire supprimee — integree dans l'intitule + mode */}

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
            Permet aux élèves d&apos;utiliser l&apos;assistant IA pour ce devoir
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
            Rend le devoir visible et accessible aux élèves
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
          {isSubmitting ? 'Création en cours...' : 'Créer le devoir'}
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
    </div>
  );
}
