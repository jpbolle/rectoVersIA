'use client';

import { useState, useCallback } from 'react';
import Toggle from '@/components/Toggle/Toggle';
import DatePicker from '@/components/DatePicker/DatePicker';
import RessourcesInput from '@/components/RessourcesInput/RessourcesInput';
import QuestionnaireBuilder from '@/components/QuestionnaireBuilder/QuestionnaireBuilder';
import { getTodayString } from '@/lib/devoir-utils';
import type { CreateDevoirData, Classe, DevoirRessource, TypeTravail } from '@/types/devoir';
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

  // NavigKid (type rechercher)
  const [nkQuestions, setNkQuestions] = useState<NavigKidQuestion[]>([]);
  const [nkThemes, setNkThemes] = useState<string[]>([]);

  // Toggles (initialement à false)
  const [accesIA, setAccesIA] = useState(false);
  const [disponible, setDisponible] = useState(false);

  const baseValid = selectedClasses.length > 0 && dateRemise && grille && intitule.trim();
  const isValid = baseValid && (typeTravail !== 'rechercher' || nkQuestions.some(q => q.texte.trim()));

  const handleClassToggle = (classe: Classe) => {
    setSelectedClasses((prev) =>
      prev.includes(classe)
        ? prev.filter((c) => c !== classe)
        : [...prev, classe]
    );
  };

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
    setNkQuestions([]);
    setNkThemes([]);
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
    };

    if (typeTravail === 'rechercher') {
      const questionsValides = nkQuestions.filter(q => q.texte.trim());
      data.questionnaire = {
        themes: nkThemes.join(', '),
        questions: questionsValides,
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

      {/* Ligne 1: Classes + Date + Type travail + Grille */}
      <div className={styles.formRowFour}>
        <div className={styles.formGroup}>
          <label className={styles.label}>
            Classe(s) <span className={styles.required}>*</span>
          </label>
          <div className={styles.classesGrid}>
            {classeNames.map((c) => (
              <label key={c} className={styles.classCheckbox}>
                <input
                  type="checkbox"
                  checked={selectedClasses.includes(c)}
                  onChange={() => handleClassToggle(c)}
                  className={styles.checkbox}
                />
                <span className={styles.classLabel}>{c}</span>
              </label>
            ))}
          </div>
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
          </select>
        </div>

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
      </div>

      {/* Ligne 2: Intitulé */}
      <div className={styles.formGroup}>
        <label className={styles.label}>
          Intitulé du devoir <span className={styles.required}>*</span>
        </label>
        <input
          className={styles.input}
          type="text"
          value={intitule}
          onChange={(e) => setIntitule(e.target.value)}
          placeholder="Ex : Dissertation sur Molière"
        />
      </div>

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
