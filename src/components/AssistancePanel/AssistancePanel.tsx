'use client';

import { useState } from 'react';
import ConsignesTab from '@/components/ConsignesTab';
import RessourcesTab from '@/components/RessourcesTab';
import GrilleTab from '@/components/GrilleTab';
import RemarquesTab from '@/components/RemarquesTab';
import AiTab from '@/components/AiTab/AiTab';
import type { Devoir } from '@/types/devoir';
import type { Grille } from '@/types/grille';
import type { Correction } from '@/types/correction';
import type { AiSuggestion, AiSuggestionType } from '@/types/ai-suggestions';
import type { AiGridResult } from '@/types/ai-grid';
import styles from './AssistancePanel.module.css';

export type TabType = 'consignes' | 'ressources' | 'grille' | 'remarques' | 'ia';

interface AssistancePanelProps {
  devoir: Devoir;
  grille: Grille | null;
  grilleLoading: boolean;
  grilleError: string | null;
  selfEvaluation: Record<string, number> | null;
  onSelfEvaluationChange: (evaluation: Record<string, number>) => void;
  disabled?: boolean;
  studentName?: string;
  correction?: Correction | null;
  studentContent?: string;
  showRemarquesTab?: boolean;
  isProfessorView?: boolean;
  ressourceAnnotations?: string;
  onRessourceAnnotationsChange?: (html: string) => void;
  ressourceNotes?: Record<string, string>;
  onRessourceNotesChange?: (notes: Record<string, string>) => void;
  studentRessourceAnnotations?: string;
  studentRessourceNotes?: Record<string, string>;
  // Mode contrôlé (optionnel — fallback interne si non fourni)
  activeTab?: TabType;
  onTabChange?: (tab: TabType) => void;
  // Props IA suggestions (réécriture)
  accesIA?: boolean;       // peut demander de nouvelles analyses (pas soumis)
  showAiData?: boolean;    // afficher les résultats IA existants (même après soumission)
  aiSuggestions?: Record<AiSuggestionType, AiSuggestion | null>;
  aiActiveRequest?: AiSuggestionType | null;
  aiError?: string | null;
  aiUsedTypes?: Set<AiSuggestionType>;
  onAiRequest?: (type: AiSuggestionType) => void;
  onAiDismiss?: (type: AiSuggestionType, itemId: string) => void;
  highlightedItemId?: string | null;
  // Props IA grille
  aiGridResult?: AiGridResult | null;
  aiGridRequesting?: boolean;
  aiGridError?: string | null;
  onRequestAiGrid?: () => void;
}

export default function AssistancePanel({
  devoir,
  grille,
  grilleLoading,
  grilleError,
  selfEvaluation,
  onSelfEvaluationChange,
  disabled = false,
  studentName = '',
  correction = null,
  studentContent = '',
  showRemarquesTab = true,
  isProfessorView = false,
  ressourceAnnotations,
  onRessourceAnnotationsChange,
  ressourceNotes,
  onRessourceNotesChange,
  studentRessourceAnnotations,
  studentRessourceNotes,
  activeTab: controlledTab,
  onTabChange,
  accesIA = false,
  showAiData = false,
  aiSuggestions,
  aiActiveRequest,
  aiError,
  aiUsedTypes,
  onAiRequest,
  onAiDismiss,
  highlightedItemId,
  aiGridResult,
  aiGridRequesting,
  aiGridError,
  onRequestAiGrid,
}: AssistancePanelProps) {
  // Mode contrôlé vs interne
  const [internalTab, setInternalTab] = useState<TabType>('consignes');
  const currentTab = controlledTab ?? internalTab;
  const handleTabChange = (tab: TabType) => {
    if (onTabChange) {
      onTabChange(tab);
    } else {
      setInternalTab(tab);
    }
  };

  const hasRemarques = correction?.visibleParEleve && correction?.annotatedContent;

  // Badge IA : au moins une suggestion active (non-dismissed)
  const hasAiSuggestions = aiSuggestions
    ? Object.values(aiSuggestions).some(s =>
        s !== null && s.suggestions.some(item => !item.dismissed)
      )
    : false;

  return (
    <div className={styles.container}>
      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${currentTab === 'consignes' ? styles.tabActive : ''}`}
          onClick={() => handleTabChange('consignes')}
        >
          Consignes
        </button>
        <button
          type="button"
          className={`${styles.tab} ${currentTab === 'ressources' ? styles.tabActive : ''}`}
          onClick={() => handleTabChange('ressources')}
        >
          Ressources
        </button>
        {!isProfessorView && (accesIA || showAiData) && (
          <button
            type="button"
            className={`${styles.tab} ${currentTab === 'ia' ? styles.tabActive : ''}`}
            onClick={() => handleTabChange('ia')}
          >
            Aide IA à la réécriture
            {hasAiSuggestions && <span className={styles.badgeIa}>●</span>}
          </button>
        )}
        {showRemarquesTab && (
          <button
            type="button"
            className={`${styles.tab} ${currentTab === 'remarques' ? styles.tabActive : ''} ${hasRemarques ? styles.tabHighlight : ''}`}
            onClick={() => handleTabChange('remarques')}
          >
            Remarques du professeur
            {hasRemarques && <span className={styles.badge}>•</span>}
          </button>
        )}
        <button
          type="button"
          className={`${styles.tab} ${currentTab === 'grille' ? styles.tabActive : ''}`}
          onClick={() => handleTabChange('grille')}
        >
          Grille d&apos;évaluation
        </button>
      </div>

      <div className={styles.content}>
        {currentTab === 'consignes' && (
          <ConsignesTab devoir={devoir} />
        )}
        {currentTab === 'ressources' && (
          <RessourcesTab
            devoir={devoir}
            ressourceAnnotations={ressourceAnnotations}
            onRessourceAnnotationsChange={onRessourceAnnotationsChange}
            ressourceNotes={ressourceNotes}
            onRessourceNotesChange={onRessourceNotesChange}
            studentRessourceAnnotations={studentRessourceAnnotations}
            studentRessourceNotes={studentRessourceNotes}
          />
        )}
        {currentTab === 'grille' && (
          <GrilleTab
            grille={grille}
            isLoading={grilleLoading}
            error={grilleError}
            selfEvaluation={selfEvaluation}
            onSelfEvaluationChange={onSelfEvaluationChange}
            disabled={disabled}
            studentName={studentName}
            correction={correction}
            isProfessorView={isProfessorView}
            accesIA={accesIA}
            showAiData={showAiData}
            aiGridResult={aiGridResult}
            aiGridRequesting={aiGridRequesting}
            aiGridError={aiGridError}
            onRequestAiGrid={onRequestAiGrid}
            studentContent={studentContent}
          />
        )}
        {showRemarquesTab && currentTab === 'remarques' && (
          <RemarquesTab
            correction={correction}
            studentContent={studentContent}
          />
        )}
        {!isProfessorView && (accesIA || showAiData) && currentTab === 'ia' && aiSuggestions && (
          <AiTab
            suggestions={aiSuggestions}
            activeRequest={aiActiveRequest ?? null}
            error={aiError ?? null}
            onDismiss={onAiDismiss ?? (() => {})}
            highlightedItemId={highlightedItemId ?? null}
            onRequest={onAiRequest ?? (() => {})}
            usedTypes={aiUsedTypes ?? new Set()}
            hasContent={!!studentContent && studentContent.replace(/<[^>]*>/g, '').trim().length > 0}
            readOnly={isProfessorView}
          />
        )}
      </div>
    </div>
  );
}
