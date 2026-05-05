'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
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
      <div className={styles.textContentQuote}>{renderText()}</div>
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
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState<Set<number>>(new Set());
  const revealed = attempts >= 3;

  const handleCheck = () => {
    const newAttempt = attempts + 1;
    setAttempts(newAttempt);
    const newLocked = new Set(locked);
    let allCorrect = true;
    for (const def of exercise.definitions) {
      if ((answers[def.id] || '').toLowerCase() === def.correct_word.toLowerCase()) {
        newLocked.add(def.id);
      } else {
        allCorrect = false;
      }
    }
    setLocked(newLocked);
    // Notifier des la 1re tentative (handleResult ignore les doublons)
    {
      if (onResult) {
        onResult(exercise.definitions.map((def) => ({
          word: def.correct_word,
          correct: newLocked.has(def.id),
        })));
      }
    }
  };

  const done = revealed || locked.size === exercise.definitions.length;

  return (
    <div className={styles.exercise}>
      <h3 className={styles.exerciseTitle}>{exercise.title}</h3>
      <p className={styles.exerciseInstructions}>{exercise.instructions}</p>

      <div className={styles.dndContainerIndented}>
        {exercise.definitions.map((def) => {
          const selected = answers[def.id] || '';
          const isLocked = locked.has(def.id);
          const isWrong = attempts > 0 && !isLocked && selected;

          return (
            <div key={def.id} className={styles.dndRowCompact}>
              <div className={styles.dndDefinition}>{def.definition}</div>
              <select
                className={`${styles.dndSelect} ${isLocked ? styles.dndCorrect : ''} ${isWrong ? styles.dndIncorrect : ''}`}
                value={selected}
                onChange={(e) => {
                  if (isLocked || done) return;
                  setAnswers((prev) => ({ ...prev, [def.id]: e.target.value }));
                }}
                disabled={isLocked || done}
              >
                <option value="">Choisir...</option>
                {exercise.words.map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
              {revealed && !isLocked && (
                <span className={styles.correction}>{def.correct_word}</span>
              )}
            </div>
          );
        })}
      </div>

      {!done && (
        <button
          className={styles.checkBtn}
          onClick={handleCheck}
          disabled={Object.keys(answers).length === 0}
        >
          {attempts === 0 ? 'Vérifier mes réponses' : `Réessayer (${3 - attempts} tentative${3 - attempts > 1 ? 's' : ''} restante${3 - attempts > 1 ? 's' : ''})`}
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
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState<Set<number>>(new Set());
  const revealed = attempts >= 3;

  const handleCheck = () => {
    const newAttempt = attempts + 1;
    setAttempts(newAttempt);
    const newLocked = new Set(locked);
    let allCorrect = true;
    for (const def of exercise.definitions) {
      if ((answers[def.id] || '').toLowerCase() === def.correctTerm.toLowerCase()) {
        newLocked.add(def.id);
      } else {
        allCorrect = false;
      }
    }
    setLocked(newLocked);
    // Notifier des la 1re tentative (handleResult ignore les doublons)
    {
      if (onResult) {
        onResult(exercise.answers.map((ans) => ({
          word: ans.correctTerm,
          correct: newLocked.has(ans.definitionId),
        })));
      }
    }
  };

  const done = revealed || locked.size === exercise.definitions.length;

  return (
    <div className={styles.exercise}>
      <h3 className={styles.exerciseTitle}>{exercise.title}</h3>
      <p className={styles.exerciseInstructions}>{exercise.instructions}</p>

      <div className={styles.dndContainer}>
        {exercise.definitions.map((def) => {
          const selected = answers[def.id] || '';
          const isLocked = locked.has(def.id);
          const isWrong = attempts > 0 && !isLocked && selected;

          return (
            <div key={def.id} className={styles.dndRow}>
              <div className={styles.dndDefinition}>{def.definition}</div>
              <select
                className={`${styles.dndSelect} ${isLocked ? styles.dndCorrect : ''} ${isWrong ? styles.dndIncorrect : ''}`}
                value={selected}
                onChange={(e) => {
                  if (isLocked || done) return;
                  setAnswers((prev) => ({ ...prev, [def.id]: e.target.value }));
                }}
                disabled={isLocked || done}
              >
                <option value="">Choisir...</option>
                {exercise.terms.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              {revealed && !isLocked && (
                <span className={styles.correction}>{def.correctTerm}</span>
              )}
            </div>
          );
        })}
      </div>

      {!done && (
        <button
          className={styles.checkBtn}
          onClick={handleCheck}
          disabled={Object.keys(answers).length === 0}
        >
          {attempts === 0 ? 'Vérifier mes réponses' : `Réessayer (${3 - attempts} tentative${3 - attempts > 1 ? 's' : ''} restante${3 - attempts > 1 ? 's' : ''})`}
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
  const [attempts, setAttempts] = useState(0);
  const [lockedPairs, setLockedPairs] = useState<Set<number>>(new Set());
  const revealed = attempts >= 3;

  const expectedCount = exercise.answers.length;

  const isPairCorrect = (pair: [string, string]) => {
    return exercise.answers.some(
      (ans) =>
        (ans.pair[0].toLowerCase() === pair[0].toLowerCase() && ans.pair[1].toLowerCase() === pair[1].toLowerCase()) ||
        (ans.pair[0].toLowerCase() === pair[1].toLowerCase() && ans.pair[1].toLowerCase() === pair[0].toLowerCase())
    );
  };

  const handleWordClick = (word: string) => {
    if (revealed) return;
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

  const handleCheck = () => {
    const newAttempt = attempts + 1;
    setAttempts(newAttempt);
    const newLocked = new Set(lockedPairs);
    let allCorrect = true;
    const wrongIndices: number[] = [];
    for (let i = 0; i < pairs.length; i++) {
      if (lockedPairs.has(i)) continue;
      if (isPairCorrect(pairs[i])) {
        newLocked.add(i);
      } else {
        allCorrect = false;
        wrongIndices.push(i);
      }
    }
    setLockedPairs(newLocked);
    // Retirer les paires fausses pour laisser l'eleve recommencer
    if (!allCorrect && newAttempt < 3) {
      setPairs((prev) => prev.filter((_, i) => !wrongIndices.includes(i)));
      // Recalculer locked indices apres filtrage
      const keptPairs = pairs.filter((_, i) => !wrongIndices.includes(i));
      const newLockedAfterFilter = new Set<number>();
      keptPairs.forEach((_, i) => { if (newLocked.has(pairs.indexOf(keptPairs[i]))) newLockedAfterFilter.add(i); });
      // Simplifier : marquer les paires restantes comme locked si elles etaient locked
      const finalLocked = new Set<number>();
      let idx = 0;
      for (let i = 0; i < pairs.length; i++) {
        if (wrongIndices.includes(i)) continue;
        if (newLocked.has(i)) finalLocked.add(idx);
        idx++;
      }
      setLockedPairs(finalLocked);
    }
    // Notifier des la 1re tentative (handleResult ignore les doublons)
    {
      if (onResult) {
        const results: { word: string; correct: boolean }[] = [];
        for (const ans of exercise.answers) {
          const found = pairs.some((p) =>
            (p[0].toLowerCase() === ans.pair[0].toLowerCase() && p[1].toLowerCase() === ans.pair[1].toLowerCase()) ||
            (p[0].toLowerCase() === ans.pair[1].toLowerCase() && p[1].toLowerCase() === ans.pair[0].toLowerCase())
          );
          results.push({ word: ans.pair[0], correct: found });
        }
        onResult(results);
      }
    }
  };

  const done = revealed || lockedPairs.size === expectedCount;
  const usedWords = pairs.flat();
  // Mots utilises par des paires locked (pas re-utilisables)
  const lockedWords = pairs.filter((_, i) => lockedPairs.has(i)).flat();

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
            const isLocked = lockedWords.includes(w);
            const isSelecting = selections.includes(w);
            return (
              <button
                key={w}
                type="button"
                className={`${styles.pairWord} ${used ? styles.pairWordUsed : ''} ${isSelecting ? styles.pairWordSelecting : ''}`}
                onClick={() => handleWordClick(w)}
                disabled={isLocked || done || (used && !isLocked)}
              >
                {w}
              </button>
            );
          })}
        </div>

        {pairs.length > 0 && (
          <div className={styles.pairsList}>
            {pairs.map((pair, i) => {
              const isLocked = lockedPairs.has(i);
              return (
                <div
                  key={i}
                  className={`${styles.pairItem} ${isLocked ? styles.pairCorrect : (attempts > 0 ? styles.pairIncorrect : '')}`}
                >
                  {pair[0]} ↔ {pair[1]}
                  {!done && !isLocked && (
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

      {!done && (
        <button
          className={styles.checkBtn}
          onClick={handleCheck}
          disabled={pairs.length === 0}
        >
          {attempts === 0
            ? `Vérifier mes ${type === 'synonyms' ? 'synonymes' : 'antonymes'}`
            : `Réessayer (${3 - attempts} tentative${3 - attempts > 1 ? 's' : ''} restante${3 - attempts > 1 ? 's' : ''})`}
        </button>
      )}

      {revealed && (
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
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState<Set<number>>(new Set());
  const revealed = attempts >= 3;

  const handleCheck = () => {
    const newAttempt = attempts + 1;
    setAttempts(newAttempt);
    const newLocked = new Set(locked);
    let allCorrect = true;
    for (let i = 0; i < exercise.sentences.length; i++) {
      if (answers[i] === exercise.sentences[i].isCorrect) {
        newLocked.add(i);
      } else {
        allCorrect = false;
      }
    }
    setLocked(newLocked);
    // Notifier des la 1re tentative (handleResult ignore les doublons)
    {
      if (onResult) {
        onResult(exercise.sentences.map((s, i) => ({
          word: s.word,
          correct: newLocked.has(i),
        })));
      }
    }
  };

  const done = revealed || locked.size === exercise.sentences.length;

  return (
    <div className={styles.exercise}>
      <h3 className={styles.exerciseTitle}>{exercise.title}</h3>
      <p className={styles.exerciseInstructions}>{exercise.instructions}</p>

      <div className={styles.sentencesContainer}>
        {exercise.sentences.map((s, i) => {
          const userAnswer = answers[i];
          const isLocked = locked.has(i);
          const isWrong = attempts > 0 && !isLocked && userAnswer !== null;

          return (
            <div key={i} className={`${styles.sentenceRow} ${isLocked ? styles.sentenceCorrect : ''} ${isWrong ? styles.sentenceIncorrect : ''}`}>
              <div className={styles.sentenceText}>
                <span className={styles.sentenceWord}>[{s.word}]</span> {s.sentence}
              </div>
              <div className={styles.sentenceBtns}>
                <button
                  type="button"
                  className={`${styles.sentenceBtn} ${userAnswer === true ? styles.sentenceBtnActive : ''}`}
                  onClick={() => !(isLocked || done) && setAnswers((prev) => ({ ...prev, [i]: true }))}
                  disabled={isLocked || done}
                >
                  Correct
                </button>
                <button
                  type="button"
                  className={`${styles.sentenceBtn} ${userAnswer === false ? styles.sentenceBtnActive : ''}`}
                  onClick={() => !(isLocked || done) && setAnswers((prev) => ({ ...prev, [i]: false }))}
                  disabled={isLocked || done}
                >
                  Incorrect
                </button>
              </div>
              {revealed && !isLocked && (
                <div className={styles.sentenceFeedback}>
                  {s.isCorrect ? 'Cet emploi est correct.' : `Emploi incorrect. ${s.explanation || ''}`}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!done && (
        <button
          className={styles.checkBtn}
          onClick={handleCheck}
          disabled={Object.values(answers).some((a) => a === null)}
        >
          {attempts === 0 ? 'Vérifier mes réponses' : `Réessayer (${3 - attempts} tentative${3 - attempts > 1 ? 's' : ''} restante${3 - attempts > 1 ? 's' : ''})`}
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
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState<Set<number>>(new Set());
  const revealed = attempts >= 3;

  const handleCheck = () => {
    const newAttempt = attempts + 1;
    setAttempts(newAttempt);
    const newLocked = new Set(locked);
    let allCorrect = true;
    for (let i = 0; i < exercise.blanks.length; i++) {
      if ((answers[i] || '').toLowerCase() === exercise.blanks[i].correctAnswer.toLowerCase()) {
        newLocked.add(i);
      } else {
        allCorrect = false;
      }
    }
    setLocked(newLocked);
    // Notifier des la 1re tentative (handleResult ignore les doublons)
    {
      if (onResult) {
        onResult(exercise.blanks.map((blank, i) => ({
          word: blank.correctAnswer,
          correct: newLocked.has(i),
        })));
      }
    }
  };

  const done = revealed || locked.size === exercise.blanks.length;
  const parts = exercise.text.split(/\{(\d+)\}/g);

  return (
    <div className={styles.exercise}>
      <h3 className={styles.exerciseTitle}>{exercise.title}</h3>
      <p className={styles.exerciseInstructions}>{exercise.instructions}</p>

      <div className={styles.fillBlanksText}>
        {parts.map((part, i) => {
          if (i % 2 === 1) {
            const blankIndex = parseInt(part, 10);
            const blank = exercise.blanks[blankIndex];
            if (!blank) return <span key={i}>{part}</span>;
            const isLocked = locked.has(blankIndex);
            const isWrong = attempts > 0 && !isLocked && answers[blankIndex];
            return (
              <span key={i} className={styles.blankInline}>
                <select
                  className={`${styles.blankDropdown} ${isLocked ? styles.blankCorrect : ''} ${isWrong ? styles.blankIncorrect : ''}`}
                  value={answers[blankIndex] || ''}
                  onChange={(e) => {
                    if (isLocked || done) return;
                    setAnswers((prev) => ({ ...prev, [blankIndex]: e.target.value }));
                  }}
                  disabled={isLocked || done}
                >
                  <option value="">...</option>
                  {blank.options.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                {revealed && !isLocked && (
                  <span className={styles.blankCorrectionInline}>→ {blank.correctAnswer}</span>
                )}
              </span>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </div>

      {!done && (
        <button
          className={styles.checkBtn}
          onClick={handleCheck}
          disabled={Object.values(answers).some((a) => !a)}
        >
          {attempts === 0 ? 'Vérifier mes réponses' : `Réessayer (${3 - attempts} tentative${3 - attempts > 1 ? 's' : ''} restante${3 - attempts > 1 ? 's' : ''})`}
        </button>
      )}
    </div>
  );
}

function WordFamilies({ exercise }: { exercise: WordFamiliesExercise }) {
  const [openWord, setOpenWord] = useState<string | null>(
    exercise.word_schemas[0]?.central_word || null
  );

  return (
    <div className={styles.exercise}>
      <h3 className={styles.exerciseTitle}>{exercise.title}</h3>
      <p className={styles.exerciseInstructions}>{exercise.instructions}</p>

      <div className={styles.familyContainer}>
        {exercise.word_schemas.map((schema) => {
          const isOpen = openWord === schema.central_word;
          return (
            <div key={schema.central_word} className={styles.familyAccordion}>
              <button
                type="button"
                className={`${styles.familyCentralWord} ${isOpen ? styles.familyCentralWordOpen : ''}`}
                onClick={() => setOpenWord(isOpen ? null : schema.central_word)}
              >
                <span>{schema.central_word}</span>
                <span className={styles.familyChevron}>{isOpen ? '▾' : '▸'}</span>
              </button>
              {isOpen && (
                <div className={styles.familyTree}>
                  {/* Noeud racine */}
                  <div className={styles.treeRoot}>{schema.central_word}</div>
                  {/* Tronc */}
                  <div className={styles.treeTrunk} />
                  {/* 3 branches */}
                  <div className={styles.treeBranches}>
                    {/* Famille */}
                    <div className={`${styles.treeBranch} ${styles.treeBranchFamily}`}>
                      <div className={`${styles.treeBranchTitle} ${styles.treeTitleFamily}`}>Famille</div>
                      <div className={styles.treeBranchWords}>
                        {schema.family_branch.map((w, i) => (
                          <span key={i} className={`${styles.treeWord} ${styles.treeWordFamily}`}>{w}</span>
                        ))}
                      </div>
                    </div>
                    {/* Synonymes */}
                    <div className={`${styles.treeBranch} ${styles.treeBranchSynonyms}`}>
                      <div className={`${styles.treeBranchTitle} ${styles.treeTitleSynonyms}`}>Synonymes</div>
                      <div className={styles.treeBranchWords}>
                        {schema.synonyms_branch.map((w, i) => (
                          <span key={i} className={`${styles.treeWord} ${styles.treeWordSynonyms}`}>{w}</span>
                        ))}
                      </div>
                    </div>
                    {/* Antonymes */}
                    <div className={`${styles.treeBranch} ${styles.treeBranchAntonyms}`}>
                      <div className={`${styles.treeBranchTitle} ${styles.treeTitleAntonyms}`}>Antonymes</div>
                      <div className={styles.treeBranchWords}>
                        {schema.antonyms_branch.map((w, i) => (
                          <span key={i} className={`${styles.treeWord} ${styles.treeWordAntonyms}`}>{w}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
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
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState<Set<number>>(new Set());
  const [hints, setHints] = useState<Set<number>>(new Set());
  const revealed = attempts >= 3;

  const parts = exercise.text_with_blanks.split(/_{3,}|___/);

  const handleCheck = () => {
    const newAttempt = attempts + 1;
    setAttempts(newAttempt);
    const newLocked = new Set(locked);
    let allCorrect = true;
    for (let i = 0; i < exercise.answers.length; i++) {
      if ((answers[i] || '').toLowerCase().trim() === exercise.answers[i].toLowerCase().trim()) {
        newLocked.add(i);
      } else {
        allCorrect = false;
      }
    }
    setLocked(newLocked);
    // Notifier des la 1re tentative (handleResult ignore les doublons)
    {
      if (onResult) {
        onResult(exercise.answers.map((correctAnswer, i) => ({
          word: correctAnswer,
          correct: newLocked.has(i),
        })));
      }
    }
  };

  const showHint = (index: number) => {
    if (hints.has(index)) return;
    setHints((prev) => new Set([...prev, index]));
    if (!answers[index]) {
      const newAnswers = [...answers];
      newAnswers[index] = exercise.answers[index][0];
      setAnswers(newAnswers);
    }
  };

  const done = revealed || locked.size === exercise.answers.length;

  return (
    <div className={styles.exercise}>
      <h3 className={styles.exerciseTitle}>{exercise.title}</h3>
      <p className={styles.exerciseInstructions}>{exercise.instructions}</p>

      <div className={styles.fillBlanksText}>
        {parts.map((part, i) => (
          <span key={i}>
            {part}
            {i < parts.length - 1 && i < exercise.answers.length && (
              <span className={styles.blankGroup}>
                <input
                  type="text"
                  className={`${styles.blankInput} ${
                    locked.has(i) ? styles.blankCorrect :
                    (attempts > 0 && !locked.has(i) && answers[i]?.trim()) ? styles.blankIncorrect : ''
                  }`}
                  value={answers[i] || ''}
                  onChange={(e) => {
                    if (locked.has(i) || done) return;
                    const newAnswers = [...answers];
                    newAnswers[i] = e.target.value;
                    setAnswers(newAnswers);
                  }}
                  disabled={locked.has(i) || done}
                  placeholder="..."
                />
                {!done && !locked.has(i) && !hints.has(i) && (
                  <button
                    type="button"
                    className={styles.hintBtn}
                    onClick={() => showHint(i)}
                    title="Indice : première lettre"
                  >
                    i
                  </button>
                )}
                {revealed && !locked.has(i) && (
                  <span className={styles.blankCorrectionInline}>→ {exercise.answers[i]}</span>
                )}
              </span>
            )}
          </span>
        ))}
      </div>

      {!done && (
        <button
          className={styles.checkBtn}
          onClick={handleCheck}
          disabled={answers.every((a) => !a.trim())}
        >
          {attempts === 0 ? 'Vérifier mes réponses' : `Réessayer (${3 - attempts} tentative${3 - attempts > 1 ? 's' : ''} restante${3 - attempts > 1 ? 's' : ''})`}
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
  onAllCompleted?: (completed: boolean) => void;
  onBackToRecto?: () => void;
  onIntermediateDiagnostic?: () => void;
  onEvaluation?: () => void;
  // Mode "diagnostic intermediaire termine" : remplace le bouton "Debut de l'apprentissage"
  // par 3 boutons (Retour a la liste / Evaluation / Etat de mes connaissances)
  intermediateDiagnosticMode?: boolean;
  onShowKnowledgeTab?: () => void;
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
  onAllCompleted,
  onBackToRecto,
  onIntermediateDiagnostic,
  onEvaluation,
  intermediateDiagnosticMode = false,
  onShowKnowledgeTab,
}: VocabulaireExercisesProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedExercises, setCompletedExercises] = useState<Set<number>>(new Set());

  // Reset quand les exercices changent (regeneration = nouvelle reference)
  const exercisesRef = useRef(exercises);
  useEffect(() => {
    if (exercises !== exercisesRef.current) {
      exercisesRef.current = exercises;
      setCompletedExercises(new Set());
      setCurrentIndex(0);
    }
  }, [exercises]);

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

  // Exercices qui necessitent une action (pas lecture seule)
  const gradableExercises = exercises.filter(
    (e) => e.type !== 'text_with_definitions' && e.type !== 'word_families'
  );
  const allCompleted = gradableExercises.length > 0 &&
    gradableExercises.every((_, i) => {
      const realIndex = exercises.indexOf(gradableExercises[i]);
      return completedExercises.has(realIndex);
    });

  // Marquer production_challenge comme complete quand validation recue
  useEffect(() => {
    if (productionValidation) {
      const prodIndex = exercises.findIndex((e) => e.type === 'production_challenge');
      if (prodIndex >= 0 && !completedExercises.has(prodIndex)) {
        setCompletedExercises((prev) => new Set([...prev, prodIndex]));
      }
    }
  }, [productionValidation, exercises, completedExercises]);

  // Notifier le parent quand tous les exercices sont completes
  useEffect(() => {
    onAllCompleted?.(allCompleted);
  }, [allCompleted, onAllCompleted]);

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
      <div key={index} style={wrapperStyle} className={styles.exerciseSlide}>
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
      <div className={styles.exercisesWrapper}>
        {/* Exercice visible avec bordure + nav au milieu du bas */}
        <div className={styles.exerciseFrame}>
          {exercises.map((exercise, index) => renderExercise(exercise, index))}

          {/* Nav qui brise la bordure basse au centre */}
          <div className={styles.borderNav}>
            <button
              className={styles.navBtn}
              onClick={() => setCurrentIndex((i) => i - 1)}
              disabled={currentIndex === 0}
            >
              ‹
            </button>
            <div className={styles.carouselDots}>
              {exercises.map((_, i) => (
                <div
                  key={i}
                  className={`${styles.dot} ${i === currentIndex ? styles.dotActive : ''} ${completedExercises.has(i) ? styles.dotCompleted : ''}`}
                  onClick={() => setCurrentIndex(i)}
                />
              ))}
            </div>
            <span className={styles.navCounter}>
              {currentIndex + 1} / {exercises.length}
            </span>
            <button
              className={styles.navBtn}
              onClick={() => setCurrentIndex((i) => i + 1)}
              disabled={currentIndex === exercises.length - 1}
            >
              ›
            </button>
          </div>
        </div>

        {/* Actions apres completion de tous les exercices */}
        {/* Convention de couleurs : VERT (primary) = genere du contenu — AMBER (accent) = affiche du contenu. */}
        {allCompleted && intermediateDiagnosticMode && onDiagnosticComplete ? (
          /* Fin de diagnostic intermediaire — action bar 100px */
          <div className={styles.actionBar}>
            <span className={styles.actionBarLine} />
            <div className={styles.actionBarRow}>
              {/* Verts (genere) */}
              {onEvaluation && (
                <button
                  type="button"
                  className={`${styles.actionBarBtn} ${styles.actionBarBtnPrimary}`}
                  onClick={onEvaluation}
                >
                  Évaluation
                </button>
              )}
              {/* Ambers (affiche / navigation) */}
              <button
                type="button"
                className={`${styles.actionBarBtn} ${styles.actionBarBtnAmber}`}
                onClick={onDiagnosticComplete}
              >
                Retour à la liste
              </button>
              {onShowKnowledgeTab && (
                <button
                  type="button"
                  className={`${styles.actionBarBtn} ${styles.actionBarBtnAmber}`}
                  onClick={onShowKnowledgeTab}
                >
                  État de mes connaissances
                </button>
              )}
            </div>
            <span className={styles.actionBarLine} />
          </div>
        ) : allCompleted && onDiagnosticComplete ? (
          /* Fin du diagnostic initial — bouton unique de navigation (amber) */
          <div className={styles.actionBar}>
            <span className={styles.actionBarLine} />
            <div className={styles.actionBarRow}>
              <button
                type="button"
                className={`${styles.actionBarBtn} ${styles.actionBarBtnAmber}`}
                onClick={onDiagnosticComplete}
              >
                Début de l&apos;apprentissage
              </button>
            </div>
            <span className={styles.actionBarLine} />
          </div>
        ) : allCompleted && (
          /* Fin de session d'apprentissage — action bar 130px */
          <div className={`${styles.actionBar} ${styles.actionBarSpacing130}`}>
            <span className={styles.actionBarLine} />
            <div className={styles.actionBarRow}>
              {/* Verts (genere) */}
              <button
                type="button"
                className={`${styles.actionBarBtn} ${styles.actionBarBtnPrimary}`}
                onClick={onGenerate}
              >
                Régénérer les exercices
              </button>
              {onIntermediateDiagnostic && (
                <button
                  type="button"
                  className={`${styles.actionBarBtn} ${styles.actionBarBtnPrimary}`}
                  onClick={onIntermediateDiagnostic}
                >
                  Diagnostic intermédiaire
                </button>
              )}
              {onEvaluation && (
                <button
                  type="button"
                  className={`${styles.actionBarBtn} ${styles.actionBarBtnPrimary}`}
                  onClick={onEvaluation}
                >
                  Évaluation
                </button>
              )}
              {/* Ambers (affiche / navigation) */}
              {onBackToRecto && (
                <button
                  type="button"
                  className={`${styles.actionBarBtn} ${styles.actionBarBtnAmber}`}
                  onClick={onBackToRecto}
                >
                  Retour à la liste
                </button>
              )}
              {onShowKnowledgeTab && (
                <button
                  type="button"
                  className={`${styles.actionBarBtn} ${styles.actionBarBtnAmber}`}
                  onClick={onShowKnowledgeTab}
                >
                  État de mes connaissances
                </button>
              )}
            </div>
            <span className={styles.actionBarLine} />
          </div>
        )}

        {error && <div className={styles.error}>{error}</div>}
      </div>
    </div>
  );
}
