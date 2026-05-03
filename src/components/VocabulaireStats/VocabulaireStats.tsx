'use client';

import { useVocabulaireWords } from '@/hooks/useVocabulaireWords';
import type { VocabulaireActivityState, WordMasteryEntry } from '@/types/vocabulaire';
import { getWordCategory } from '@/types/vocabulaire';
import styles from './VocabulaireStats.module.css';

interface VocabulaireStatsProps {
  state: VocabulaireActivityState | null;
  allWords?: string[];
  themes?: string[];
}

export default function VocabulaireStats({ state, allWords: allWordsProp, themes }: VocabulaireStatsProps) {
  const themesToLoad = themes && themes.length > 0 ? themes : null;
  const { allWords: themeWords } = useVocabulaireWords(themesToLoad);

  // Construire la liste complete des mots (depuis les themes ou prop)
  const allWords = allWordsProp && allWordsProp.length > 0
    ? allWordsProp
    : themeWords.map((w) => w.word);

  if (!state) {
    return (
      <div className={styles.container}>
        <p className={styles.empty}>Aucune donnée de progression disponible.</p>
      </div>
    );
  }

  const { wordMastery, diagnosticCount, learningSessions, activityOpened } = state;
  const masteryMap = new Map(wordMastery.map((m) => [m.word, m]));

  // Stats globales
  let knownCount = 0;
  let misconceivedCount = 0;
  let unknownCount = 0;

  for (const word of allWords) {
    const cat = getWordCategory(masteryMap.get(word));
    if (cat === 'known') knownCount++;
    else if (cat === 'misconceived') misconceivedCount++;
    else unknownCount++;
  }

  const total = allWords.length || 1;
  const knownPct = Math.round((knownCount / total) * 100);
  const misconceivedPct = Math.round((misconceivedCount / total) * 100);
  const unknownPct = Math.round((unknownCount / total) * 100);

  return (
    <div className={styles.container}>
      {/* Stats generales */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{knownPct}%</div>
          <div className={styles.statLabel}>Connus</div>
          <div className={styles.statCount}>{knownCount}/{total}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{misconceivedPct}%</div>
          <div className={styles.statLabel}>Méconnus</div>
          <div className={styles.statCount}>{misconceivedCount}/{total}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{unknownPct}%</div>
          <div className={styles.statLabel}>Inconnus</div>
          <div className={styles.statCount}>{unknownCount}/{total}</div>
        </div>
      </div>

      {/* Compteurs d'activite */}
      <div className={styles.counters}>
        <span className={styles.counter}>Sessions : {learningSessions}</span>
        <span className={styles.counter}>Diagnostics : {diagnosticCount}</span>
        <span className={styles.counter}>Ouvertures : {activityOpened}</span>
      </div>

      {/* Barre de progression */}
      <div className={styles.progressBar}>
        <div className={styles.progressKnown} style={{ width: `${knownPct}%` }} />
        <div className={styles.progressMisconceived} style={{ width: `${misconceivedPct}%` }} />
        <div className={styles.progressUnknown} style={{ width: `${unknownPct}%` }} />
      </div>

      {/* Résultats des diagnostics */}
      {state.diagnosticScores && state.diagnosticScores.length > 0 && (
        <div className={styles.diagnosticSection}>
          <h4 className={styles.sectionTitle}>Résultats des diagnostics</h4>
          <div className={styles.diagnosticResults}>
            {state.diagnosticScores.map((score, i) => {
              const pct = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;
              const date = new Date(score.date);
              return (
                <div key={i} className={styles.diagResult}>
                  <span className={styles.diagLabel}>
                    Diagnostic {i + 1} — {date.toLocaleDateString()}
                  </span>
                  <span className={styles.diagScore}>
                    {score.correct}/{score.total} ({pct}%)
                  </span>
                  <div className={styles.diagBar}>
                    <div className={styles.diagBarFill} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Resultats des evaluations */}
      {state.evaluationScores && state.evaluationScores.length > 0 && (
        <div className={styles.diagnosticSection}>
          <h4 className={styles.sectionTitle}>Résultats des évaluations</h4>
          <div className={styles.diagnosticResults}>
            {state.evaluationScores.map((score, i) => {
              const date = new Date(score.date);
              return (
                <div key={i} className={styles.diagResult}>
                  <span className={styles.diagLabel}>
                    Évaluation {i + 1} — {date.toLocaleDateString()}
                  </span>
                  <span className={styles.diagScore}>
                    {score.totalCorrect}/{score.totalPossible} ({score.percentage}%)
                  </span>
                  <div className={styles.diagBar}>
                    <div className={styles.diagBarFill} style={{ width: `${score.percentage}%` }} />
                  </div>
                  <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '12px', fontSize: '0.7rem', color: 'var(--c-text-dim)' }}>
                    <span>Mots croisés : {score.crosswordScore.correct}/{score.crosswordScore.total}</span>
                    <span>Syn/Ant : {score.synonymAntonymScore.correct}/{score.synonymAntonymScore.total}</span>
                    <span>Rédaction : {score.compositionScore.score}/{score.compositionScore.total}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tableau de mots avec tentatives */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thWord}>Mot</th>
              <th className={styles.thStatus}>Statut</th>
              <th className={styles.thAttempts}>Tentatives</th>
            </tr>
          </thead>
          <tbody>
            {allWords.map((word) => {
              const entry: WordMasteryEntry | undefined = masteryMap.get(word);
              const category = getWordCategory(entry);
              const attempts = entry?.attempts || [];

              return (
                <tr key={word} className={styles.row}>
                  <td className={styles.tdWord}>{word}</td>
                  <td className={styles.tdStatus}>
                    <span className={`${styles.badge} ${styles[`badge_${category}`]}`}>
                      {category === 'known' ? 'Connu' : category === 'misconceived' ? 'Méconnu' : 'Inconnu'}
                    </span>
                  </td>
                  <td className={styles.tdAttempts}>
                    <div className={styles.attemptDots}>
                      {attempts.length === 0 && <span className={styles.noAttempt}>—</span>}
                      {attempts.map((a, i) => (
                        <span
                          key={i}
                          className={`${styles.attemptDot} ${a.correct ? styles.dotCorrect : styles.dotIncorrect}`}
                          title={`${a.context} — ${new Date(a.date).toLocaleDateString()}`}
                        />
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
