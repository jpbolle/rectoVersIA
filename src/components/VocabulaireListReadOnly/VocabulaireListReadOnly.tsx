'use client';

import { useState, useCallback } from 'react';
import { useVocabulaireWords } from '@/hooks/useVocabulaireWords';
import type { VocabulaireActivityState, EvaluationAttempt } from '@/types/vocabulaire';
import { getWordCategory, removeAccents } from '@/types/vocabulaire';
import styles from './VocabulaireListReadOnly.module.css';

interface VocabulaireListReadOnlyProps {
  travailContent: string;
  themes?: string[];
}

// --- Sous-composant : vue d'une tentative d'evaluation pour le prof ---
function EvalAttemptView({ attempt }: { attempt: EvaluationAttempt }) {
  const { crossword, synonymAntonymText, composition, crosswordAnswers, synAntAnswers, compositionText, crosswordCorrections, synAntCorrections, compositionValidation, score } = attempt;

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

export default function VocabulaireListReadOnly({ travailContent, themes }: VocabulaireListReadOnlyProps) {
  const themesToLoad = themes && themes.length > 0 ? themes : null;
  const { allWords: themeWords, isLoading } = useVocabulaireWords(themesToLoad);
  const [activeEvalTab, setActiveEvalTab] = useState(0);
  const [side, setSide] = useState<'recto' | 'verso'>('recto');
  const [animPhase, setAnimPhase] = useState<'idle' | 'out' | 'in'>('idle');
  const [isAnimating, setIsAnimating] = useState(false);

  const flipTo = useCallback((target: 'recto' | 'verso') => {
    if (target === side || isAnimating) return;
    setIsAnimating(true);
    setAnimPhase('out');
    setTimeout(() => {
      setSide(target);
      setAnimPhase('in');
      setTimeout(() => {
        setAnimPhase('idle');
        setIsAnimating(false);
      }, 250);
    }, 250);
  }, [side, isAnimating]);

  // Parser le state depuis travail.content
  let state: VocabulaireActivityState | null = null;
  try {
    state = JSON.parse(travailContent);
  } catch {
    // ignore
  }

  if (isLoading) {
    return <div className={styles.loading}>Chargement...</div>;
  }

  if (!state || themeWords.length === 0) {
    return <div className={styles.empty}>Aucune progression enregistrée.</div>;
  }

  const masteryMap = new Map(state.wordMastery.map((m) => [m.word, m]));
  const unknownWords = themeWords.filter((w) => getWordCategory(masteryMap.get(w.word)) === 'unknown');
  const misconceivedWords = themeWords.filter((w) => getWordCategory(masteryMap.get(w.word)) === 'misconceived');
  const knownWords = themeWords.filter((w) => getWordCategory(masteryMap.get(w.word)) === 'known');

  const total = themeWords.length;
  const knownPct = Math.round((knownWords.length / total) * 100);
  const misconceivedPct = Math.round((misconceivedWords.length / total) * 100);

  const evalAttempts = state.evaluationAttempts || [];

  const flipClass = animPhase === 'out' ? styles.flipOut : animPhase === 'in' ? styles.flipIn : '';

  return (
    <div className={styles.container}>
      {/* Barre flip recto/verso si des evaluations existent */}
      {evalAttempts.length > 0 && (
        <div className={styles.flipBar}>
          <div className={styles.flipToggle}>
            <button
              type="button"
              className={`${styles.flipBtn} ${side === 'recto' ? styles.flipBtnActive : ''}`}
              onClick={() => flipTo('recto')}
              disabled={isAnimating}
            >
              📋 Progression
            </button>
            <button
              type="button"
              className={`${styles.flipBtn} ${side === 'verso' ? styles.flipBtnActive : ''}`}
              onClick={() => flipTo('verso')}
              disabled={isAnimating}
            >
              📝 Évaluations ({evalAttempts.length})
            </button>
          </div>
          <button
            type="button"
            className={styles.flipAction}
            onClick={() => flipTo(side === 'recto' ? 'verso' : 'recto')}
            disabled={isAnimating}
          >
            🔄
          </button>
        </div>
      )}

      <div className={`${styles.flipContent} ${flipClass}`}>
      {/* ── RECTO : progression ── */}
      {side === 'recto' && (
        <>
          <div className={styles.summary}>
            <span className={styles.summaryItem}>
              <span className={styles.dotKnown} /> {knownWords.length} connus ({knownPct}%)
            </span>
            <span className={styles.summaryItem}>
              <span className={styles.dotMisconceived} /> {misconceivedWords.length} méconnus ({misconceivedPct}%)
            </span>
            <span className={styles.summaryItem}>
              <span className={styles.dotUnknown} /> {unknownWords.length} inconnus
            </span>
          </div>

          <div className={styles.progressBar}>
            <div className={styles.progressKnown} style={{ width: `${knownPct}%` }} />
            <div className={styles.progressMisconceived} style={{ width: `${misconceivedPct}%` }} />
          </div>

          {knownWords.length > 0 && (
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>
                <span className={styles.sectionDot} style={{ background: '#27ae60' }} />
                Connus ({knownWords.length})
              </h4>
              <div className={styles.tagGrid}>
                {knownWords.map((w, i) => (
                  <span key={`${w.word}-${i}`} className={`${styles.tag} ${styles.tagKnown}`}>
                    {w.word}
                  </span>
                ))}
              </div>
            </div>
          )}

          {misconceivedWords.length > 0 && (
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>
                <span className={styles.sectionDot} style={{ background: '#e67e22' }} />
                Méconnus ({misconceivedWords.length})
              </h4>
              <div className={styles.tagGrid}>
                {misconceivedWords.map((w, i) => (
                  <span key={`${w.word}-${i}`} className={`${styles.tag} ${styles.tagMisconceived}`}>
                    {w.word}
                  </span>
                ))}
              </div>
            </div>
          )}

          {unknownWords.length > 0 && (
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>
                <span className={styles.sectionDot} style={{ background: 'var(--c-text-dim)' }} />
                Inconnus ({unknownWords.length})
              </h4>
              <div className={styles.tagGrid}>
                {unknownWords.map((w, i) => (
                  <span key={`${w.word}-${i}`} className={`${styles.tag} ${styles.tagUnknown}`}>
                    {w.word}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className={styles.activityInfo}>
            <span>Sessions : {state.learningSessions}</span>
            <span>Diagnostics : {state.diagnosticCount}</span>
            <span>Ouvertures : {state.activityOpened}</span>
          </div>
        </>
      )}

      {/* ── VERSO : evaluations ── */}
      {side === 'verso' && evalAttempts.length > 0 && (
        <div className={styles.evalSection}>
          {/* Onglets si plusieurs evaluations */}
          {evalAttempts.length > 1 && (
            <div className={styles.evalTabs}>
              {evalAttempts.map((a, i) => (
                <button
                  key={i}
                  type="button"
                  className={`${styles.evalTab} ${activeEvalTab === i ? styles.evalTabActive : ''}`}
                  onClick={() => setActiveEvalTab(i)}
                >
                  Éval. {i + 1} ({a.score.percentage}%)
                </button>
              ))}
            </div>
          )}

          <EvalAttemptView attempt={evalAttempts[activeEvalTab] || evalAttempts[0]} />
        </div>
      )}
      </div>
    </div>
  );
}
