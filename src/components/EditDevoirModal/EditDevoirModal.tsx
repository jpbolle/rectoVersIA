'use client';

import { useState, useEffect } from 'react';
import Toggle from '@/components/Toggle/Toggle';
import DatePicker from '@/components/DatePicker/DatePicker';
import RessourcesInput from '@/components/RessourcesInput/RessourcesInput';
import QuestionnaireBuilder from '@/components/QuestionnaireBuilder/QuestionnaireBuilder';
import ClassesDropdown from '@/components/ClassesDropdown/ClassesDropdown';
import { getTodayString } from '@/lib/devoir-utils';
import type { Devoir, Classe, DevoirRessource, EvaluationType } from '@/types/devoir';
import type { NavigKidQuestion } from '@/types/navigkid';
import styles from './EditDevoirModal.module.css';

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
  const [selectedClasses, setSelectedClasses] = useState<Classe[]>([]);
  const [dateRemise, setDateRemise] = useState('');
  const [grille, setGrille] = useState('');
  const [intitule, setIntitule] = useState('');
  const [consignes, setConsignes] = useState('');
  const [accesIA, setAccesIA] = useState(false);
  const [disponible, setDisponible] = useState(false);
  const [flipInverted, setFlipInverted] = useState(false);
  const [evaluation, setEvaluation] = useState<EvaluationType>('formatif');

  // Ressources
  const [showRessources, setShowRessources] = useState(false);
  const [ressources, setRessources] = useState<DevoirRessource | null>(null);

  // Questionnaire (type rechercher)
  const [nkQuestions, setNkQuestions] = useState<NavigKidQuestion[]>([]);
  const [nkThemes, setNkThemes] = useState<string[]>([]);

  useEffect(() => {
    if (devoir) {
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

      // Initialiser les ressources existantes
      if (devoir.ressources) {
        setShowRessources(true);
        setRessources(devoir.ressources);
      } else {
        setShowRessources(false);
        setRessources(null);
      }

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

  const isValid = selectedClasses.length > 0 && dateRemise && grille && intitule.trim();

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

    await onSave(devoir.id, {
      classes: selectedClasses,
      dateRemise,
      grille,
      intitule: intitule.trim(),
      consignes: consignes.trim(),
      accesIA,
      disponible,
      ressources: showRessources ? ressources : null,
      evaluation,
      ...(devoir.typeTravail === 'ecrire' && { flipInverted }),
    });
  };

  if (!isOpen || !devoir) return null;

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

          {/* Recto / Verso (uniquement pour type ecrire) */}
          {devoir?.typeTravail === 'ecrire' && (
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

          {/* Ressources */}
          <div className={styles.optionalSection}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={showRessources}
                onChange={(e) => {
                  setShowRessources(e.target.checked);
                  if (!e.target.checked) {
                    setRessources(null);
                  }
                }}
                className={styles.checkbox}
              />
              <span>Ajouter des ressources</span>
            </label>
            {showRessources && (
              <div className={styles.ressourcesWrapper}>
                <RessourcesInput
                  ressources={ressources}
                  onRessourcesChange={setRessources}
                  disabled={isSaving}
                />
              </div>
            )}
          </div>

          {/* Questionnaire NavigKid */}
          {devoir?.typeTravail === 'rechercher' && (
            <div className={styles.formGroup}>
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
