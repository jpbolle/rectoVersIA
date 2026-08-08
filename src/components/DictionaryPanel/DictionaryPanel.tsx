'use client';

import { useState, useCallback } from 'react';
import { useDictionaryLookup } from '@/hooks/useDictionaryLookup';
import Toggle from '@/components/Toggle/Toggle';
import type { DictionaryAction } from '@/types/dictionary';
import styles from './DictionaryPanel.module.css';

interface DictionaryPanelProps {
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
}

interface DictResult {
  word: string;
  action: DictionaryAction;
  items: string[];
}

const ACTION_LABELS: Record<DictionaryAction, string> = {
  definition: 'Définition',
  synonymes: 'Synonymes',
  antonymes: 'Antonymes',
  proxemie: 'Proxémie',
};

const ACTION_TITLES: Record<DictionaryAction, string> = {
  definition: 'Définition du mot',
  synonymes: 'Synonymes du mot',
  antonymes: 'Antonymes du mot',
  proxemie: 'Proxémie lexicale : les mots voisins par le sens',
};

const EMPTY_MESSAGES: Record<DictionaryAction, string> = {
  definition: 'Le dictionnaire ne connaît pas ce mot. Vérifie son orthographe !',
  synonymes: 'Le dictionnaire ne propose pas de synonymes pour ce mot.',
  antonymes: 'Le dictionnaire ne propose pas d’antonymes pour ce mot.',
  proxemie: 'Aucun mot voisin trouvé pour ce mot.',
};

const ICONS: Record<DictionaryAction, React.ReactNode> = {
  definition: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  ),
  synonymes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9c2-2.5 4-2.5 6 0s4 2.5 6 0" />
      <path d="M3 15c2-2.5 4-2.5 6 0s4 2.5 6 0" />
    </svg>
  ),
  antonymes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 3 21 7 17 11" />
      <line x1="21" y1="7" x2="9" y2="7" />
      <polyline points="7 13 3 17 7 21" />
      <line x1="3" y1="17" x2="15" y2="17" />
    </svg>
  ),
  proxemie: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="12" r="2.5" />
      <circle cx="19" cy="5.5" r="2.5" />
      <circle cx="19" cy="18.5" r="2.5" />
      <line x1="7.4" y1="11" x2="16.7" y2="6.6" />
      <line x1="7.4" y1="13" x2="16.7" y2="17.4" />
    </svg>
  ),
};

const BOOK_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

export default function DictionaryPanel({ enabled, onEnabledChange }: DictionaryPanelProps) {
  const { lookup: dictLookup } = useDictionaryLookup();
  const [word, setWord] = useState('');
  const [result, setResult] = useState<DictResult | null>(null);
  const [loadingAction, setLoadingAction] = useState<DictionaryAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lookup = useCallback(async (action: DictionaryAction) => {
    const cleaned = word.trim().toLowerCase();
    if (!cleaned || loadingAction) return;

    setLoadingAction(action);
    setError(null);
    setResult(null);
    try {
      const items = await dictLookup(cleaned, action);
      setResult({ word: cleaned, action, items });
    } catch {
      setError('Impossible de consulter le dictionnaire. Réessaie dans un instant.');
    } finally {
      setLoadingAction(null);
    }
  }, [word, loadingAction, dictLookup]);

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.headerIcon}>{BOOK_ICON}</span>
        <h4 className={styles.title}>Dictionnaire</h4>
        <div
          className={styles.toggleWrapper}
          title={enabled ? 'Désactiver le dictionnaire' : 'Activer le dictionnaire'}
        >
          <Toggle checked={enabled} onChange={onEnabledChange} />
        </div>
      </div>

      {enabled && (
        <div className={styles.body}>
          <p className={styles.hint}>
            Clique sur un mot de ton texte pour voir sa définition, ou cherche un mot ici :
          </p>

          <input
            type="text"
            className={styles.input}
            value={word}
            onChange={(e) => setWord(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') lookup('definition');
            }}
            placeholder="Écris un mot…"
            spellCheck={false}
          />

          <div className={styles.actions}>
            {(Object.keys(ACTION_LABELS) as DictionaryAction[]).map((action) => (
              <button
                key={action}
                type="button"
                className={`${styles.actionButton} ${result?.action === action ? styles.actionButtonActive : ''}`}
                onClick={() => lookup(action)}
                disabled={!word.trim() || loadingAction !== null}
                title={ACTION_TITLES[action]}
              >
                <span className={styles.actionIcon}>
                  {loadingAction === action ? <span className={styles.spinner} /> : ICONS[action]}
                </span>
                <span className={styles.actionLabel}>{ACTION_LABELS[action]}</span>
              </button>
            ))}
          </div>

          {error && <p className={styles.error}>{error}</p>}

          {result && (
            <div className={styles.result}>
              <div className={styles.resultHeader}>
                <span className={styles.resultWord}>{result.word}</span>
                <span className={styles.resultAction}>{ACTION_TITLES[result.action]}</span>
              </div>
              {result.items.length === 0 ? (
                <p className={styles.resultEmpty}>{EMPTY_MESSAGES[result.action]}</p>
              ) : result.action === 'definition' ? (
                <ol className={styles.resultList}>
                  {result.items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ol>
              ) : (
                <div className={styles.resultChips}>
                  {result.items.map((item, i) => (
                    <span key={i} className={styles.chip}>{item}</span>
                  ))}
                </div>
              )}
              <div className={styles.resultSource}>
                Source : {result.action === 'proxemie' ? 'assistant IA' : 'Wiktionnaire'}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
