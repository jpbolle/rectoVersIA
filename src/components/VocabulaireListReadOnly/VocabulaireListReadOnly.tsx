'use client';

import { useVocabulaireWords } from '@/hooks/useVocabulaireWords';
import type { VocabulaireActivityState } from '@/types/vocabulaire';
import { getWordCategory } from '@/types/vocabulaire';
import styles from './VocabulaireListReadOnly.module.css';

interface VocabulaireListReadOnlyProps {
  travailContent: string;
  themes?: string[];
}

export default function VocabulaireListReadOnly({ travailContent, themes }: VocabulaireListReadOnlyProps) {
  const themesToLoad = themes && themes.length > 0 ? themes : null;
  const { allWords: themeWords, isLoading } = useVocabulaireWords(themesToLoad);

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

  return (
    <div className={styles.container}>
      {/* Resume */}
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

      {/* Barre de progression */}
      <div className={styles.progressBar}>
        <div className={styles.progressKnown} style={{ width: `${knownPct}%` }} />
        <div className={styles.progressMisconceived} style={{ width: `${misconceivedPct}%` }} />
      </div>

      {/* Sections */}
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

      {/* Infos activite */}
      <div className={styles.activityInfo}>
        <span>Sessions : {state.learningSessions}</span>
        <span>Diagnostics : {state.diagnosticCount}</span>
        <span>Ouvertures : {state.activityOpened}</span>
      </div>
    </div>
  );
}
