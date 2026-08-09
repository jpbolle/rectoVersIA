'use client';

import { useEffect, useRef, useState } from 'react';
import type { AiSuggestion, AiSuggestionItem, AiSuggestionType } from '@/types/ai-suggestions';
import styles from './AiTab.module.css';

type SuggestionsMap = Record<AiSuggestionType, AiSuggestion | null>;
type ConseilMode = 'prog' | 'all';

// État d'interface du panneau, remonté au parent pour survivre aux
// allers-retours entre onglets du rail (AiTab est démonté à chaque sortie)
export interface AiTabUiState {
  activeType: AiSuggestionType;
  mode: ConseilMode;
  currentIdx: Record<AiSuggestionType, number>;
}

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
  // Remonte les ids composites (`type:itemId`) des conseils affichés dans le
  // panneau — sert à synchroniser les bulles de l'espace de rédaction
  onDisplayedConseilsChange?: (compositeIds: string[]) => void;
  // Mémorisation de l'état d'interface entre deux montages du composant
  initialUiState?: AiTabUiState | null;
  onUiStateChange?: (state: AiTabUiState) => void;
}

const SECTIONS: {
  type: AiSuggestionType;
  label: string;
  icon: string;
  colorClass: string;
  accent: string;
}[] = [
  { type: 'ortho', label: 'Orthographe', icon: '✏️', colorClass: 'ortho', accent: '#e53935' },
  { type: 'ponctu', label: 'Ponctuation', icon: ';', colorClass: 'ponctu', accent: '#1e88e5' },
  { type: 'synt', label: 'Syntaxe', icon: '〰️', colorClass: 'synt', accent: '#ff9800' },
  { type: 'lex', label: 'Lexique', icon: '💬', colorClass: 'lex', accent: '#5d4037' },
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
  onDisplayedConseilsChange,
  initialUiState = null,
  onUiStateChange,
}: AiTabProps) {
  const [activeType, setActiveType] = useState<AiSuggestionType>(
    initialUiState?.activeType ?? 'ortho'
  );
  const [mode, setMode] = useState<ConseilMode>(
    initialUiState?.mode ?? (readOnly ? 'all' : 'prog')
  );
  // Index absolu du conseil affiché, par catégorie (mode « un par un »)
  const [currentIdx, setCurrentIdx] = useState<Record<AiSuggestionType, number>>(
    initialUiState?.currentIdx ?? {
      ortho: 0,
      ponctu: 0,
      synt: 0,
      lex: 0,
    }
  );

  // Remonter l'état d'interface au parent (pour le retrouver au prochain montage)
  const onUiStateRef = useRef(onUiStateChange);
  onUiStateRef.current = onUiStateChange;
  useEffect(() => {
    onUiStateRef.current?.({ activeType, mode, currentIdx });
  }, [activeType, mode, currentIdx]);
  const highlightRef = useRef<HTMLDivElement>(null);
  // Initialisé avec la valeur au montage : un highlight resté d'un passage
  // précédent ne doit pas écraser la position mémorisée
  const lastHighlightRef = useRef<string | null>(highlightedItemId);

  // Clic sur une bulle dans l'éditeur : basculer sur l'onglet et le conseil concernés
  useEffect(() => {
    if (!highlightedItemId || highlightedItemId === lastHighlightRef.current) return;
    lastHighlightRef.current = highlightedItemId;
    const [type, itemId] = highlightedItemId.split(':') as [AiSuggestionType, string];
    const list = suggestions[type]?.suggestions;
    if (!list) return;
    setActiveType(type);
    const idx = list.findIndex(s => s.id === itemId);
    if (idx >= 0) {
      setCurrentIdx(prev => ({ ...prev, [type]: idx }));
    }
  }, [highlightedItemId, suggestions]);

  useEffect(() => {
    if (highlightedItemId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [highlightedItemId, activeType, mode]);

  const activeSection = SECTIONS.find(s => s.type === activeType)!;
  const suggestion = suggestions[activeType];
  const isLoading = activeRequest === activeType;

  // Conseils actuellement affichés (mode « un par un » : le conseil courant ;
  // mode « tous » : tous les conseils restants de la catégorie active)
  const items = suggestion?.suggestions ?? [];
  const activeIdxs = items
    .map((s, i) => (s.dismissed ? -1 : i))
    .filter(i => i >= 0);
  const wanted = currentIdx[activeType];
  const displayIdx =
    activeIdxs.length > 0
      ? (activeIdxs.find(i => i >= wanted) ?? activeIdxs[activeIdxs.length - 1])
      : -1;
  const displayedKey = (
    !suggestion
      ? []
      : mode === 'all'
        ? activeIdxs.map(i => `${activeType}:${items[i].id}`)
        : displayIdx >= 0
          ? [`${activeType}:${items[displayIdx].id}`]
          : []
  ).join('|');

  const onDisplayedRef = useRef(onDisplayedConseilsChange);
  onDisplayedRef.current = onDisplayedConseilsChange;
  useEffect(() => {
    onDisplayedRef.current?.(displayedKey ? displayedKey.split('|') : []);
  }, [displayedKey]);

  const renderCard = (item: AiSuggestionItem) => {
    const compositeId = `${activeType}:${item.id}`;
    const isHighlighted = compositeId === highlightedItemId;
    return (
      <div
        key={item.id}
        ref={isHighlighted ? highlightRef : undefined}
        className={`${styles.card} ${styles[`card_${activeSection.colorClass}`]} ${
          isHighlighted ? styles.cardHighlighted : ''
        }`}
      >
        <div className={styles.cardBody}>
          <span className={`${styles.paraBadge} ${styles[`paraBadge_${activeSection.colorClass}`]}`}>
            §{item.paragraphIndex + 1}
          </span>
          <p className={styles.cardText}>{item.content}</p>
        </div>
        {!readOnly && (
          <button
            type="button"
            className={styles.dismissBtn}
            onClick={() => onDismiss(activeType, item.id)}
            title="Marquer comme corrigé"
          >
            <span className={styles.dismissIcon}>✓</span>
            <span className={styles.dismissLabel}>Corrigé</span>
          </button>
        )}
      </div>
    );
  };

  const renderTabContent = () => {
    // Analyse en cours
    if (isLoading) {
      return (
        <div className={styles.launchZone}>
          <span className={`${styles.bigSpinner} ${styles[`spinner_${activeSection.colorClass}`]}`} />
          <p className={styles.launchText}>Analyse en cours…</p>
        </div>
      );
    }

    // Analyse pas encore lancée : le bouton de déclenchement vit ici
    if (!suggestion) {
      if (readOnly) {
        return (
          <div className={styles.launchZone}>
            <p className={styles.launchText}>
              L&apos;élève n&apos;a pas lancé l&apos;analyse « {activeSection.label} ».
            </p>
          </div>
        );
      }
      return (
        <div className={styles.launchZone}>
          <div className={styles.launchIllustration}>
            <span className={styles.emptyPen}>🖊️</span>
            <span className={styles.emptyMag}>🔍</span>
          </div>
          <p className={styles.launchText}>
            {hasContent
              ? `Lance l'analyse pour recevoir des conseils : ${activeSection.label.toLowerCase()}.`
              : 'Rédige ton texte, puis lance l\'analyse.'}
          </p>
          <button
            type="button"
            className={styles.launchBtn}
            disabled={!hasContent || activeRequest !== null}
            onClick={() => onRequest(activeType)}
          >
            ✨ Analyser : {activeSection.label}
          </button>
        </div>
      );
    }

    const dismissedItems = items.filter(s => s.dismissed);

    // Liste des conseils traités, repliée
    const doneList = dismissedItems.length > 0 && (
      <details className={styles.doneList}>
        <summary className={styles.doneSummary}>
          Déjà pris en compte ({dismissedItems.length})
        </summary>
        <div className={styles.doneItems}>
          {dismissedItems.map(item => (
            <div key={item.id} className={styles.doneItem}>
              <span className={`${styles.paraBadge} ${styles.paraBadgeDismissed}`}>
                §{item.paragraphIndex + 1}
              </span>
              <p className={styles.doneText}>{item.content}</p>
              <span className={styles.doneCheck}>✓</span>
            </div>
          ))}
        </div>
      </details>
    );

    // Tous les conseils traités
    if (activeIdxs.length === 0) {
      return (
        <div className={styles.cardList}>
          <div className={styles.allDone}>
            <span className={styles.allDoneEmoji}>🎉</span>
            Bravo, tous les conseils « {activeSection.label} » sont pris en compte !
          </div>
          {doneList}
        </div>
      );
    }

    // Mode « tous à la fois »
    if (mode === 'all') {
      return (
        <div className={styles.cardList}>
          {activeIdxs.map(i => renderCard(items[i]))}
          {doneList}
        </div>
      );
    }

    // Mode « un par un » : navigation libre entre les conseils restants
    const pos = activeIdxs.indexOf(displayIdx);
    const prevIdx = pos > 0 ? activeIdxs[pos - 1] : null;
    const nextIdx = pos < activeIdxs.length - 1 ? activeIdxs[pos + 1] : null;

    return (
      <div className={styles.cardList}>
        <div className={styles.navRow}>
          <button
            type="button"
            className={styles.navBtn}
            disabled={prevIdx === null}
            onClick={() => prevIdx !== null && setCurrentIdx(prev => ({ ...prev, [activeType]: prevIdx }))}
            title="Conseil précédent"
          >
            ‹
          </button>
          <div className={styles.navCenter}>
            <span className={styles.navLabel}>
              Conseil {displayIdx + 1} sur {items.length}
            </span>
            <div className={styles.dots}>
              {items.map((it, i) => (
                <button
                  key={it.id}
                  type="button"
                  className={`${styles.dot} ${it.dismissed ? styles.dotDone : ''} ${
                    i === displayIdx ? styles.dotCurrent : ''
                  }`}
                  style={i === displayIdx ? { background: activeSection.accent } : undefined}
                  disabled={it.dismissed}
                  onClick={() => setCurrentIdx(prev => ({ ...prev, [activeType]: i }))}
                  title={it.dismissed ? 'Conseil déjà pris en compte' : `Conseil ${i + 1}`}
                />
              ))}
            </div>
          </div>
          <button
            type="button"
            className={styles.navBtn}
            disabled={nextIdx === null}
            onClick={() => nextIdx !== null && setCurrentIdx(prev => ({ ...prev, [activeType]: nextIdx }))}
            title="Conseil suivant"
          >
            ›
          </button>
        </div>
        {renderCard(items[displayIdx])}
        {activeIdxs.length > 1 && (
          <p className={styles.remainingHint}>
            Encore {activeIdxs.length - 1} conseil{activeIdxs.length - 1 > 1 ? 's' : ''} à découvrir
          </p>
        )}
        {doneList}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      {/* Onglets par catégorie d'analyse */}
      <div className={styles.tabBar}>
        {SECTIONS.map(({ type, label, icon, colorClass }) => {
          const s = suggestions[type];
          const loading = activeRequest === type;
          const remaining = s ? s.suggestions.filter(it => !it.dismissed).length : null;
          return (
            <button
              key={type}
              type="button"
              className={`${styles.tab} ${styles[`tab_${colorClass}`]} ${
                activeType === type ? styles.tabActive : ''
              }`}
              onClick={() => setActiveType(type)}
              title={label}
            >
              <span className={`${styles.tabCircle} ${styles[`circle_${colorClass}`]}`}>
                {loading ? (
                  <span className={`${styles.tabSpinner} ${styles[`spinner_${colorClass}`]}`} />
                ) : (
                  <span className={styles.tabIcon}>{icon}</span>
                )}
                {s && !loading && (
                  <span
                    className={`${styles.tabCount} ${
                      remaining === 0 ? styles.tabCountDone : styles[`badge_${colorClass}`]
                    }`}
                  >
                    {remaining === 0 ? '✓' : remaining}
                  </span>
                )}
              </span>
              <span className={styles.tabText}>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Affichage des conseils : un par un ou tous */}
      <div className={styles.modeRow}>
        <span className={styles.modeLabel}>Conseils</span>
        <div className={styles.modeSeg}>
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === 'prog' ? styles.modeBtnOn : ''}`}
            onClick={() => setMode('prog')}
          >
            Un par un
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === 'all' ? styles.modeBtnOn : ''}`}
            onClick={() => setMode('all')}
          >
            Tous
          </button>
        </div>
      </div>

      {error && (
        <div className={styles.errorBar}>
          <span>⚠️ {error}</span>
        </div>
      )}

      <div className={styles.tabContent}>{renderTabContent()}</div>
    </div>
  );
}
