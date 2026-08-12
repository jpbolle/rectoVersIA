'use client';

import { useState } from 'react';
import ConsignesTab from '@/components/ConsignesTab';
import RessourcesTab from '@/components/RessourcesTab';
import type { DrawShape } from '@/types/draw';
import GrilleTab from '@/components/GrilleTab';
import RemarquesTab from '@/components/RemarquesTab';
import AiTab, { type AiTabUiState } from '@/components/AiTab/AiTab';
import RechercheStatsTab from '@/components/RechercheStatsTab/RechercheStatsTab';
import RechercheResume from '@/components/RechercheResume/RechercheResume';
import VocabulaireStats from '@/components/VocabulaireStats/VocabulaireStats';
import type { VocabulaireActivityState } from '@/types/vocabulaire';
import type { Devoir } from '@/types/devoir';
import type { NonRenduStatus } from '@/types/travail';
import type { Grille } from '@/types/grille';
import type { Correction } from '@/types/correction';
import type { AiSuggestion, AiSuggestionType } from '@/types/ai-suggestions';
import type { AiGridResult } from '@/types/ai-grid';
import type { NavigKidQuestion, NavigKidReponse } from '@/types/navigkid';
import styles from './AssistancePanel.module.css';

export type TabType = 'consignes' | 'ressources' | 'grille' | 'remarques' | 'ia' | 'recherche';

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
  // Travail non rendu (toggle vue prof, bandeau vue élève)
  nonRendu?: NonRenduStatus | null;
  onNonRenduChange?: (nonRendu: NonRenduStatus | null) => void;
  ressourceAnnotations?: string;
  onRessourceAnnotationsChange?: (html: string) => void;
  ressourceNotes?: Record<string, string>;
  onRessourceNotesChange?: (notes: Record<string, string>) => void;
  ressourceImageShapes?: Record<string, DrawShape[]>;
  onRessourceImageShapesChange?: (shapes: Record<string, DrawShape[]>) => void;
  studentRessourceAnnotations?: string;
  studentRessourceNotes?: Record<string, string>;
  studentRessourceImageShapes?: Record<string, DrawShape[]>;
  // Aide dictionnaire permanente (élève)
  dictionaryEnabled?: boolean;
  onDictionaryEnabledChange?: (value: boolean) => void;
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
  onAiDisplayedChange?: (compositeIds: string[]) => void;
  aiUiState?: AiTabUiState | null;
  onAiUiStateChange?: (state: AiTabUiState) => void;
  // Props IA grille
  aiGridResult?: AiGridResult | null;
  aiGridRequesting?: boolean;
  aiGridError?: string | null;
  onRequestAiGrid?: () => void;
  // NavigKid (type rechercher)
  navigkidQuestions?: NavigKidQuestion[];
  navigkidReponse?: NavigKidReponse | null;
  // Mode recherche élève : restreint les onglets à Consignes / Remarques / Statistiques
  rechercheMode?: boolean;
  // Vocabulaire : state pour l'onglet stats
  vocabState?: VocabulaireActivityState | null;
  vocabAllWords?: string[];
  // Vocabulaire : selection d'une evaluation passee a revoir (gere par le parent)
  onSelectVocabEvalAttempt?: (index: number) => void;
  selectedVocabEvalIndex?: number | null;
  // Cache la barre d'onglets interne (utilise quand un parent gere la navigation,
  // ex. WorkspaceRail cote eleve)
  hideTabs?: boolean;
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
  nonRendu = null,
  onNonRenduChange,
  ressourceAnnotations,
  onRessourceAnnotationsChange,
  ressourceNotes,
  onRessourceNotesChange,
  ressourceImageShapes,
  onRessourceImageShapesChange,
  studentRessourceAnnotations,
  studentRessourceNotes,
  studentRessourceImageShapes,
  dictionaryEnabled,
  onDictionaryEnabledChange,
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
  onAiDisplayedChange,
  aiUiState,
  onAiUiStateChange,
  aiGridResult,
  aiGridRequesting,
  aiGridError,
  onRequestAiGrid,
  navigkidQuestions,
  navigkidReponse,
  rechercheMode = false,
  vocabState,
  vocabAllWords,
  onSelectVocabEvalAttempt,
  selectedVocabEvalIndex,
  hideTabs = false,
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

  // Les annotations du prof sont toujours visibles — l'onglet s'active dès qu'elles existent
  const hasRemarques = !!correction?.annotatedContent;

  // Badge IA : au moins une suggestion active (non-dismissed)
  const hasAiSuggestions = aiSuggestions
    ? Object.values(aiSuggestions).some(s =>
        s !== null && s.suggestions.some(item => !item.dismissed)
      )
    : false;

  return (
    <div className={`${styles.container} ${hideTabs ? styles.containerNoTabs : ''}`}>
      {!hideTabs && (
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${currentTab === 'consignes' ? styles.tabActive : ''}`}
            onClick={() => handleTabChange('consignes')}
          >
            Consignes
          </button>
          {!rechercheMode && (
            <button
              type="button"
              className={`${styles.tab} ${currentTab === 'ressources' ? styles.tabActive : ''}`}
              onClick={() => handleTabChange('ressources')}
            >
              Ressources
            </button>
          )}
          {!rechercheMode && !isProfessorView && (accesIA || showAiData) && (
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
            </button>
          )}
          {rechercheMode && navigkidQuestions && navigkidQuestions.length > 0 && (
            <button
              type="button"
              className={`${styles.tab} ${currentTab === 'recherche' ? styles.tabActive : ''}`}
              onClick={() => handleTabChange('recherche')}
            >
              Statistiques
            </button>
          )}
          {!rechercheMode && navigkidQuestions && navigkidQuestions.length > 0 && (
            <button
              type="button"
              className={`${styles.tab} ${currentTab === 'recherche' ? styles.tabActive : ''}`}
              onClick={() => handleTabChange('recherche')}
            >
              Recherche
            </button>
          )}
          <button
            type="button"
            className={`${styles.tab} ${currentTab === 'grille' ? styles.tabActive : ''}`}
            onClick={() => handleTabChange('grille')}
          >
            Évaluation
          </button>
        </div>
      )}

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
            ressourceImageShapes={ressourceImageShapes}
            onRessourceImageShapesChange={onRessourceImageShapesChange}
            studentRessourceImageShapes={studentRessourceImageShapes}
            studentRessourceAnnotations={studentRessourceAnnotations}
            studentRessourceNotes={studentRessourceNotes}
            dictionaryEnabled={dictionaryEnabled}
            onDictionaryEnabledChange={onDictionaryEnabledChange}
          />
        )}
        {currentTab === 'grille' && devoir.typeTravail === 'vocabulaire' && (
          <VocabulaireStats
            state={vocabState ?? null}
            allWords={vocabAllWords}
            themes={devoir.vocabulaireThemes}
            onSelectEvalAttempt={onSelectVocabEvalAttempt}
            selectedEvalIndex={selectedVocabEvalIndex}
          />
        )}
        {/* Recherche : récapitulatif de l'envoi en tête de l'onglet Évaluation */}
        {currentTab === 'grille' && !isProfessorView && navigkidReponse?.resume && (
          <RechercheResume
            resume={navigkidReponse.resume}
            soumisLe={navigkidReponse.soumisLe}
            corrigeDisponible={devoir.corrigeDisponible === true}
          />
        )}
        {currentTab === 'grille' && devoir.typeTravail !== 'vocabulaire' && (
          <GrilleTab
            grille={grille}
            hiddenCriteria={devoir.hiddenCriteria}
            nonRendu={nonRendu}
            onNonRenduChange={onNonRenduChange}
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
            profProduction={devoir.corrigeReference?.production}
          />
        )}
        {currentTab === 'recherche' && navigkidQuestions && (
          <RechercheStatsTab
            questions={navigkidQuestions}
            reponse={navigkidReponse ?? null}
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
            onDisplayedConseilsChange={onAiDisplayedChange}
            initialUiState={aiUiState}
            onUiStateChange={onAiUiStateChange}
            hasContent={!!studentContent && studentContent.replace(/<[^>]*>/g, '').trim().length > 0}
            readOnly={isProfessorView}
          />
        )}
      </div>
    </div>
  );
}
