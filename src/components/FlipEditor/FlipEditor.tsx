'use client';

import { useState, useCallback, useMemo } from 'react';
import WorkEditor from '@/components/WorkEditor';
import { DraftEditor } from '@/components/DraftEditor';
import { getDraftType, createEmptyDraft } from '@/lib/draft-utils';
import { setInternalClip, selectionTextFromEvent } from '@/lib/internal-clipboard';
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
  // Aide dictionnaire (clic sur un mot → définition)
  dictionaryEnabled?: boolean;
  // Inverse recto/verso : false = recto rédaction / verso planification ; true = inverse
  inverted?: boolean;
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
  dictionaryEnabled,
  inverted = false,
}: FlipEditorProps) {
  // Le recto est la face affichee a l'ouverture
  const [side, setSide] = useState<FlipSide>('recto');
  const [animPhase, setAnimPhase] = useState<'idle' | 'out' | 'in'>('idle');
  const [isAnimating, setIsAnimating] = useState(false);

  // Mapping recto/verso → contenu (selon l'orientation choisie par le prof)
  const rectoContent: 'redaction' | 'planification' = inverted ? 'planification' : 'redaction';
  const versoContent: 'redaction' | 'planification' = inverted ? 'redaction' : 'planification';
  const currentContent = side === 'recto' ? rectoContent : versoContent;
  const oppositeContent = side === 'recto' ? versoContent : rectoContent;

  const labels = {
    redaction: { icon: '✏️', label: 'Espace de rédaction' },
    planification: { icon: '📝', label: 'Espace de planification' },
  };

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
      {/* Barre de bascule (ordre : recto a gauche, verso a droite) */}
      <div className={styles.flipBar}>
        <div className={styles.flipToggle}>
          <button
            type="button"
            className={`${styles.flipButton} ${side === 'recto' ? styles.flipButtonActive : ''}`}
            onClick={() => side !== 'recto' && handleFlip()}
            disabled={isAnimating}
          >
            <span className={styles.flipIcon}>{labels[rectoContent].icon}</span>
            <span className={styles.flipLabel}>{labels[rectoContent].label}</span>
          </button>
          <button
            type="button"
            className={`${styles.flipButton} ${side === 'verso' ? styles.flipButtonActive : ''}`}
            onClick={() => side !== 'verso' && handleFlip()}
            disabled={isAnimating}
          >
            <span className={styles.flipIcon}>{labels[versoContent].icon}</span>
            <span className={styles.flipLabel}>{labels[versoContent].label}</span>
          </button>
        </div>

        <button
          type="button"
          className={styles.flipAction}
          onClick={handleFlip}
          disabled={isAnimating}
          title={`Retourner vers ${labels[oppositeContent].label}`}
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
          {currentContent === 'redaction' ? (
            <div className={styles.cardFace}>
              <WorkEditor
                content={content}
                onChange={onContentChange}
                disabled={disabled}
                placeholder={placeholder}
                accesIA={accesIA}
                aiSuggestions={aiSuggestions}
                onDecorationClick={onDecorationClick}
                dictionaryEnabled={dictionaryEnabled}
              />
            </div>
          ) : (
            <div
              className={styles.cardFace}
              // Le texte copié dans la planification peut être collé dans la rédaction
              onCopy={(e) => setInternalClip(selectionTextFromEvent(e))}
              onCut={(e) => setInternalClip(selectionTextFromEvent(e))}
            >
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
