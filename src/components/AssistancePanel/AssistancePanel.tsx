'use client';

import { useState, type ReactNode } from 'react';
import ConsignesTab from '@/components/ConsignesTab';
import RessourcesTab from '@/components/RessourcesTab';
import type { DrawShape } from '@/types/draw';
import GrilleTab from '@/components/GrilleTab';
import RemarquesTab from '@/components/RemarquesTab';
import AiTab, { type AiTabUiState } from '@/components/AiTab/AiTab';
import RechercheEvaluation from '@/components/RechercheEvaluation/RechercheEvaluation';
import AutoEvalEvaluation from '@/components/AutoEvalEvaluation/AutoEvalEvaluation';
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
import LectureEvaluation from '@/components/LectureEvaluation/LectureEvaluation';
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
  /** Date de remise — datée en tête du récapitulatif d'une lecture remise */
  submittedAt?: string | null;
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
  /**
   * Lecture d'une œuvre : le sommaire du livre, rendu SOUS la consigne.
   * Il vit ici plutôt qu'en colonne de gauche parce que la liseuse occupe
   * toute cette colonne — et parce qu'un sommaire à demeure y prendrait la
   * place du texte (décision de JP du 2026-08-15). Quand il est fourni,
   * l'onglet se renomme « Consignes et navigation dans le texte ».
   */
  oeuvreNav?: ReactNode;
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
  submittedAt = null,
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
  oeuvreNav,
}: AssistancePanelProps) {
  // Mode contrôlé vs interne
  const [internalTab, setInternalTab] = useState<TabType>('consignes');
  const currentTab = controlledTab ?? internalTab;
  // Activité de lecture avec questionnaire : l'évaluation passe par les
  // habiletés des questions, pas par une grille
  const isLectureQuiz =
    devoir.typeTravail === 'lire' && (devoir.lectureQuiz?.questions.length ?? 0) > 0;
  // Activité de recherche : même principe — pas de grille, l'évaluation se lit
  // dans les deux scores (réponses / démarche) et les habiletés des questions
  const isRecherche = !!navigkidQuestions && navigkidQuestions.length > 0;
  // Auto-évaluation : l'onglet Évaluation montre la lucidité, pas une note
  const isAutoEval = devoir.typeTravail === 'autoevaluation' && !!devoir.autoEvalQuiz;
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
            {oeuvreNav ? 'Consignes et navigation dans le texte' : 'Consignes'}
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
          {/* Recherche : pas d'onglet séparé — scores, habiletés et statistiques
              tiennent tous dans Évaluation (RechercheEvaluation) */}
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
          <>
            <ConsignesTab devoir={devoir} />
            {oeuvreNav}
          </>
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
        {/* Recherche : le récapitulatif de l'envoi (justes / erreurs / à
            corriger) est un PIS-ALLER — la seule information chiffrée dont
            l'élève dispose tant que le prof n'a pas rendu sa correction. Dès
            qu'elle l'est, les deux scores le remplacent : garder les deux
            afficherait deux comptages concurrents du même travail. */}
        {currentTab === 'grille' &&
          !isProfessorView &&
          navigkidReponse?.resume &&
          correction?.visibleParEleve !== true && (
            <RechercheResume
              resume={navigkidReponse.resume}
              soumisLe={navigkidReponse.soumisLe}
              corrigeDisponible={devoir.corrigeDisponible === true}
            />
          )}
        {currentTab === 'grille' && isRecherche && (
          <RechercheEvaluation
            questions={navigkidQuestions!}
            reponse={navigkidReponse ?? null}
            scores={correction?.rechercheScores}
            showScores={isProfessorView || correction?.visibleParEleve === true}
            isProfessorView={isProfessorView}
          />
        )}
        {/* Lecture : même pis-aller, même composant. Le récapitulatif est
            calculé sur le serveur (`devoir.lectureResume`) — le navigateur de
            l'élève n'a pas les bonnes réponses. Il s'efface dès que la
            correction du prof est visible. */}
        {currentTab === 'grille' &&
          !isProfessorView &&
          isLectureQuiz &&
          devoir.lectureResume &&
          correction?.visibleParEleve !== true && (
            <RechercheResume
              resume={devoir.lectureResume}
              soumisLe={submittedAt ?? undefined}
              corrigeDisponible={devoir.corrigeDisponible === true}
            />
          )}
        {/* Questionnaire de lecture : pas de grille — le score et le détail par
            habileté tiennent lieu d'évaluation */}
        {currentTab === 'grille' && isLectureQuiz && (
          <LectureEvaluation
            quiz={devoir.lectureQuiz}
            travailContent={studentContent}
            questionScores={correction?.questionScores}
            showScores={isProfessorView || correction?.visibleParEleve === true}
            isProfessorView={isProfessorView}
          />
        )}
        {/* Auto-évaluation : écart entre les deux regards. Côté élève, rien
            tant que la correction ne lui est pas rendue — il verrait le regard
            du prof avant l'heure. */}
        {currentTab === 'grille' && isAutoEval && (
          <AutoEvalEvaluation
            quiz={devoir.autoEvalQuiz!}
            travailContent={studentContent}
            profAnswers={correction?.autoEvalProf}
            showComparaison={isProfessorView || correction?.visibleParEleve === true}
          />
        )}
        {currentTab === 'grille' &&
          devoir.typeTravail !== 'vocabulaire' &&
          !isLectureQuiz &&
          !isRecherche &&
          !isAutoEval && (
          <GrilleTab
            grille={grille}
            hiddenCriteria={devoir.hiddenCriteria}
            autoEvaluation={devoir.autoEvaluation !== false}
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
