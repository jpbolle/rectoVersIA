'use client';

import type { EvaluationAttempt } from '@/types/vocabulaire';
import { removeAccents } from '@/types/vocabulaire';
import styles from './EvalAttemptView.module.css';

interface EvalAttemptViewProps {
  attempt: EvaluationAttempt;
}

export default function EvalAttemptView({ attempt }: EvalAttemptViewProps) {
  const {
    crossword,
    synonymAntonymText,
    composition,
    crosswordAnswers,
    synAntAnswers,
    compositionText,
    crosswordCorrections,
    synAntCorrections,
    compositionValidation,
    score,
  } = attempt;

  return (
    <div className={styles.evalAttempt}>
      {/* Score global */}
      <div className={styles.evalScoreBanner}>
        <span className={styles.evalScoreValue}>{score.percentage}%</span>
        <span className={styles.evalScoreDetail}>
          ({score.totalCorrect}/{score.totalPossible})
        </span>
      </div>

      {/* Activite 1 : Mots croises */}
      <div className={styles.evalActivity}>
        <h5 className={styles.evalActivityTitle}>
          Mots croisés
          <span className={styles.evalActivityScore}>
            {score.crosswordScore.correct}/{score.crosswordScore.total}
          </span>
        </h5>
        <div className={styles.evalWordList}>
          {crossword.words.map((word) => {
            let isCorrect = true;
            const letters: string[] = [];
            const expected = removeAccents(word.answer).toUpperCase();
            for (let i = 0; i < word.answer.length; i++) {
              const row = word.orientation === 'down' ? word.starty + i : word.starty;
              const col = word.orientation === 'across' ? word.startx + i : word.startx;
              const key = `${row}-${col}`;
              const letter = crosswordAnswers[key] || '_';
              letters.push(letter);
              if (crosswordCorrections[key] === 'incorrect') isCorrect = false;
            }
            return (
              <div key={`${word.position}-${word.orientation}`} className={styles.evalWordItem}>
                <span className={isCorrect ? styles.evalCorrect : styles.evalIncorrect}>
                  {letters.join('')}
                </span>
                {!isCorrect && (
                  <span className={styles.evalExpected}> → {expected}</span>
                )}
                <span className={styles.evalClue}>{word.displayWord}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Activite 2 : Synonymes/Antonymes */}
      <div className={styles.evalActivity}>
        <h5 className={styles.evalActivityTitle}>
          Synonymes / Antonymes
          <span className={styles.evalActivityScore}>
            {score.synonymAntonymScore.correct}/{score.synonymAntonymScore.total}
          </span>
        </h5>
        <div className={styles.evalWordList}>
          {synonymAntonymText.replacements.map((r) => {
            const answer = synAntAnswers[r.original] || '(vide)';
            const corr = synAntCorrections[r.original];
            return (
              <div key={r.original} className={styles.evalWordItem}>
                <span className={styles.evalClue}>
                  {r.original} ({r.type === 'synonym' ? 'syn' : 'ant'})
                </span>
                <span className={corr?.correct ? styles.evalCorrect : styles.evalIncorrect}>
                  {answer}
                </span>
                {!corr?.correct && (
                  <span className={styles.evalExpected}> → {corr?.expected}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Activite 3 : Composition */}
      <div className={styles.evalActivity}>
        <h5 className={styles.evalActivityTitle}>
          Rédaction
          <span className={styles.evalActivityScore}>
            {score.compositionScore.score}/{score.compositionScore.total}
          </span>
        </h5>
        <div className={styles.evalComposition}>
          <p className={styles.evalCompositionTheme}>
            <strong>Sujet :</strong> {composition.theme}
          </p>
          <div className={styles.evalCompositionText}>
            {compositionText || '(aucun texte)'}
          </div>
          <div className={styles.evalCompositionFeedback}>
            <strong>Note IA : {compositionValidation.qualityScore}/10</strong>
            <p>{compositionValidation.feedback}</p>
            <div className={styles.evalCompositionWords}>
              {compositionValidation.wordsUsed.map((wu) => (
                <span
                  key={wu.word}
                  className={wu.found ? styles.evalCorrect : styles.evalIncorrect}
                  style={{ fontSize: '0.75rem' }}
                >
                  {wu.found ? '✓' : '✗'} {wu.word}
                  {wu.found && wu.form && wu.form !== wu.word && ` (${wu.form})`}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
