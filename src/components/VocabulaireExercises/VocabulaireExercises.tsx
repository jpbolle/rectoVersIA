'use client';

import { useState, useCallback } from 'react';
import type {
  VocabulaireExercise,
  TextWithDefinitionsExercise,
  DragAndDropExercise,
  WordFamiliesExercise,
  FillInBlanksExercise,
  ProductionChallengeExercise,
  ProductionValidation,
  DefinitionsExercise,
  SynonymsExercise,
  AntonymsExercise,
  ExerciseResult,
  ContextSentencesExercise,
  FillInBlanksDropdownExercise,
} from '@/types/vocabulaire';
import styles from './VocabulaireExercises.module.css';

// ── Sous-composants exercices ──

function TextWithDefinitions({ exercise }: { exercise: TextWithDefinitionsExercise }) {
  const [hoveredWord, setHoveredWord] = useState<string | null>(null);

  const renderText = () => {
    const sortedWords = [...exercise.highlighted_words].sort(
      (a, b) => b.word.length - a.word.length
    );
    const regex = new RegExp(
      `(${sortedWords.map((w) => w.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
      'gi'
    );
    const segments = exercise.text.split(regex);

    return segments.map((seg, i) => {
      const match = exercise.highlighted_words.find(
        (w) => w.word.toLowerCase() === seg.toLowerCase()
      );
      return match ? (
        <span
          key={i}
          className={styles.highlightedWord}
          onMouseEnter={() => setHoveredWord(seg)}
          onMouseLeave={() => setHoveredWord(null)}
        >
          {seg}
          {hoveredWord === seg && (
            <span className={styles.tooltip}>{match.definition}</span>
          )}
        </span>
      ) : (
        <span key={i}>{seg}</span>
      );
    });
  };

  return (
    <div className={styles.exercise}>
      <h3 className={styles.exerciseTitle}>{exercise.title}</h3>
      <p className={styles.exerciseInstructions}>{exercise.instructions}</p>
      <div className={styles.textContent}>{renderText()}</div>
    </div>
  );
}

function DragAndDrop({
  exercise,
  onResult,
}: {
  exercise: DragAndDropExercise;
  onResult?: (results: { word: string; correct: boolean }[]) => void;
}) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState(false);

  const handleCheck = () => {
    setChecked(true);
    if (onResult) {
      const results = exercise.definitions.map((def) => ({
        word: def.correct_word,
        correct: (answers[def.id] || '').toLowerCase() === def.correct_word.toLowerCase(),
      }));
      onResult(results);
    }
  };

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
                  if (checked) return;
                  setAnswers((prev) => ({ ...prev, [def.id]: e.target.value }));
                }}
                disabled={checked}
              >
                <option value="">Choisir...</option>
                {exercise.words.map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
              {checked && isWrong && (
                <span className={styles.correction}>{def.correct_word}</span>
              )}
            </div>
          );
        })}
      </div>

      {!checked && (
        <button
          className={styles.checkBtn}
          onClick={handleCheck}
          disabled={Object.keys(answers).length === 0}
        >
          Vérifier mes réponses
        </button>
      )}
    </div>
  );
}

function DiagnosticDefinitions({
  exercise,
  onResult,
}: {
  exercise: DefinitionsExercise;
  onResult?: (results: { word: string; correct: boolean }[]) => void;
}) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState(false);

  const handleCheck = () => {
    setChecked(true);
    if (onResult) {
      const results = exercise.answers.map((ans) => ({
        word: ans.correctTerm,
        correct: (answers[ans.definitionId] || '').toLowerCase() === ans.correctTerm.toLowerCase(),
      }));
      onResult(results);
    }
  };

  return (
    <div className={styles.exercise}>
      <h3 className={styles.exerciseTitle}>{exercise.title}</h3>
      <p className={styles.exerciseInstructions}>{exercise.instructions}</p>

      <div className={styles.dndContainer}>
        {exercise.definitions.map((def) => {
          const selected = answers[def.id] || '';
          const isCorrect = checked && selected.toLowerCase() === def.correctTerm.toLowerCase();
          const isWrong = checked && selected && !isCorrect;

          return (
            <div key={def.id} className={styles.dndRow}>
              <div className={styles.dndDefinition}>{def.definition}</div>
              <select
                className={`${styles.dndSelect} ${isCorrect ? styles.dndCorrect : ''} ${isWrong ? styles.dndIncorrect : ''}`}
                value={selected}
                onChange={(e) => {
                  if (checked) return;
                  setAnswers((prev) => ({ ...prev, [def.id]: e.target.value }));
                }}
                disabled={checked}
              >
                <option value="">Choisir...</option>
                {exercise.terms.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              {checked && isWrong && (
                <span className={styles.correction}>{def.correctTerm}</span>
              )}
            </div>
          );
        })}
      </div>

      {!checked && (
        <button
          className={styles.checkBtn}
          onClick={handleCheck}
          disabled={Object.keys(answers).length === 0}
        >
          Vérifier mes réponses
        </button>
      )}
    </div>
  );
}

function DiagnosticPairs({
  exercise,
  type,
  onResult,
}: {
  exercise: SynonymsExercise | AntonymsExercise;
  type: 'synonyms' | 'antonyms';
  onResult?: (results: { word: string; correct: boolean }[]) => void;
}) {
  const [selections, setSelections] = useState<string[]>([]);
  const [pairs, setPairs] = useState<[string, string][]>([]);
  const [checked, setChecked] = useState(false);

  const expectedCount = exercise.answers.length;

  const handleWordClick = (word: string) => {
    if (checked) return;
    if (selections.includes(word)) {
      setSelections((prev) => prev.filter((w) => w !== word));
      return;
    }
    const newSel = [...selections, word];
    if (newSel.length === 2) {
      setPairs((prev) => [...prev, [newSel[0], newSel[1]]]);
      setSelections([]);
    } else {
      setSelections(newSel);
    }
  };

  const isPairCorrect = (pair: [string, string]) => {
    return exercise.answers.some(
      (ans) =>
        (ans.pair[0].toLowerCase() === pair[0].toLowerCase() && ans.pair[1].toLowerCase() === pair[1].toLowerCase()) ||
        (ans.pair[0].toLowerCase() === pair[1].toLowerCase() && ans.pair[1].toLowerCase() === pair[0].toLowerCase())
    );
  };

  const handleCheck = () => {
    setChecked(true);
    if (onResult) {
      const results: { word: string; correct: boolean }[] = [];
      for (const ans of exercise.answers) {
        const found = pairs.some(
          (p) =>
            (p[0].toLowerCase() === ans.pair[0].toLowerCase() && p[1].toLowerCase() === ans.pair[1].toLowerCase()) ||
            (p[0].toLowerCase() === ans.pair[1].toLowerCase() && p[1].toLowerCase() === ans.pair[0].toLowerCase())
        );
        results.push({ word: ans.pair[0], correct: found });
      }
      onResult(results);
    }
  };

  const usedWords = pairs.flat();

  return (
    <div className={styles.exercise}>
      <h3 className={styles.exerciseTitle}>{exercise.title}</h3>
      <p className={styles.exerciseInstructions}>
        {exercise.instructions} — Formez <strong>{expectedCount} paire{expectedCount > 1 ? 's' : ''}</strong>.
      </p>

      <div className={styles.pairsContainer}>
        <div className={styles.pairsWords}>
          {exercise.words.map((w) => {
            const used = usedWords.includes(w);
            const isSelecting = selections.includes(w);
            return (
              <button
                key={w}
                type="button"
                className={`${styles.pairWord} ${used ? styles.pairWordUsed : ''} ${isSelecting ? styles.pairWordSelecting : ''}`}
                onClick={() => handleWordClick(w)}
                disabled={used || checked}
              >
                {w}
              </button>
            );
          })}
        </div>

        {pairs.length > 0 && (
          <div className={styles.pairsList}>
            {pairs.map((pair, i) => {
              const correct = checked ? isPairCorrect(pair) : null;
              return (
                <div
                  key={i}
                  className={`${styles.pairItem} ${correct === true ? styles.pairCorrect : correct === false ? styles.pairIncorrect : ''}`}
                >
                  {pair[0]} ↔ {pair[1]}
                  {!checked && (
                    <button
                      className={styles.pairRemove}
                      onClick={() => {
                        setPairs((prev) => prev.filter((_, j) => j !== i));
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!checked && (
        <button
          className={styles.checkBtn}
          onClick={handleCheck}
          disabled={pairs.length === 0}
        >
          Vérifier mes {type === 'synonyms' ? 'synonymes' : 'antonymes'}
        </button>
      )}

      {checked && (
        <div className={styles.answersReveal}>
          <strong>Réponses attendues :</strong>
          {exercise.answers.map((ans, i) => (
            <span key={i} className={styles.answerItem}>
              {ans.pair[0]} ↔ {ans.pair[1]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ContextSentences({
  exercise,
  onResult,
}: {
  exercise: ContextSentencesExercise;
  onResult?: (results: { word: string; correct: boolean }[]) => void;
}) {
  const [answers, setAnswers] = useState<Record<number, boolean | null>>(
    () => Object.fromEntries(exercise.sentences.map((_, i) => [i, null]))
  );
  const [checked, setChecked] = useState(false);

  const handleCheck = () => {
    setChecked(true);
    if (onResult) {
      const results = exercise.sentences.map((s, i) => ({
        word: s.word,
        correct: answers[i] === s.isCorrect,
      }));
      onResult(results);
    }
  };

  return (
    <div className={styles.exercise}>
      <h3 className={styles.exerciseTitle}>{exercise.title}</h3>
      <p className={styles.exerciseInstructions}>{exercise.instructions}</p>

      <div className={styles.sentencesContainer}>
        {exercise.sentences.map((s, i) => {
          const userAnswer = answers[i];
          const isRight = checked && userAnswer === s.isCorrect;
          const isWrongAnswer = checked && userAnswer !== null && userAnswer !== s.isCorrect;

          return (
            <div key={i} className={`${styles.sentenceRow} ${isRight ? styles.sentenceCorrect : ''} ${isWrongAnswer ? styles.sentenceIncorrect : ''}`}>
              <div className={styles.sentenceText}>
                <span className={styles.sentenceWord}>[{s.word}]</span> {s.sentence}
              </div>
              <div className={styles.sentenceBtns}>
                <button
                  type="button"
                  className={`${styles.sentenceBtn} ${userAnswer === true ? styles.sentenceBtnActive : ''}`}
                  onClick={() => !checked && setAnswers((prev) => ({ ...prev, [i]: true }))}
                  disabled={checked}
                >
                  Correct
                </button>
                <button
                  type="button"
                  className={`${styles.sentenceBtn} ${userAnswer === false ? styles.sentenceBtnActive : ''}`}
                  onClick={() => !checked && setAnswers((prev) => ({ ...prev, [i]: false }))}
                  disabled={checked}
                >
                  Incorrect
                </button>
              </div>
              {checked && isWrongAnswer && (
                <div className={styles.sentenceFeedback}>
                  {s.isCorrect ? 'Cet emploi est correct.' : `Emploi incorrect. ${s.explanation || ''}`}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!checked && (
        <button
          className={styles.checkBtn}
          onClick={handleCheck}
          disabled={Object.values(answers).some((a) => a === null)}
        >
          Vérifier mes réponses
        </button>
      )}
    </div>
  );
}

function FillInBlanksDropdown({
  exercise,
  onResult,
}: {
  exercise: FillInBlanksDropdownExercise;
  onResult?: (results: { word: string; correct: boolean }[]) => void;
}) {
  const [answers, setAnswers] = useState<Record<number, string>>(
    () => Object.fromEntries(exercise.blanks.map((_, i) => [i, '']))
  );
  const [checked, setChecked] = useState(false);

  const handleCheck = () => {
    setChecked(true);
    if (onResult) {
      const results = exercise.blanks.map((blank, i) => ({
        word: blank.correctAnswer,
        correct: (answers[i] || '').toLowerCase() === blank.correctAnswer.toLowerCase(),
      }));
      onResult(results);
    }
  };

  // Construire le texte avec les blancs
  const parts = exercise.text.split(/\{(\d+)\}/g);

  return (
    <div className={styles.exercise}>
      <h3 className={styles.exerciseTitle}>{exercise.title}</h3>
      <p className={styles.exerciseInstructions}>{exercise.instructions}</p>

      <div className={styles.fillBlanksText}>
        {parts.map((part, i) => {
          // Les indices impairs sont les numeros de blancs
          if (i % 2 === 1) {
            const blankIndex = parseInt(part, 10);
            const blank = exercise.blanks[blankIndex];
            if (!blank) return <span key={i}>{part}</span>;
            const isCorrect = checked && (answers[blankIndex] || '').toLowerCase() === blank.correctAnswer.toLowerCase();
            const isWrong = checked && answers[blankIndex] && !isCorrect;
            return (
              <select
                key={i}
                className={`${styles.blankDropdown} ${isCorrect ? styles.blankCorrect : ''} ${isWrong ? styles.blankIncorrect : ''}`}
                value={answers[blankIndex] || ''}
                onChange={(e) => {
                  if (checked) return;
                  setAnswers((prev) => ({ ...prev, [blankIndex]: e.target.value }));
                }}
                disabled={checked}
              >
                <option value="">...</option>
                {blank.options.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </div>

      {!checked && (
        <button
          className={styles.checkBtn}
          onClick={handleCheck}
          disabled={Object.values(answers).some((a) => !a)}
        >
          Vérifier mes réponses
        </button>
      )}
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

function FillInBlanks({
  exercise,
  onResult,
}: {
  exercise: FillInBlanksExercise;
  onResult?: (results: { word: string; correct: boolean }[]) => void;
}) {
  const [answers, setAnswers] = useState<string[]>(
    new Array(exercise.answers.length).fill('')
  );
  const [checked, setChecked] = useState(false);

  const parts = exercise.text_with_blanks.split(/_{3,}|___/);

  const handleCheck = () => {
    setChecked(true);
    if (onResult) {
      const results = exercise.answers.map((correctAnswer, i) => ({
        word: correctAnswer,
        correct: (answers[i] || '').toLowerCase().trim() === correctAnswer.toLowerCase().trim(),
      }));
      onResult(results);
    }
  };

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
                  if (checked) return;
                  const newAnswers = [...answers];
                  newAnswers[i] = e.target.value;
                  setAnswers(newAnswers);
                }}
                disabled={checked}
                placeholder="..."
              />
            )}
          </span>
        ))}
      </div>

      {checked && (
        <div className={styles.answersReveal}>
          {exercise.answers.map((ans, i) => (
            <span key={i} className={styles.answerItem}>
              {i + 1}. <strong>{ans}</strong>
              {answers[i]?.toLowerCase().trim() === ans.toLowerCase().trim() ? ' ✓' : ' ✗'}
            </span>
          ))}
        </div>
      )}

      {!checked && (
        <button
          className={styles.checkBtn}
          onClick={handleCheck}
          disabled={answers.every((a) => !a.trim())}
        >
          Vérifier mes réponses
        </button>
      )}
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
          placeholder="Écris ta phrase ici..."
          disabled={isValidating}
        />

        <button
          className={styles.validateBtn}
          onClick={() => onValidate(text)}
          disabled={!text.trim() || isValidating}
        >
          {isValidating ? 'Évaluation en cours...' : 'Valider ma production'}
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
// FIX: Tous les exercices restent montes (display:none) pour conserver les reponses

interface VocabulaireExercisesProps {
  exercises: VocabulaireExercise[];
  isGenerating: boolean;
  error: string | null;
  onGenerate: () => void;
  onValidateProduction: (text: string) => void;
  productionValidation: ProductionValidation | null;
  isValidatingProduction: boolean;
  canGenerate: boolean;
  onExerciseResult?: (result: ExerciseResult) => void;
  onDiagnosticComplete?: () => void;
  phase: 'diagnostic' | 'learning' | 'evaluation';
}

export default function VocabulaireExercises({
  exercises,
  isGenerating,
  error,
  onGenerate,
  onValidateProduction,
  productionValidation,
  isValidatingProduction,
  canGenerate,
  onExerciseResult,
  onDiagnosticComplete,
  phase,
}: VocabulaireExercisesProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedExercises, setCompletedExercises] = useState<Set<number>>(new Set());

  const handleResult = useCallback((exerciseIndex: number, results: { word: string; correct: boolean }[]) => {
    if (completedExercises.has(exerciseIndex)) return;
    setCompletedExercises((prev) => new Set([...prev, exerciseIndex]));

    const exercise = exercises[exerciseIndex];
    if (!exercise) return;

    onExerciseResult?.({
      exerciseIndex,
      wordsTested: results.map((r) => r.word),
      results,
    });
  }, [exercises, onExerciseResult, completedExercises]);

  // Exercices qui necessitent une verification (pas lecture seule)
  const gradableExercises = exercises.filter(
    (e) => e.type !== 'text_with_definitions' && e.type !== 'word_families'
  );
  const allCompleted = gradableExercises.length > 0 &&
    gradableExercises.every((_, i) => {
      const realIndex = exercises.indexOf(gradableExercises[i]);
      return completedExercises.has(realIndex);
    });

  // Etat vide
  if (exercises.length === 0 && !isGenerating) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📝</div>
          <h3 className={styles.emptyTitle}>Exercices de vocabulaire</h3>
          <p className={styles.emptyDescription}>
            {phase === 'diagnostic'
              ? 'Sélectionne les mots que tu penses connaître puis clique pour vérifier.'
              : phase === 'evaluation'
              ? 'Lance l\'évaluation pour tester tous les mots.'
              : 'Sélectionne 6 à 10 mots puis génère les exercices.'}
          </p>
          <button
            className={styles.generateBtn}
            onClick={onGenerate}
            disabled={!canGenerate}
          >
            Générer les exercices
          </button>
          {error && <div className={styles.error}>{error}</div>}
        </div>
      </div>
    );
  }

  // Generation en cours
  if (isGenerating) {
    return (
      <div className={styles.container}>
        <div className={styles.generating}>
          <div className={styles.spinner} />
          <p>Génération des exercices en cours...</p>
          <p style={{ fontSize: 12, color: 'var(--c-text-dim)' }}>
            Cela peut prendre quelques secondes
          </p>
        </div>
      </div>
    );
  }

  // Render un exercice (tous montes, visibilite par CSS)
  const renderExercise = (exercise: VocabulaireExercise, index: number) => {
    const isVisible = index === currentIndex;
    const wrapperStyle = { display: isVisible ? 'block' : 'none' };

    return (
      <div key={index} style={wrapperStyle}>
        {exercise.type === 'text_with_definitions' && (
          <TextWithDefinitions exercise={exercise} />
        )}
        {exercise.type === 'drag_and_drop' && (
          <DragAndDrop
            exercise={exercise}
            onResult={(results) => handleResult(index, results)}
          />
        )}
        {exercise.type === 'definitions' && (
          <DiagnosticDefinitions
            exercise={exercise}
            onResult={(results) => handleResult(index, results)}
          />
        )}
        {exercise.type === 'synonyms' && (
          <DiagnosticPairs
            exercise={exercise}
            type="synonyms"
            onResult={(results) => handleResult(index, results)}
          />
        )}
        {exercise.type === 'antonyms' && (
          <DiagnosticPairs
            exercise={exercise}
            type="antonyms"
            onResult={(results) => handleResult(index, results)}
          />
        )}
        {exercise.type === 'context_sentences' && (
          <ContextSentences
            exercise={exercise}
            onResult={(results) => handleResult(index, results)}
          />
        )}
        {exercise.type === 'fill_in_blanks_dropdown' && (
          <FillInBlanksDropdown
            exercise={exercise}
            onResult={(results) => handleResult(index, results)}
          />
        )}
        {exercise.type === 'word_families' && (
          <WordFamilies exercise={exercise} />
        )}
        {exercise.type === 'fill_in_blanks' && (
          <FillInBlanks
            exercise={exercise}
            onResult={(results) => handleResult(index, results)}
          />
        )}
        {exercise.type === 'production_challenge' && (
          <ProductionChallenge
            exercise={exercise}
            onValidate={onValidateProduction}
            validation={productionValidation}
            isValidating={isValidatingProduction}
          />
        )}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      {/* Tous les exercices montes (pour conserver les reponses) */}
      <div className={styles.exercisesWrapper}>
        {exercises.map((exercise, index) => renderExercise(exercise, index))}
      </div>

      {/* Navigation en bas */}
      <div className={styles.bottomNav}>
        {/* Dots */}
        <div className={styles.carouselDots}>
          {exercises.map((_, i) => (
            <div
              key={i}
              className={`${styles.dot} ${i === currentIndex ? styles.dotActive : ''} ${completedExercises.has(i) ? styles.dotCompleted : ''}`}
              onClick={() => setCurrentIndex(i)}
            />
          ))}
        </div>

        {/* Fleches + compteur */}
        <div className={styles.navRight}>
          <span className={styles.navCounter}>
            {currentIndex + 1} / {exercises.length}
          </span>
          <button
            className={styles.navBtn}
            onClick={() => setCurrentIndex((i) => i - 1)}
            disabled={currentIndex === 0}
          >
            ‹
          </button>
          <button
            className={styles.navBtn}
            onClick={() => setCurrentIndex((i) => i + 1)}
            disabled={currentIndex === exercises.length - 1}
          >
            ›
          </button>
        </div>
      </div>

      {/* Bouton fin de diagnostic */}
      {allCompleted && onDiagnosticComplete && (
        <div className={styles.diagnosticCompleteBar}>
          <button
            type="button"
            className={styles.diagnosticCompleteBtn}
            onClick={onDiagnosticComplete}
          >
            Début de l&apos;apprentissage
          </button>
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}
    </div>
  );
}
