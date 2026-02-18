'use client';

import { useState, useCallback, useMemo } from 'react';
import WorkEditor from '@/components/WorkEditor';
import { DraftEditor } from '@/components/DraftEditor';
import { getDraftType, createEmptyDraft } from '@/lib/draft-utils';
import type { Grille } from '@/types/grille';
import type { DraftContent, DraftType } from '@/types/travail';
import type { DraftItemAnnotation } from '@/types/correction';
import type { AiSuggestion, AiSuggestionType } from '@/types/ai-suggestions';

// Props IA simplifiées : seuls les décorations inline passent par WorkEditor
import styles from './FlipEditor.module.css';

type FlipSide = 'recto' | 'verso';

interface FlipEditorProps {
  // Recto (texte final)
  content: string;
  onContentChange: (content: string) => void;
  // Verso (brouillon / plan)
  draftContent: DraftContent | null | undefined;
  onDraftChange: (draft: DraftContent) => void;
  // Grille pour determiner le type de brouillon
  grille: Grille | null;
  // Etat
  disabled?: boolean;
  placeholder?: string;
  // Annotations brouillon (lecture seule, côté élève)
  draftAnnotations?: Record<string, DraftItemAnnotation>;
  // Aide IA (décorations inline uniquement)
  accesIA?: boolean;
  aiSuggestions?: Record<AiSuggestionType, AiSuggestion | null>;
  onDecorationClick?: (type: AiSuggestionType, itemId: string) => void;
}

export default function FlipEditor({
  content,
  onContentChange,
  draftContent,
  onDraftChange,
  grille,
  disabled = false,
  placeholder,
  draftAnnotations,
  accesIA,
  aiSuggestions,
  onDecorationClick,
}: FlipEditorProps) {
  const [side, setSide] = useState<FlipSide>('verso');
  const [animPhase, setAnimPhase] = useState<'idle' | 'out' | 'in'>('idle');
  const [isAnimating, setIsAnimating] = useState(false);

  // Determiner le type de brouillon
  const draftType: DraftType = useMemo(() => getDraftType(grille), [grille]);

  // Initialiser le brouillon si besoin
  const currentDraft: DraftContent = useMemo(() => {
    if (draftContent && draftContent.type === draftType) {
      return draftContent;
    }
    // Si le type a change ou pas encore de brouillon, creer un vide
    if (draftContent) return draftContent;
    return createEmptyDraft(draftType);
  }, [draftContent, draftType]);

  const handleFlip = useCallback(() => {
    if (isAnimating) return;

    setIsAnimating(true);
    setAnimPhase('out');

    // Phase 1 : rotation sortante (250ms)
    setTimeout(() => {
      setSide(s => s === 'recto' ? 'verso' : 'recto');
      setAnimPhase('in');

      // Phase 2 : rotation entrante (250ms)
      setTimeout(() => {
        setAnimPhase('idle');
        setIsAnimating(false);
      }, 280);
    }, 280);
  }, [isAnimating]);


  return (
    <div className={styles.wrapper}>
      {/* Barre de bascule */}
      <div className={styles.flipBar}>
        <div className={styles.flipToggle}>
          <button
            type="button"
            className={`${styles.flipButton} ${side === 'verso' ? styles.flipButtonActive : ''}`}
            onClick={() => side !== 'verso' && handleFlip()}
            disabled={isAnimating}
          >
            <span className={styles.flipIcon}>📝</span>
            <span className={styles.flipLabel}>Espace de planification</span>
          </button>
          <button
            type="button"
            className={`${styles.flipButton} ${side === 'recto' ? styles.flipButtonActive : ''}`}
            onClick={() => side !== 'recto' && handleFlip()}
            disabled={isAnimating}
          >
            <span className={styles.flipIcon}>✏️</span>
            <span className={styles.flipLabel}>Espace de rédaction</span>
          </button>
        </div>

        <button
          type="button"
          className={styles.flipAction}
          onClick={handleFlip}
          disabled={isAnimating}
          title={`Retourner vers ${side === 'recto' ? 'Espace de planification' : 'Espace de rédaction'}`}
        >
          <span className={`${styles.flipActionIcon} ${isAnimating ? styles.spinning : ''}`}>
            🔄
          </span>
          <span className={styles.flipActionText}>Retourner</span>
        </button>
      </div>

      {/* Conteneur flip */}
      <div className={styles.flipContainer}>
        <div
          className={`
            ${styles.flipCard}
            ${animPhase === 'out' ? styles.flipOut : ''}
            ${animPhase === 'in' ? styles.flipIn : ''}
          `}
        >
          {side === 'recto' ? (
            <div className={styles.cardFace}>
              <WorkEditor
                content={content}
                onChange={onContentChange}
                disabled={disabled}
                placeholder={placeholder}
                accesIA={accesIA}
                aiSuggestions={aiSuggestions}
                onDecorationClick={onDecorationClick}
              />
            </div>
          ) : (
            <div className={styles.cardFace}>
              <DraftEditor
                draftType={draftType}
                draft={currentDraft}
                onChange={onDraftChange}
                disabled={disabled}
                draftAnnotations={draftAnnotations}
                readOnlyAnnotations={!!draftAnnotations}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
