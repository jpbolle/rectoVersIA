'use client';

import { useState, useCallback, useEffect } from 'react';
import { useGoogleClassroom } from '@/hooks/useGoogleClassroom';
import { CLASSE_TYPES } from '@/types/classe';
import type { ClasseType } from '@/types/classe';
import styles from './ClasseCreationForm.module.css';

interface ClasseCreationFormProps {
  isVisible: boolean;
  onSubmit: (data: { nom: string; description?: string; type: ClasseType }) => Promise<void>;
  isSubmitting: boolean;
  onClose?: () => void;
  onImportSuccess?: (classeId: string, studentsCount: number) => void;
}

export default function ClasseCreationForm({
  isVisible,
  onSubmit,
  isSubmitting,
  onClose,
  onImportSuccess,
}: ClasseCreationFormProps) {
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  // Type de cours : le seul réglage manuel qui distingue une classe FLE
  const [type, setType] = useState<ClasseType>('francais');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const {
    isLoading: isClassroomLoading,
    isAuthorized,
    courses,
    error: classroomError,
    authorizeClassroom,
    fetchCourses,
    importCourse,
    reset: resetClassroom,
  } = useGoogleClassroom();

  const isValid = nom.trim() !== '';

  const resetForm = useCallback(() => {
    setNom('');
    setDescription('');
    setType('francais');
    setSelectedCourseId('');
    setImportMessage(null);
    resetClassroom();
  }, [resetClassroom]);

  // Charger les classes après autorisation
  useEffect(() => {
    if (isAuthorized && courses.length === 0 && !isClassroomLoading) {
      fetchCourses();
    }
  }, [isAuthorized, courses.length, isClassroomLoading, fetchCourses]);

  // L'erreur Classroom s'affiche à la place du message local : dérivée au
  // rendu, pas recopiée dans un état (un setState dans un effet fait
  // cascader les rendus — règle du linter react-hooks)
  const messageAffiche =
    importMessage ?? (classroomError ? { type: 'error' as const, text: classroomError } : null);

  async function handleSubmit() {
    if (!isValid) return;

    await onSubmit({
      nom: nom.trim(),
      description: description.trim() || undefined,
      type,
    });

    resetForm();
  }

  async function handleImportClick() {
    setImportMessage(null);

    if (!isAuthorized) {
      // Première étape : autoriser l'accès à Google Classroom
      const success = await authorizeClassroom();
      if (success) {
        // Les classes seront chargées automatiquement via useEffect
      }
    }
  }

  async function handleCourseSelect(courseId: string) {
    setSelectedCourseId(courseId);
    setImportMessage(null);

    if (!courseId) {
      setNom('');
      setDescription('');
      return;
    }

    const course = courses.find((c) => c.id === courseId);
    if (course) {
      // Préremplir le formulaire
      const courseName = course.section
        ? `${course.name} - ${course.section}`
        : course.name;
      setNom(courseName);
      setDescription('Importée depuis Google Classroom');
    }
  }

  async function handleImportCourse() {
    if (!selectedCourseId) return;

    const course = courses.find((c) => c.id === selectedCourseId);
    if (!course) return;

    setImportMessage(null);

    // Le type de cours choisi dans le formulaire vaut aussi pour une classe importée
    const result = await importCourse(course.id, course.name, course.section, type);

    if (result) {
      setImportMessage({
        type: 'success',
        text: `Classe "${result.classe.nom}" importée avec ${result.studentsCount} élève(s)`,
      });

      // Notifier le parent
      if (onImportSuccess) {
        onImportSuccess(result.classe.id, result.studentsCount);
      }

      // Réinitialiser après un délai
      setTimeout(() => {
        resetForm();
        if (onClose) onClose();
      }, 2000);
    }
  }

  return (
    <div className={`${styles.form} ${isVisible ? styles.formVisible : ''}`}>
      <div className={styles.formHeader}>
        <h2 className={styles.formTitle}>Créer une nouvelle classe</h2>
        {onClose && (
          <button
            type="button"
            className={styles.closeButton}
            onClick={() => {
              resetForm();
              onClose();
            }}
            title="Fermer"
          >
            &times;
          </button>
        )}
      </div>

      {/* Bouton Importer en haut */}
      <div className={styles.importWrapper}>
        {!isAuthorized ? (
          <button
            className={styles.importBtn}
            type="button"
            onClick={handleImportClick}
            disabled={isSubmitting || isClassroomLoading}
          >
            {isClassroomLoading ? (
              <>
                <span className={styles.spinner}></span>
                Connexion à Classroom...
              </>
            ) : (
              <>📥 Importer depuis Google Classroom</>
            )}
          </button>
        ) : (
          <div className={styles.courseSelector}>
            <select
              className={styles.courseSelect}
              value={selectedCourseId}
              onChange={(e) => handleCourseSelect(e.target.value)}
              disabled={isClassroomLoading || isSubmitting}
            >
              <option value="">
                {isClassroomLoading
                  ? 'Chargement des classes...'
                  : courses.length === 0
                    ? 'Aucune classe trouvée'
                    : 'Sélectionnez une classe Classroom'}
              </option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.section ? `${course.name} - ${course.section}` : course.name}
                </option>
              ))}
            </select>

            {selectedCourseId && (
              <button
                className={styles.importConfirmBtn}
                type="button"
                onClick={handleImportCourse}
                disabled={isClassroomLoading || isSubmitting}
              >
                {isClassroomLoading ? (
                  <>
                    <span className={styles.spinner}></span>
                    Import en cours...
                  </>
                ) : (
                  'Importer avec les élèves'
                )}
              </button>
            )}
          </div>
        )}

        {messageAffiche && (
          <p
            className={`${styles.importMessage} ${
              messageAffiche.type === 'success' ? styles.importSuccess : styles.importError
            }`}
          >
            {messageAffiche.text}
          </p>
        )}
      </div>

      <div className={styles.separator}>
        <span>ou créer manuellement</span>
      </div>

      {/* Nom de la classe */}
      <div className={styles.formGroup}>
        <label className={styles.label}>
          Nom de la classe <span className={styles.required}>*</span>
        </label>
        <input
          className={styles.input}
          type="text"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          placeholder="Ex : 4A, 3B, Terminale S1"
        />
      </div>

      {/* Type de cours — deux cartes à cocher, pas un menu : le choix doit se
          lire d'un coup d'œil, avec ce qu'il implique */}
      <div className={styles.formGroup}>
        <label className={styles.label}>Type de cours</label>
        <div className={styles.typeChoices}>
          {CLASSE_TYPES.map((t) => (
            <label
              key={t.id}
              className={`${styles.typeChoice} ${type === t.id ? styles.typeChoiceActive : ''}`}
            >
              <input
                type="radio"
                name="classe-type"
                value={t.id}
                checked={type === t.id}
                onChange={() => setType(t.id)}
                disabled={isSubmitting}
              />
              <span className={styles.typeChoiceLabel}>{t.label}</span>
              <span className={styles.typeChoiceAide}>{t.aide}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Description (optionnel) */}
      <div className={styles.formGroup}>
        <label className={styles.label}>
          Description <span className={styles.optional}>(optionnel)</span>
        </label>
        <textarea
          className={styles.textarea}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ex : Classe scientifique, Section européenne..."
          rows={3}
        />
      </div>

      {/* Actions */}
      <div className={styles.formActions}>
        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={handleSubmit}
          disabled={isSubmitting || !isValid}
        >
          {isSubmitting ? 'Création en cours...' : 'Créer la classe'}
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
