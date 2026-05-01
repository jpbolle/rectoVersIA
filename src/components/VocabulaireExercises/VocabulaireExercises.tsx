'use client';

import { useState, useCallback } from 'react';
import type {
  VocabulaireExercise,
  VocabulaireWord,
  TextWithDefinitionsExercise,
  DragAndDropExercise,
  WordFamiliesExercise,
  FillInBlanksExercise,
  ProductionChallengeExercise,
  ProductionValidation,
} from '@/types/vocabulaire';
import styles from './VocabulaireExercises.module.css';

// ── Sous-composants exercices ──

function TextWithDefinitions({ exercise }: { exercise: TextWithDefinitionsExercise }) {
  const [hoveredWord, setHoveredWord] = useState<string | null>(null);

  // Surligner les mots dans le texte
  const renderText = () => {
    let text = exercise.text;
    const parts: { text: string; isHighlighted: boolean; definition?: string }[] = [];

    // Trier les mots par longueur decroissante pour eviter les conflits
    const sortedWords = [...exercise.highlighted_words].sort(
      (a, b) => b.word.length - a.word.length
    );

    // Construire un regex avec tous les mots
    const regex = new RegExp(
      `(${sortedWords.map((w) => w.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
      'gi'
    );

    const segments = text.split(regex);
    for (const seg of segments) {
      const match = exercise.highlighted_words.find(
        (w) => w.word.toLowerCase() === seg.toLowerCase()
      );
      parts.push({
        text: seg,
        isHighlighted: !!match,
        definition: match?.definition,
      });
    }

    return parts.map((part, i) =>
      part.isHighlighted ? (
        <span
          key={i}
          className={styles.highlightedWord}
          onMouseEnter={() => setHoveredWord(part.text)}
          onMouseLeave={() => setHoveredWord(null)}
        >
          {part.text}
          {hoveredWord === part.text && (
            <span className={styles.tooltip}>{part.definition}</span>
          )}
        </span>
      ) : (
        <span key={i}>{part.text}</span>
      )
    );
  };

  return (
    <div className={styles.exercise}>
      <h3 className={styles.exerciseTitle}>{exercise.title}</h3>
      <p className={styles.exerciseInstructions}>{exercise.instructions}</p>
      <div className={styles.textContent}>{renderText()}</div>
    </div>
  );
}

function DragAndDrop({ exercise }: { exercise: DragAndDropExercise }) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState(false);

  const allDefs = [
    ...exercise.definitions.map((d) => ({ ...d, isDistractor: false })),
    ...(exercise.distractors || []).map((d, i) => ({
      id: 100 + i,
      definition: d.definition,
      correct_word: d.correct_term,
      isDistractor: true,
    })),
  ];

  const handleCheck = () => setChecked(true);

  return (
    <div className={styles.exercise}>
      <h3 className={styles.exerciseTitle}>{exercise.title}</h3>
      <p className={styles.exerciseInstructions}>{exercise.instructions}</p>

      <div className={styles.dndContainer}>
        {exercise.definitions.map((def) => {
          const selected = answers[def.id] || '';
          const isCorrect = checked && selected.toLowerCase() === def.correct_word.toLowerCase();
          const isWrong = checked && selected && !isCorrect;

          return (
            <div key={def.id} className={styles.dndRow}>
              <div className={styles.dndDefinition}>{def.definition}</div>
              <select
                className={`${styles.dndSelect} ${isCorrect ? styles.dndCorrect : ''} ${isWrong ? styles.dndIncorrect : ''}`}
                value={selected}
                onChange={(e) => {
                  setAnswers((prev) => ({ ...prev, [def.id]: e.target.value }));
                  setChecked(false);
                }}
              >
                <option value="">Choisir...</option>
                {exercise.words.map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      <button
        className={styles.checkBtn}
        onClick={handleCheck}
        disabled={Object.keys(answers).length === 0}
      >
        Verifier mes reponses
      </button>
    </div>
  );
}

function WordFamilies({ exercise }: { exercise: WordFamiliesExercise }) {
  return (
    <div className={styles.exercise}>
      <h3 className={styles.exerciseTitle}>{exercise.title}</h3>
      <p className={styles.exerciseInstructions}>{exercise.instructions}</p>

      <div className={styles.familyContainer}>
        {exercise.word_schemas.map((schema) => (
          <div key={schema.central_word} className={styles.familyGroup}>
            <div className={styles.familyCentralWord}>{schema.central_word}</div>
            <div className={styles.familyBranches}>
              <div className={styles.familyBranch}>
                <div className={styles.familyBranchTitle}>Famille</div>
                <div className={styles.familyBranchWords}>
                  {schema.family_branch.map((w, i) => (
                    <div key={i} className={styles.familyWord}>{w}</div>
                  ))}
                </div>
              </div>
              <div className={styles.familyBranch}>
                <div className={styles.familyBranchTitle}>Synonymes</div>
                <div className={styles.familyBranchWords}>
                  {schema.synonyms_branch.map((w, i) => (
                    <div key={i} className={styles.familyWord}>{w}</div>
                  ))}
                </div>
              </div>
              <div className={styles.familyBranch}>
                <div className={styles.familyBranchTitle}>Antonymes</div>
                <div className={styles.familyBranchWords}>
                  {schema.antonyms_branch.map((w, i) => (
                    <div key={i} className={styles.familyWord}>{w}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FillInBlanks({ exercise }: { exercise: FillInBlanksExercise }) {
  const [answers, setAnswers] = useState<string[]>(
    new Array(exercise.answers.length).fill('')
  );
  const [checked, setChecked] = useState(false);

  const parts = exercise.text_with_blanks.split(/_{3,}|___/);

  return (
    <div className={styles.exercise}>
      <h3 className={styles.exerciseTitle}>{exercise.title}</h3>
      <p className={styles.exerciseInstructions}>{exercise.instructions}</p>

      <div className={styles.fillBlanksText}>
        {parts.map((part, i) => (
          <span key={i}>
            {part}
            {i < parts.length - 1 && i < exercise.answers.length && (
              <input
                type="text"
                className={`${styles.blankInput} ${
                  checked
                    ? answers[i]?.toLowerCase().trim() === exercise.answers[i]?.toLowerCase().trim()
                      ? styles.blankCorrect
                      : styles.blankIncorrect
                    : ''
                }`}
                value={answers[i] || ''}
                onChange={(e) => {
                  const newAnswers = [...answers];
                  newAnswers[i] = e.target.value;
                  setAnswers(newAnswers);
                  setChecked(false);
                }}
                placeholder="..."
              />
            )}
          </span>
        ))}
      </div>

      <button
        className={styles.checkBtn}
        onClick={() => setChecked(true)}
        disabled={answers.every((a) => !a.trim())}
      >
        Verifier mes reponses
      </button>
    </div>
  );
}

function ProductionChallenge({
  exercise,
  onValidate,
  validation,
  isValidating,
}: {
  exercise: ProductionChallengeExercise;
  onValidate: (text: string) => void;
  validation: ProductionValidation | null;
  isValidating: boolean;
}) {
  const [text, setText] = useState('');

  return (
    <div className={styles.exercise}>
      <h3 className={styles.exerciseTitle}>{exercise.title}</h3>
      <p className={styles.exerciseInstructions}>{exercise.instructions}</p>

      <div className={styles.productionContainer}>
        <div className={styles.productionWords}>
          {exercise.selected_words.map((w) => (
            <span key={w} className={styles.productionWord}>{w}</span>
          ))}
        </div>

        <div className={styles.productionConstraint}>
          Contrainte : {exercise.constraint}
        </div>

        <textarea
          className={styles.productionTextarea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ecris ta phrase ici..."
          disabled={isValidating}
        />

        <button
          className={styles.validateBtn}
          onClick={() => onValidate(text)}
          disabled={!text.trim() || isValidating}
        >
          {isValidating ? 'Evaluation en cours...' : 'Valider ma production'}
        </button>

        {validation && (
          <div
            className={`${styles.feedback} ${
              validation.isValid ? styles.feedbackValid : styles.feedbackInvalid
            }`}
          >
            {validation.feedback}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Composant principal ──

interface VocabulaireExercisesProps {
  exercises: VocabulaireExercise[];
  selectedWords: VocabulaireWord[];
  isGenerating: boolean;
  error: string | null;
  onGenerate: () => void;
  onValidateProduction: (text: string) => void;
  productionValidation: ProductionValidation | null;
  isValidatingProduction: boolean;
  canGenerate: boolean;
}

export default function VocabulaireExercises({
  exercises,
  selectedWords,
  isGenerating,
  error,
  onGenerate,
  onValidateProduction,
  productionValidation,
  isValidatingProduction,
  canGenerate,
}: VocabulaireExercisesProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Etat vide : pas d'exercices generes
  if (exercises.length === 0 && !isGenerating) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📝</div>
          <h3 className={styles.emptyTitle}>Exercices de vocabulaire</h3>
          <p className={styles.emptyDescription}>
            {selectedWords.length === 0
              ? 'Selectionnez des mots dans la liste (verso) puis generez des exercices.'
              : `${selectedWords.length} mot(s) selectionne(s). Cliquez pour generer les exercices.`}
          </p>
          <button
            className={styles.generateBtn}
            onClick={onGenerate}
            disabled={!canGenerate}
          >
            Generer les exercices
          </button>
          {error && <div className={styles.error}>{error}</div>}
        </div>
      </div>
    );
  }

  // En cours de generation
  if (isGenerating) {
    return (
      <div className={styles.container}>
        <div className={styles.generating}>
          <div className={styles.spinner} />
          <p>Generation des exercices en cours...</p>
          <p style={{ fontSize: 12, color: 'var(--c-text-dim)' }}>
            Cela peut prendre quelques secondes
          </p>
        </div>
      </div>
    );
  }

  const currentExercise = exercises[currentIndex];
  if (!currentExercise) return null;

  return (
    <div className={styles.container}>
      {/* Navigation carousel */}
      <div className={styles.carouselHeader}>
        <span className={styles.carouselTitle}>
          Exercice {currentIndex + 1} / {exercises.length}
        </span>
        <div className={styles.carouselNav}>
          <button
            className={styles.carouselBtn}
            onClick={() => setCurrentIndex((i) => i - 1)}
            disabled={currentIndex === 0}
          >
            ‹
          </button>
          <div className={styles.carouselDots}>
            {exercises.map((_, i) => (
              <div
                key={i}
                className={`${styles.dot} ${i === currentIndex ? styles.dotActive : ''}`}
                onClick={() => setCurrentIndex(i)}
              />
            ))}
          </div>
          <button
            className={styles.carouselBtn}
            onClick={() => setCurrentIndex((i) => i + 1)}
            disabled={currentIndex === exercises.length - 1}
          >
            ›
          </button>
        </div>
      </div>

      {/* Exercice courant */}
      {currentExercise.type === 'text_with_definitions' && (
        <TextWithDefinitions exercise={currentExercise as TextWithDefinitionsExercise} />
      )}
      {currentExercise.type === 'drag_and_drop' && (
        <DragAndDrop exercise={currentExercise as DragAndDropExercise} />
      )}
      {currentExercise.type === 'word_families' && (
        <WordFamilies exercise={currentExercise as WordFamiliesExercise} />
      )}
      {currentExercise.type === 'fill_in_blanks' && (
        <FillInBlanks exercise={currentExercise as FillInBlanksExercise} />
      )}
      {currentExercise.type === 'production_challenge' && (
        <ProductionChallenge
          exercise={currentExercise as ProductionChallengeExercise}
          onValidate={onValidateProduction}
          validation={productionValidation}
          isValidating={isValidatingProduction}
        />
      )}

      {error && <div className={styles.error}>{error}</div>}
    </div>
  );
}
