'use client';

import { useEffect, useRef } from 'react';
import type { AiSuggestion, AiSuggestionType } from '@/types/ai-suggestions';
import styles from './AiTab.module.css';

type SuggestionsMap = Record<AiSuggestionType, AiSuggestion | null>;

interface AiTabProps {
  suggestions: SuggestionsMap;
  activeRequest: AiSuggestionType | null;
  error: string | null;
  onDismiss: (type: AiSuggestionType, itemId: string) => void;
  highlightedItemId: string | null;
  onRequest: (type: AiSuggestionType) => void;
  usedTypes: Set<AiSuggestionType>;
  hasContent: boolean;
  readOnly?: boolean;
}

const SECTIONS: {
  type: AiSuggestionType;
  label: string;
  icon: string;
  shortLabel: string;
  colorClass: string;
}[] = [
  { type: 'ortho', label: 'Orthographe', icon: '✏️', shortLabel: 'Orth', colorClass: 'ortho' },
  { type: 'ponctu', label: 'Ponctuation', icon: ';', shortLabel: 'Ponctu', colorClass: 'ponctu' },
  { type: 'synt', label: 'Syntaxe', icon: '〰️', shortLabel: 'Synt', colorClass: 'synt' },
  { type: 'lex', label: 'Lexique', icon: '💬', shortLabel: 'Lex', colorClass: 'lex' },
];

export default function AiTab({
  suggestions,
  activeRequest,
  error,
  onDismiss,
  highlightedItemId,
  onRequest,
  usedTypes,
  hasContent,
  readOnly = false,
}: AiTabProps) {
  const highlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlightedItemId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [highlightedItemId]);

  const hasAnySuggestions = Object.values(suggestions).some(s => s !== null);
  const allUsed = SECTIONS.every(s => usedTypes.has(s.type));

  return (
    <div className={styles.container}>
      {/* Barre de boutons d'analyse — masquée en lecture seule */}
      {!readOnly && (
        <div className={styles.buttonBar}>
          {SECTIONS.map(({ type, label, icon, shortLabel, colorClass }) => {
            const used = usedTypes.has(type);
            const loading = activeRequest === type;
            return (
              <button
                key={type}
                type="button"
                className={`${styles.analyseBtn} ${styles[`btn_${colorClass}`]} ${
                  used ? styles.analyseBtnUsed : ''
                } ${loading ? styles.analyseBtnLoading : ''}`}
                disabled={!hasContent || activeRequest !== null || used}
                onClick={() => onRequest(type)}
                title={used ? `${label} — analyse effectuée` : `Analyser : ${label}`}
              >
                {loading ? (
                  <span className={styles.btnSpinner} />
                ) : (
                  <>
                    <span className={styles.btnIcon}>{icon}</span>
                    <span className={styles.btnText}>{shortLabel}</span>
                    {used && <span className={styles.btnCheck}>✓</span>}
                  </>
                )}
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <div className={styles.errorBar}>
          <span>⚠️ {error}</span>
        </div>
      )}

      {!hasAnySuggestions && !activeRequest && (
        <div className={styles.empty}>
          <div className={styles.emptyIllustration}>
            <span className={styles.emptyPen}>🖊️</span>
            <span className={styles.emptyMag}>🔍</span>
          </div>
          <p className={styles.emptyText}>
            {readOnly
              ? 'L\'élève n\'a pas utilisé l\'aide IA à la réécriture.'
              : allUsed
                ? 'Toutes les analyses ont été effectuées.'
                : hasContent
                  ? 'Lancez une analyse pour recevoir des suggestions.'
                  : 'Rédigez votre texte, puis lancez une analyse.'}
          </p>
        </div>
      )}

      <div className={styles.sections}>
        {SECTIONS.map(({ type, label, icon, colorClass }) => {
          const suggestion = suggestions[type];
          const isLoading = activeRequest === type;

          if (!suggestion && !isLoading) return null;

          const activeItems = suggestion?.suggestions.filter(s => !s.dismissed) || [];
          const dismissedItems = suggestion?.suggestions.filter(s => s.dismissed) || [];
          const totalItems = suggestion?.suggestions.length || 0;

          return (
            <div key={type} className={`${styles.section} ${styles[`section_${colorClass}`]}`}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionIcon}>{icon}</span>
                <span className={styles.sectionLabel}>{label}</span>
                {suggestion && (
                  <span className={`${styles.sectionBadge} ${styles[`badge_${colorClass}`]}`}>
                    {activeItems.length === 0
                      ? '✓'
                      : `${activeItems.length}/${totalItems}`}
                  </span>
                )}
                {isLoading && (
                  <span className={`${styles.sectionSpinner} ${styles[`spinner_${colorClass}`]}`} />
                )}
              </div>

              {suggestion && (
                <div className={styles.cardList}>
                  {activeItems.map(item => {
                    const compositeId = `${type}:${item.id}`;
                    const isHighlighted = compositeId === highlightedItemId;
                    return (
                    <div
                      key={item.id}
                      ref={isHighlighted ? highlightRef : undefined}
                      className={`${styles.card} ${styles[`card_${colorClass}`]} ${
                        isHighlighted ? styles.cardHighlighted : ''
                      }`}
                    >
                      <div className={styles.cardBody}>
                        <span className={`${styles.paraBadge} ${styles[`paraBadge_${colorClass}`]}`}>
                          §{item.paragraphIndex + 1}
                        </span>
                        <p className={styles.cardText}>{item.content}</p>
                      </div>
                      {!readOnly && (
                        <button
                          type="button"
                          className={styles.dismissBtn}
                          onClick={() => onDismiss(type, item.id)}
                          title="Marquer comme corrigé"
                        >
                          <span className={styles.dismissIcon}>✓</span>
                          <span className={styles.dismissLabel}>Corrigé</span>
                        </button>
                      )}
                    </div>
                    );
                  })}

                  {dismissedItems.map(item => (
                    <div
                      key={item.id}
                      className={`${styles.card} ${styles.cardDismissed}`}
                    >
                      <div className={styles.cardBody}>
                        <span className={`${styles.paraBadge} ${styles.paraBadgeDismissed}`}>
                          §{item.paragraphIndex + 1}
                        </span>
                        <p className={styles.cardText}>{item.content}</p>
                      </div>
                      <span className={styles.dismissedMark}>✓</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
