'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useStudentClasses } from '@/hooks/useStudentClasses';
import { useTravail } from '@/hooks/useTravail';
import { useGrille } from '@/hooks/useGrille';
import { useAiSuggestions } from '@/hooks/useAiSuggestions';
import { useAiGridEvaluation } from '@/hooks/useAiGridEvaluation';
import WorkTopBar from '@/components/WorkTopBar';
import { FlipEditor } from '@/components/FlipEditor';
import AssistancePanel from '@/components/AssistancePanel';
import type { TabType } from '@/components/AssistancePanel/AssistancePanel';
import type { AiTabUiState } from '@/components/AiTab/AiTab';
import type { Devoir } from '@/types/devoir';
import type { Correction } from '@/types/correction';
import type { DraftContent } from '@/types/travail';
import type { AiSuggestionType } from '@/types/ai-suggestions';
import { LEVEL_PERCENTAGES } from '@/types/grille';
import RechercheResponseViewer from '@/components/RechercheResponseViewer/RechercheResponseViewer';
import VocabulaireActivity from '@/components/VocabulaireActivity/VocabulaireActivity';
import LectureQuizActivity from '@/components/LectureQuizActivity/LectureQuizActivity';
import { parseLectureAnswers } from '@/types/lecture';
import WorkspaceRail, { type RailTab } from '@/components/WorkspaceRail';
import DictionaryClickLayer from '@/components/DictionaryClickLayer';
import type { NavigKidQuestion, NavigKidReponse } from '@/types/navigkid';
import styles from './travail.module.css';

// ── Icones SVG du rail (blanc sur fond bleu ciel, geres par CSS via currentColor) ──
const ICON_CONSIGNES = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="8" y="2" width="8" height="4" rx="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <line x1="9" y1="12" x2="15" y2="12" />
    <line x1="9" y1="16" x2="13" y2="16" />
  </svg>
);
const ICON_RESSOURCES = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
);
const ICON_GRILLE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);
const ICON_IA = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
    <path d="M19 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" />
  </svg>
);
const ICON_REMARQUES = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);
const ICON_RECHERCHE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

export default function TravailPage() {
  const params = useParams();
  const router = useRouter();
  const devoirId = params.id as string;

  const { isAuthenticated, role, isLoading: authLoading, getAuthHeaders } = useAuth();
  const { classes, isLoading: classesLoading } = useStudentClasses();
  const [devoir, setDevoir] = useState<Devoir | null>(null);
  const [devoirLoading, setDevoirLoading] = useState(true);
  const [devoirError, setDevoirError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [correction, setCorrection] = useState<Correction | null>(null);

  // NavigKid (type rechercher)
  const [nkQuestions, setNkQuestions] = useState<NavigKidQuestion[]>([]);
  const [nkReponse, setNkReponse] = useState<NavigKidReponse | null>(null);

  // Les profs peuvent previsualiser la page en mode lecture seule
  const isPreviewMode = role === 'prof';

  // Hook travail uniquement pour les eleves
  const {
    travail,
    isLoading: travailLoading,
    isSaving,
    error: travailError,
    lastSaved,
    updateContent,
    updateDraftContent,
    updateSelfEvaluation,
    updateRessourceAnnotations,
    updateRessourceNotes,
    updateRessourceImageShapes,
    submit,
  } = useTravail(isPreviewMode ? null : devoirId);

  const {
    grille,
    isLoading: grilleLoading,
    error: grilleError,
  } = useGrille(devoir?.grille || null);

  // IA - state et hook remontés ici pour orchestrer FlipEditor ↔ AssistancePanel
  // accesIA : peut demander de nouvelles analyses (pas soumis)
  const accesIA = !isPreviewMode && travail?.status !== 'submitted' && devoir?.accesIA === true;
  // showAiData : charger les résultats IA existants (même après soumission)
  const showAiData = !isPreviewMode && devoir?.accesIA === true;
  const [activeTab, setActiveTab] = useState<TabType>('consignes');
  const [panelOpen, setPanelOpen] = useState<boolean>(true);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  // Conseils IA affichés dans le panneau (ids composites `type:itemId`) —
  // quand l'onglet Aide IA est ouvert, seules leurs bulles restent visibles
  const [aiDisplayedIds, setAiDisplayedIds] = useState<string[]>([]);
  // État d'interface du panneau Aide IA (onglet, mode, conseil courant) —
  // conservé ici pour survivre aux allers-retours entre onglets du rail
  const [aiUiState, setAiUiState] = useState<AiTabUiState | null>(null);
  // Aide dictionnaire permanente (toggle dans l'onglet Ressources)
  const [dictionaryEnabled, setDictionaryEnabled] = useState(false);
  // Vocabulaire : index de l'evaluation passee a revoir dans la colonne de gauche (null = vue normale)
  const [viewingVocabEvalIndex, setViewingVocabEvalIndex] = useState<number | null>(null);

  const {
    suggestions: aiSuggestions,
    activeRequest: aiActiveRequest,
    error: aiError,
    requestAnalysis,
    dismissSuggestion,
    usedTypes: aiUsedTypes,
  } = useAiSuggestions(
    showAiData ? travail?.id : undefined,
    showAiData ? devoirId : undefined,
  );

  // IA grille — évaluation par critère (charger même après soumission)
  const {
    result: aiGridResult,
    isRequesting: aiGridRequesting,
    error: aiGridError,
    requestEvaluation: requestAiGrid,
  } = useAiGridEvaluation(
    showAiData ? travail?.id : undefined,
    showAiData ? devoirId : undefined,
    showAiData && grille?.id ? grille.id : undefined,
  );

  // Élève sans classe → retour au login
  useEffect(() => {
    if ((authLoading && !isAuthenticated) || classesLoading || isPreviewMode) return;
    if (role === 'eleve' && classes.length === 0) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, classesLoading, isPreviewMode, role, classes, router]);

  // Fetch devoir
  useEffect(() => {
    async function fetchDevoir() {
      if (!devoirId) return;

      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const res = await fetch(`/api/devoirs/${devoirId}`, {
          headers,
        });

        const json = await res.json();

        if (json.success) {
          setDevoir(json.data);

          // Si type rechercher, charger le questionnaire et la réponse de l'élève
          if (json.data.typeTravail === 'rechercher' && json.data.questionnaireId) {
            try {
              const qRes = await fetch(
                `/api/navigkid/questionnaire?id=${json.data.questionnaireId}`,
                { headers }
              );
              const qJson = await qRes.json();
              if (qJson.success && qJson.data?.questions) {
                setNkQuestions(qJson.data.questions);
              }

              // La réponse sera chargée quand le travail sera disponible (via useEffect séparé)
            } catch (err) {
              console.error('Erreur fetch navigkid:', err);
            }
          }
        } else {
          setDevoirError(json.message || 'Erreur lors du chargement du devoir');
        }
      } catch (err) {
        console.error('Erreur fetch devoir:', err);
        setDevoirError('Erreur lors du chargement du devoir');
      } finally {
        setDevoirLoading(false);
      }
    }

    if (isAuthenticated) {
      fetchDevoir();
    }
  }, [isAuthenticated, devoirId, getAuthHeaders]);

  // Fetch correction du prof (visible par l'eleve)
  useEffect(() => {
    async function fetchCorrection() {
      if (!travail?.id) return;

      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const res = await fetch(`/api/corrections?travailId=${travail.id}`, {
          headers,
        });
        const json = await res.json();

        if (json.success && json.data) {
          setCorrection(json.data);
        }
      } catch (err) {
        // Silently fail - correction is optional
        console.error('Erreur fetch correction:', err);
      }
    }

    if (isAuthenticated && !isPreviewMode && travail) {
      fetchCorrection();
    }
  }, [isAuthenticated, isPreviewMode, travail?.id, getAuthHeaders]);

  // Fetch réponse NavigKid de l'élève
  useEffect(() => {
    async function fetchNkReponse() {
      if (!devoir?.questionnaireId || !travail?.studentId) return;
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const rRes = await fetch(
          `/api/navigkid/reponse?questionnaireId=${devoir.questionnaireId}&eleveId=${travail.studentId}`,
          { headers }
        );
        const rJson = await rRes.json();
        if (rJson.success && rJson.data) {
          setNkReponse(rJson.data);
        }
      } catch (err) {
        console.error('Erreur fetch navigkid reponse:', err);
      }
    }

    if (isAuthenticated && devoir?.typeTravail === 'rechercher' && travail?.studentId) {
      fetchNkReponse();
    }
  }, [isAuthenticated, devoir?.typeTravail, devoir?.questionnaireId, travail?.studentId, getAuthHeaders]);

  const handleContentChange = useCallback((content: string) => {
    if (!isPreviewMode) {
      updateContent(content);
    }
  }, [updateContent, isPreviewMode]);

  const handleDraftChange = useCallback((draft: DraftContent) => {
    if (!isPreviewMode) {
      updateDraftContent(draft);
    }
  }, [updateDraftContent, isPreviewMode]);

  const handleSelfEvaluationChange = useCallback((evaluation: Record<string, number>) => {
    if (!isPreviewMode) {
      updateSelfEvaluation(evaluation);
    }
  }, [updateSelfEvaluation, isPreviewMode]);

  const handleSubmitClick = () => {
    setShowConfirmModal(true);
  };

  const handleConfirmSubmit = async () => {
    setShowConfirmModal(false);
    setIsSubmitting(true);
    try {
      const success = await submit();
      if (success) {
        // Success - le statut sera mis a jour via le hook
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelSubmit = () => {
    setShowConfirmModal(false);
  };

  // IA — requête → auto-switch vers onglet "Aide IA"
  const handleAiRequest = useCallback(async (type: AiSuggestionType) => {
    const currentContent = travail?.content || '';
    if (!currentContent.replace(/<[^>]*>/g, '').trim()) return;
    const result = await requestAnalysis(type, currentContent);
    if (result) setActiveTab('ia');
  }, [requestAnalysis, travail?.content]);

  // IA grille — demander évaluation
  const handleRequestAiGrid = useCallback(async () => {
    const content = travail?.content || '';
    if (!content.replace(/<[^>]*>/g, '').trim()) return;
    await requestAiGrid(content);
  }, [requestAiGrid, travail?.content]);

  // IA — clic décoration inline → highlight permanent la carte dans l'onglet
  const handleDecorationClick = useCallback((type: AiSuggestionType, itemId: string) => {
    setActiveTab('ia');
    const compositeId = `${type}:${itemId}`;
    // Reset puis re-set pour re-trigger le scroll si même item
    setHighlightedItemId(null);
    requestAnimationFrame(() => setHighlightedItemId(compositeId));
  }, []);

  const handleBack = () => {
    if (isPreviewMode) {
      router.push('/activites');
    } else {
      router.push('/dashboard');
    }
  };

  // Score du prof (visible par l'élève quand correction rendue)
  const profScore = useMemo(() => {
    if (!correction?.visibleParEleve || !correction.evaluation || !grille) return null;
    let totalPoints = 0;
    let maxPoints = 0;
    const hidden = new Set(devoir?.hiddenCriteria || []);
    grille.criteria.forEach((criterion) => {
      const level = correction.evaluation![criterion.id];
      // Critère masqué pour ce devoir et non évalué : hors total
      if (hidden.has(criterion.id) && level === undefined) return;
      if (level !== undefined) {
        const pct = LEVEL_PERCENTAGES[level] ?? 0;
        totalPoints += (criterion.weight * pct) / 100;
      }
      maxPoints += criterion.weight;
    });
    if (maxPoints === 0) return null;
    const pts = Math.round(totalPoints * 10) / 10;
    const percent = Math.round((totalPoints / maxPoints) * 100);
    return { pts, max: maxPoints, percent };
  }, [correction, grille, devoir]);

  // Loading states - pour preview mode, on n'attend pas travailLoading
  const isLoading = (authLoading && !isAuthenticated) || devoirLoading || (!isPreviewMode && travailLoading);

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <span>Chargement...</span>
      </div>
    );
  }

  // Error states
  if (devoirError) {
    return (
      <div className={styles.errorContainer}>
        <span className={styles.errorIcon}>⚠️</span>
        <h2>Erreur</h2>
        <p>{devoirError}</p>
        <button onClick={handleBack} className={styles.errorButton}>
          Retour
        </button>
      </div>
    );
  }

  if (!isPreviewMode && travailError) {
    return (
      <div className={styles.errorContainer}>
        <span className={styles.errorIcon}>⚠️</span>
        <h2>Erreur</h2>
        <p>{travailError}</p>
        <button onClick={handleBack} className={styles.errorButton}>
          Retour
        </button>
      </div>
    );
  }

  if (!devoir) {
    return (
      <div className={styles.errorContainer}>
        <span className={styles.errorIcon}>📋</span>
        <h2>Devoir non trouve</h2>
        <p>Ce devoir n&apos;existe pas ou n&apos;est plus disponible.</p>
        <button onClick={handleBack} className={styles.errorButton}>
          Retour
        </button>
      </div>
    );
  }

  // Pour les eleves, verifier qu'on a le travail
  if (!isPreviewMode && !travail) {
    return (
      <div className={styles.errorContainer}>
        <span className={styles.errorIcon}>📋</span>
        <h2>Erreur</h2>
        <p>Impossible de charger votre travail.</p>
        <button onClick={handleBack} className={styles.errorButton}>
          Retour
        </button>
      </div>
    );
  }

  const isSubmitted = travail?.status === 'submitted';
  const isDisabled = isPreviewMode || isSubmitted;
  const isRecherche = devoir?.typeTravail === 'rechercher';
  const isVocabulaire = devoir?.typeTravail === 'vocabulaire';
  // Type lire avec questionnaire : la colonne de gauche devient le questionnaire
  const isLectureQuiz = devoir?.typeTravail === 'lire' && !!devoir?.lectureQuiz;

  // ── Configuration du rail : icones + visibilite par type d'activite ──
  const hasAiSuggestions = aiSuggestions
    ? Object.values(aiSuggestions).some(
        (s) => s !== null && s.suggestions.some((item) => !item.dismissed)
      )
    : false;
  const hasRemarques = !!correction?.annotatedContent;
  const hasNavigkid = nkQuestions.length > 0;

  // Ordre : Consignes → Ressources → Aide IA → Remarques → Recherche → Évaluation
  const railTabs: RailTab[] = [];
  railTabs.push({ id: 'consignes', label: 'Consignes', icon: ICON_CONSIGNES });
  railTabs.push({ id: 'ressources', label: 'Ressources', icon: ICON_RESSOURCES });
  if (!isRecherche && !isLectureQuiz && (accesIA || showAiData)) {
    railTabs.push({
      id: 'ia',
      label: 'Aide IA à la réécriture',
      icon: ICON_IA,
      hasBadge: hasAiSuggestions,
    });
  }
  // En vocabulaire, le prof n'intervient que dans l'evaluation : pas d'onglet remarques
  if (!isVocabulaire) {
    railTabs.push({
      id: 'remarques',
      label: 'Remarques du professeur',
      icon: ICON_REMARQUES,
      highlight: hasRemarques,
    });
  }
  if (hasNavigkid) {
    railTabs.push({
      id: 'recherche',
      label: isRecherche ? 'Statistiques' : 'Recherche',
      icon: ICON_RECHERCHE,
    });
  }
  railTabs.push({ id: 'grille', label: 'Évaluation', icon: ICON_GRILLE });

  const PANEL_TITLES: Partial<Record<TabType, string>> = {
    consignes: 'Consignes',
    ressources: 'Ressources',
    grille: 'Évaluation',
    ia: 'Aide IA à la réécriture',
    remarques: 'Remarques du professeur',
    recherche: isRecherche ? 'Statistiques' : 'Recherche',
  };
  const panelTitle = PANEL_TITLES[activeTab] ?? '';

  const profScoreBadge = !isPreviewMode && profScore ? (
    <span
      className={styles.profScoreBadge}
      style={{ background: profScore.percent < 50 ? '#C55764' : '#2a4d73' }}
    >
      {profScore.pts}/{profScore.max} ({profScore.percent}%)
    </span>
  ) : null;

  return (
    <div className={`${styles.page} ${isPreviewMode ? styles.previewMode : ''}`}>
      {isPreviewMode && (
        <div className={styles.previewBanner}>
          <span>👁️ Mode previsualisation - Vue eleve</span>
          <button className={styles.previewBackButton} onClick={() => router.push('/dashboard')}>
            Retour au tableau de bord
          </button>
        </div>
      )}

      <WorkTopBar
        title={devoir.intitule}
        status={isPreviewMode ? 'draft' : (travail?.status || 'draft')}
        isSaving={isSaving}
        lastSaved={lastSaved}
        onSubmit={handleSubmitClick}
        isSubmitting={isSubmitting}
        isPreviewMode={isPreviewMode}
        submissionClosed={!isPreviewMode && (
          devoir.corrigeDisponible ||
          correction?.visibleParEleve === true ||
          !!travail?.nonRendu
        )}
      />

      <main className={styles.main}>
        {/* Colonne 1 : zone de travail (prend l'espace restant) */}
        {isVocabulaire ? (
          <div className={styles.editorSection}>
            <div className={styles.editorHeader}>
              <h2>Vocabulaire</h2>
            </div>
            <VocabulaireActivity
              forcedThemes={devoir?.vocabulaireThemes}
              savedState={
                travail?.content
                  ? (() => { try { return JSON.parse(travail.content); } catch { return null; } })()
                  : null
              }
              onStateChange={
                isDisabled
                  ? undefined
                  : (state) => updateContent(JSON.stringify(state))
              }
              disabled={isDisabled}
              viewingEvalAttempt={(() => {
                if (viewingVocabEvalIndex === null || !travail?.content) return null;
                try {
                  const parsed = JSON.parse(travail.content);
                  return parsed.evaluationAttempts?.[viewingVocabEvalIndex] ?? null;
                } catch {
                  return null;
                }
              })()}
              viewingEvalIndex={viewingVocabEvalIndex}
              onCloseEvalView={() => setViewingVocabEvalIndex(null)}
              onShowEvaluationTab={() => {
                setActiveTab('grille');
                setPanelOpen(true);
              }}
            />
          </div>
        ) : isRecherche ? (
          <div className={styles.editorSection}>
            <div className={styles.editorHeader}>
              <h2>Questionnaire de recherche</h2>
            </div>
            <RechercheResponseViewer
              questions={nkQuestions}
              reponse={nkReponse}
              studentView={!isPreviewMode}
            />
          </div>
        ) : isLectureQuiz ? (
          <div className={styles.editorSection}>
            <div className={styles.editorHeader}>
              <h2>Questionnaire de lecture</h2>
            </div>
            <LectureQuizActivity
              quiz={devoir.lectureQuiz!}
              savedState={isPreviewMode ? null : parseLectureAnswers(travail?.content)}
              onStateChange={
                isDisabled
                  ? undefined
                  : (state) => updateContent(JSON.stringify(state))
              }
              disabled={isDisabled}
              onOpenRessources={() => {
                setActiveTab('ressources');
                setPanelOpen(true);
              }}
              showCorrection={!isPreviewMode && isSubmitted && devoir.corrigeDisponible === true}
            />
          </div>
        ) : (
          <div className={styles.editorSection}>
            <div className={styles.editorHeader}>
              <h2>Mon travail</h2>
            </div>
            <div className={styles.editorWrapper}>
              <FlipEditor
                content={isPreviewMode ? '' : (travail?.content || '')}
                onContentChange={handleContentChange}
                draftContent={isPreviewMode ? null : (travail?.draftContent || null)}
                onDraftChange={handleDraftChange}
                grille={grille}
                disabled={isDisabled}
                placeholder={isPreviewMode ? "Zone de redaction de l'eleve..." : "Commencez à rédiger votre travail ici..."}
                draftAnnotations={correction?.draftAnnotations}
                accesIA={showAiData}
                aiSuggestions={aiSuggestions}
                onDecorationClick={handleDecorationClick}
                aiBubbleFilter={panelOpen && activeTab === 'ia' ? aiDisplayedIds : null}
                dictionaryEnabled={dictionaryEnabled}
                inverted={devoir.flipInverted ?? false}
              />
            </div>
          </div>
        )}

        {/* Colonne 2 (panneau redimensionnable) + rail icones a droite */}
        <WorkspaceRail
          tabs={railTabs}
          activeTab={activeTab}
          onActiveTabChange={(id) => setActiveTab(id as TabType)}
          isOpen={panelOpen}
          onIsOpenChange={setPanelOpen}
          panelTitle={panelTitle}
          panelHeaderExtra={profScoreBadge}
          storageKey="activite-rail-width"
        >
          <DictionaryClickLayer enabled={dictionaryEnabled}>
          <AssistancePanel
            nonRendu={travail?.nonRendu ?? null}
            devoir={devoir}
            grille={grille}
            grilleLoading={grilleLoading}
            grilleError={grilleError}
            selfEvaluation={isPreviewMode ? null : (travail?.selfEvaluation || null)}
            onSelfEvaluationChange={handleSelfEvaluationChange}
            disabled={isDisabled}
            studentName={travail?.studentName}
            correction={correction}
            studentContent={travail?.content || ''}
            showRemarquesTab={!isVocabulaire}
            ressourceAnnotations={travail?.ressourceAnnotations}
            onRessourceAnnotationsChange={isPreviewMode ? undefined : updateRessourceAnnotations}
            ressourceNotes={travail?.ressourceNotes}
            onRessourceNotesChange={isPreviewMode ? undefined : updateRessourceNotes}
            ressourceImageShapes={travail?.ressourceImageShapes}
            onRessourceImageShapesChange={isPreviewMode ? undefined : updateRessourceImageShapes}
            dictionaryEnabled={dictionaryEnabled}
            onDictionaryEnabledChange={setDictionaryEnabled}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            accesIA={accesIA}
            showAiData={showAiData}
            aiSuggestions={aiSuggestions}
            aiActiveRequest={aiActiveRequest}
            aiError={aiError}
            aiUsedTypes={aiUsedTypes}
            onAiRequest={handleAiRequest}
            onAiDismiss={dismissSuggestion}
            highlightedItemId={highlightedItemId}
            onAiDisplayedChange={setAiDisplayedIds}
            aiUiState={aiUiState}
            onAiUiStateChange={setAiUiState}
            aiGridResult={aiGridResult}
            aiGridRequesting={aiGridRequesting}
            aiGridError={aiGridError}
            onRequestAiGrid={handleRequestAiGrid}
            navigkidQuestions={nkQuestions.length > 0 ? nkQuestions : undefined}
            navigkidReponse={nkReponse}
            rechercheMode={isRecherche}
            vocabState={isVocabulaire && travail?.content ? (() => { try { return JSON.parse(travail.content); } catch { return null; } })() : undefined}
            onSelectVocabEvalAttempt={isVocabulaire ? (i) => setViewingVocabEvalIndex(i) : undefined}
            selectedVocabEvalIndex={viewingVocabEvalIndex}
            hideTabs={true}
          />
          </DictionaryClickLayer>
        </WorkspaceRail>
      </main>

      {showConfirmModal && !isPreviewMode && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>Confirmer la remise</h3>
            <p className={styles.modalText}>
              Etes-vous sur de vouloir remettre votre travail ? Cette action est definitive
              et vous ne pourrez plus modifier votre travail apres la remise.
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancel}
                onClick={handleCancelSubmit}
              >
                Annuler
              </button>
              <button
                type="button"
                className={styles.modalConfirm}
                onClick={handleConfirmSubmit}
              >
                Confirmer la remise
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
