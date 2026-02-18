'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useGrille } from '@/hooks/useGrille';
import { useCorrection, calculateScore } from '@/hooks/useCorrection';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useAiGridEvaluation } from '@/hooks/useAiGridEvaluation';
import { useAiSuggestions } from '@/hooks/useAiSuggestions';
import { getDraftType } from '@/lib/draft-utils';
import { blobToDataUrl } from '@/lib/firebase/audio-storage';
import AssistancePanel from '@/components/AssistancePanel';
import UserAvatar from '@/components/UserAvatar';
import type { Travail } from '@/types/travail';
import type { Devoir } from '@/types/devoir';
import type { DraftType } from '@/types/travail';
import type { DraftItemAnnotation } from '@/types/correction';
import styles from './travail-detail.module.css';
import flipStyles from '@/components/FlipEditor/FlipEditor.module.css';

const AnnotationEditor = dynamic(
  () => import('@/components/AnnotationEditor'),
  { ssr: false }
);

const DraftEditor = dynamic(
  () => import('@/components/DraftEditor/DraftEditor'),
  { ssr: false }
);

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function isSuccessLevel(level: number): boolean {
  return level >= 3;
}

export default function TravailDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { devoirId, travailId } = params as { devoirId: string; travailId: string };

  const { user, isAuthenticated, role, isLoading: authLoading } = useAuth();
  const [travail, setTravail] = useState<Travail | null>(null);
  const [devoir, setDevoir] = useState<Devoir | null>(null);
  const [travaux, setTravaux] = useState<Travail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReturning, setIsReturning] = useState(false);

  const {
    grille,
    isLoading: grilleLoading,
    error: grilleError,
  } = useGrille(devoir?.grille || null);

  const {
    correction,
    isSaving: correctionSaving,
    updateEvaluation,
    updateAnnotatedContent,
    updateAudioAnnotations,
    updateDraftAnnotations,
    updateCommentaireGeneral,
    updateCommentaireGeneralAudio,
    toggleVisibility,
  } = useCorrection(
    travailId || null,
    devoirId || null,
    travail?.studentId || null,
    grille
  );

  // IA grille — charger l'évaluation IA si elle existe
  const {
    result: aiGridResult,
  } = useAiGridEvaluation(
    devoir?.accesIA ? travailId : undefined,
    devoir?.accesIA ? devoirId : undefined,
    devoir?.accesIA && grille?.id ? grille.id : undefined,
  );

  // IA suggestions de réécriture — lecture seule côté prof
  const {
    suggestions: aiSuggestions,
    usedTypes: aiUsedTypes,
  } = useAiSuggestions(
    devoir?.accesIA ? travailId : undefined,
    devoir?.accesIA ? devoirId : undefined,
  );

  // Flip state (recto = texte annoté, verso = brouillon élève)
  type FlipSide = 'recto' | 'verso';
  const [flipSide, setFlipSide] = useState<FlipSide>('recto');
  const [flipPhase, setFlipPhase] = useState<'idle' | 'out' | 'in'>('idle');
  const [isFlipping, setIsFlipping] = useState(false);

  const draftType: DraftType = useMemo(() => getDraftType(grille), [grille]);
  const hasDraft = !!travail?.draftContent;

  const handleFlip = useCallback(() => {
    if (isFlipping) return;
    setIsFlipping(true);
    setFlipPhase('out');
    setTimeout(() => {
      setFlipSide(s => s === 'recto' ? 'verso' : 'recto');
      setFlipPhase('in');
      setTimeout(() => {
        setFlipPhase('idle');
        setIsFlipping(false);
      }, 280);
    }, 280);
  }, [isFlipping]);

  // Draft annotations — enregistrement vocal
  const { isRecording: isDraftRecording, recordingDuration: draftRecordingDuration, startRecording: startDraftRecording, stopRecording: stopDraftRecording } = useAudioRecorder();
  const [draftRecordingItemId, setDraftRecordingItemId] = useState<string | null>(null);

  // Commentaire général — enregistrement vocal
  const { isRecording: isCommentRecording, recordingDuration: commentRecordingDuration, startRecording: startCommentRecording, stopRecording: stopCommentRecording } = useAudioRecorder();
  const [isPlayingComment, setIsPlayingComment] = useState(false);
  const commentAudioRef = useRef<HTMLAudioElement | null>(null);

  const handleDraftAnnotationChange = useCallback((itemId: string, annotation: DraftItemAnnotation) => {
    const current = correction?.draftAnnotations || {};
    const updated = { ...current, [itemId]: annotation };
    // Nettoyer les annotations vides
    if (!annotation.status && !annotation.audio) {
      delete updated[itemId];
    }
    updateDraftAnnotations(updated);
  }, [correction?.draftAnnotations, updateDraftAnnotations]);

  const handleStartDraftRecording = useCallback((itemId: string) => {
    setDraftRecordingItemId(itemId);
    startDraftRecording();
  }, [startDraftRecording]);

  const handleStopDraftRecording = useCallback(async () => {
    const blob = await stopDraftRecording();
    if (blob && draftRecordingItemId) {
      const dataUrl = await blobToDataUrl(blob);
      const current = correction?.draftAnnotations || {};
      const existing = current[draftRecordingItemId] || {};
      const updated = { ...current, [draftRecordingItemId]: { ...existing, audio: dataUrl } };
      updateDraftAnnotations(updated);
    }
    setDraftRecordingItemId(null);
  }, [stopDraftRecording, draftRecordingItemId, correction?.draftAnnotations, updateDraftAnnotations]);

  // Commentaire général — handlers audio
  const handleStopCommentRecording = useCallback(async () => {
    const blob = await stopCommentRecording();
    if (blob) {
      const dataUrl = await blobToDataUrl(blob);
      await updateCommentaireGeneralAudio(dataUrl);
    }
  }, [stopCommentRecording, updateCommentaireGeneralAudio]);

  const handlePlayComment = useCallback(() => {
    if (!correction?.commentaireGeneralAudio) return;
    if (commentAudioRef.current) {
      commentAudioRef.current.pause();
    }
    const audio = new Audio(correction.commentaireGeneralAudio);
    commentAudioRef.current = audio;
    setIsPlayingComment(true);
    audio.onended = () => setIsPlayingComment(false);
    audio.play();
  }, [correction?.commentaireGeneralAudio]);

  const handleStopPlayComment = useCallback(() => {
    if (commentAudioRef.current) {
      commentAudioRef.current.pause();
      commentAudioRef.current.currentTime = 0;
    }
    setIsPlayingComment(false);
  }, []);

  const handleDeleteCommentAudio = useCallback(async () => {
    await updateCommentaireGeneralAudio(undefined);
    if (commentAudioRef.current) {
      commentAudioRef.current.pause();
    }
    setIsPlayingComment(false);
  }, [updateCommentaireGeneralAudio]);

  const getAuthHeaders = useCallback(async () => {
    if (!user) return null;
    const token = await user.getIdToken();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }, [user]);

  useEffect(() => {
    if (!authLoading && role !== 'prof') {
      router.replace('/dashboard');
    }
  }, [authLoading, role, router]);

  useEffect(() => {
    async function fetchData() {
      const headers = await getAuthHeaders();
      if (!headers) return;

      setIsLoading(true);
      setError(null);

      try {
        const travailRes = await fetch(`/api/travaux/${travailId}`, { headers });
        const travailJson = await travailRes.json();

        if (travailJson.success) {
          setTravail(travailJson.data);
        } else {
          setError('Travail non trouvé');
          return;
        }

        const devoirRes = await fetch(`/api/devoirs/${devoirId}`, { headers });
        const devoirJson = await devoirRes.json();

        if (devoirJson.success) {
          setDevoir(devoirJson.data);
        } else {
          setError('Devoir non trouvé');
          return;
        }

        const travauxRes = await fetch(`/api/travaux?devoirId=${devoirId}`, { headers });
        const travauxJson = await travauxRes.json();

        if (travauxJson.success) {
          setTravaux(travauxJson.data);
        }
      } catch (err) {
        console.error('Erreur fetch data:', err);
        setError('Erreur lors du chargement');
      } finally {
        setIsLoading(false);
      }
    }

    if (isAuthenticated && role === 'prof') {
      fetchData();
    }
  }, [isAuthenticated, role, devoirId, travailId, getAuthHeaders]);

  const handleBack = () => {
    router.push(`/dashboard/travaux/${devoirId}`);
  };

  const currentIndex = travaux.findIndex(t => t.id === travailId);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < travaux.length - 1;

  const handlePrevious = () => {
    if (hasPrevious) {
      const prevTravail = travaux[currentIndex - 1];
      router.push(`/dashboard/travaux/${devoirId}/${prevTravail.id}`);
    }
  };

  const handleNext = () => {
    if (hasNext) {
      const nextTravail = travaux[currentIndex + 1];
      router.push(`/dashboard/travaux/${devoirId}/${nextTravail.id}`);
    }
  };

  const handleSelectTravail = (id: string) => {
    router.push(`/dashboard/travaux/${devoirId}/${id}`);
  };

  const handleReturnForCorrection = async () => {
    if (!travail || !user) return;

    const confirmed = window.confirm(
      `Êtes-vous sûr de vouloir renvoyer le travail de ${travail.studentName} en correction ? L'élève pourra à nouveau modifier son travail.`
    );

    if (!confirmed) return;

    setIsReturning(true);

    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/travaux/${travail.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'draft' }),
      });

      const json = await res.json();

      if (json.success) {
        setTravail(prev => prev ? { ...prev, status: 'draft', submittedAt: null } : null);
        alert('Le travail a été renvoyé en correction. L\'élève peut maintenant le modifier.');
      } else {
        alert('Erreur : ' + (json.message || 'Impossible de renvoyer le travail'));
      }
    } catch (err) {
      console.error('Erreur handleReturnForCorrection:', err);
      alert('Erreur lors du renvoi du travail');
    } finally {
      setIsReturning(false);
    }
  };

  // Gestion du clic prof sur un niveau
  const handleProfLevelClick = useCallback((criterionId: string, level: number) => {
    const currentEval = correction?.evaluation || {};
    const newEval = { ...currentEval };

    // Toggle: si deja selectionne, deselectionner
    if (newEval[criterionId] === level) {
      delete newEval[criterionId];
    } else {
      newEval[criterionId] = level;
    }

    updateEvaluation(newEval);
  }, [correction, updateEvaluation]);

  // Score prof
  const profScore = correction?.evaluation
    ? calculateScore(correction.evaluation, grille)
    : null;

  // Travail remis en retard ?
  const isLate = useMemo(() => {
    if (!devoir?.dateRemise || !travail?.submittedAt) return false;
    const deadline = new Date(devoir.dateRemise);
    deadline.setHours(23, 59, 59, 999);
    return new Date(travail.submittedAt) > deadline;
  }, [devoir?.dateRemise, travail?.submittedAt]);

  if (authLoading || isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <span>Chargement...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <span>⚠️</span>
        <h2>Erreur</h2>
        <p>{error}</p>
        <button onClick={handleBack} className={styles.backButton}>
          Retour à la liste
        </button>
      </div>
    );
  }

  if (!travail || !devoir) {
    return (
      <div className={styles.errorContainer}>
        <span>📋</span>
        <h2>Données introuvables</h2>
        <button onClick={handleBack} className={styles.backButton}>
          Retour à la liste
        </button>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backBtn} onClick={handleBack}>
            ←
          </button>

          <div className={styles.headerContent}>
            <h1 className={styles.title}>{devoir.intitule}</h1>
            <p className={styles.subtitle}>
              Travail de <strong>{travail.studentName}</strong>
            </p>
          </div>

          {travaux.length > 1 && (
            <div className={styles.navigation}>
              <button
                className={styles.navBtn}
                onClick={handlePrevious}
                disabled={!hasPrevious}
                title="Travail précédent"
              >
                ‹
              </button>
              <select
                className={styles.navSelect}
                value={travailId}
                onChange={(e) => handleSelectTravail(e.target.value)}
                title="Sélectionner un élève"
              >
                {travaux.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.studentName} {t.status === 'submitted' ? '✓' : '📝'}
                  </option>
                ))}
              </select>
              <button
                className={styles.navBtn}
                onClick={handleNext}
                disabled={!hasNext}
                title="Travail suivant"
              >
                ›
              </button>
            </div>
          )}

          <div className={styles.headerActions}>
            {travail.status === 'submitted' && (
              <button
                className={styles.returnBtn}
                onClick={handleReturnForCorrection}
                disabled={isReturning}
                title="Renvoyer le travail à l'élève pour correction"
              >
                {isReturning ? '...' : '↩ Renvoyer pour correction'}
              </button>
            )}

            <label className={`${styles.visibilityToggleBox} ${travail.status !== 'submitted' ? styles.visibilityDisabled : ''}`}>
              <span className={styles.visibilityLabel}>Rendre visible pour cet élève</span>
              <input
                type="checkbox"
                checked={correction?.visibleParEleve || false}
                onChange={toggleVisibility}
                disabled={travail.status !== 'submitted'}
                className={styles.toggleInput}
              />
              <span className={styles.toggleSwitch} />
            </label>
          </div>
        </div>

        <div className={styles.headerRight}>
          <UserAvatar />
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.contentSection}>
          <div className={styles.sectionHeader}>
            <h2>Contenu du travail</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isLate && <span className={styles.lateBadge}>En retard</span>}
              <div className={styles.statusBadge}>
                {travail.status === 'submitted' ? (
                  <>
                    <span className={styles.statusIcon}>✓</span>
                    <span>Remis le {new Date(travail.submittedAt!).toLocaleDateString('fr-BE')}</span>
                  </>
                ) : (
                  <>
                    <span className={styles.statusIcon}>📝</span>
                    <span>Brouillon</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Flip bar — visible seulement si l'élève a un brouillon */}
          {hasDraft && (
            <div className={flipStyles.flipBar}>
              <div className={flipStyles.flipToggle}>
                <button
                  type="button"
                  className={`${flipStyles.flipButton} ${flipSide === 'recto' ? flipStyles.flipButtonActive : ''}`}
                  onClick={() => flipSide !== 'recto' && handleFlip()}
                  disabled={isFlipping}
                >
                  <span className={flipStyles.flipIcon}>✏️</span>
                  <span className={flipStyles.flipLabel}>Texte de l&apos;élève</span>
                </button>
                <button
                  type="button"
                  className={`${flipStyles.flipButton} ${flipSide === 'verso' ? flipStyles.flipButtonActive : ''}`}
                  onClick={() => flipSide !== 'verso' && handleFlip()}
                  disabled={isFlipping}
                >
                  <span className={flipStyles.flipIcon}>📝</span>
                  <span className={flipStyles.flipLabel}>Planification de l&apos;élève</span>
                </button>
              </div>
              <button
                type="button"
                className={flipStyles.flipAction}
                onClick={handleFlip}
                disabled={isFlipping}
                title={`Retourner vers ${flipSide === 'recto' ? 'Brouillon' : 'Texte'}`}
              >
                <span className={`${flipStyles.flipActionIcon} ${isFlipping ? flipStyles.spinning : ''}`}>
                  🔄
                </span>
                <span className={flipStyles.flipActionText}>Retourner</span>
              </button>
            </div>
          )}

          {/* Contenu avec animation flip */}
          <div className={flipStyles.flipContainer}>
            <div
              className={`
                ${flipStyles.flipCard}
                ${flipPhase === 'out' ? flipStyles.flipOut : ''}
                ${flipPhase === 'in' ? flipStyles.flipIn : ''}
              `}
            >
              {flipSide === 'recto' ? (
                <div className={flipStyles.cardFace}>
                  {travail.content ? (
                    <AnnotationEditor
                      studentContent={travail.content}
                      annotatedContent={correction?.annotatedContent}
                      audioAnnotations={correction?.audioAnnotations}
                      correctionId={`CORR-${travailId}`}
                      onAnnotatedContentChange={updateAnnotatedContent}
                      onAudioAnnotationsChange={updateAudioAnnotations}
                      aiSuggestions={devoir.accesIA ? aiSuggestions : undefined}
                    />
                  ) : (
                    <div className={styles.contentBox}>
                      <p className={styles.emptyContent}>Aucun contenu rédigé</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className={flipStyles.cardFace}>
                  {travail.draftContent ? (
                    <DraftEditor
                      draftType={draftType}
                      draft={travail.draftContent}
                      onChange={() => {}}
                      disabled={true}
                      draftAnnotations={correction?.draftAnnotations || {}}
                      onAnnotationChange={handleDraftAnnotationChange}
                      isRecording={isDraftRecording}
                      recordingItemId={draftRecordingItemId}
                      recordingDuration={draftRecordingDuration}
                      onStartRecording={handleStartDraftRecording}
                      onStopRecording={handleStopDraftRecording}
                    />
                  ) : (
                    <div className={styles.contentBox}>
                      <p className={styles.emptyContent}>Aucun brouillon</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={styles.evaluationSection}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionHeaderTop}>
              <div className={styles.sectionHeaderLeft}>
                <h2>Outils d&apos;évaluation et de correction</h2>
              </div>
              <div className={styles.sectionHeaderRight}>
                {correctionSaving && (
                  <span className={styles.savingIndicator}>Sauvegarde...</span>
                )}
                {profScore !== null && (
                  <span className={styles.scoreDisplay}>
                    {profScore}%
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className={styles.assistanceWrapper}>
            <AssistancePanel
              devoir={devoir}
              grille={grille}
              grilleLoading={grilleLoading}
              grilleError={grilleError}
              selfEvaluation={travail.selfEvaluation || null}
              onSelfEvaluationChange={updateEvaluation}
              disabled={false}
              studentName={travail.studentName}
              correction={correction}
              studentContent={travail.content}
              showRemarquesTab={false}
              isProfessorView={true}
              showAiData={!!devoir.accesIA}
              aiGridResult={aiGridResult}
              studentRessourceAnnotations={travail.ressourceAnnotations}
              studentRessourceNotes={travail.ressourceNotes}
            />
          </div>

          {/* Commentaire général du professeur */}
          <div className={styles.commentSection}>
            <h3 className={styles.commentTitle}>Commentaire général</h3>
            <div className={styles.commentRow}>
              <textarea
                className={styles.commentTextarea}
                value={correction?.commentaireGeneral || ''}
                onChange={(e) => updateCommentaireGeneral(e.target.value)}
                placeholder="Commentaire écrit pour l'élève..."
                rows={3}
              />
              <div className={styles.commentAudioCol}>
                {isCommentRecording ? (
                  <div className={styles.commentRecording}>
                    <span className={styles.commentRecDot} />
                    <span className={styles.commentRecTime}>
                      {Math.floor(commentRecordingDuration / 60).toString().padStart(2, '0')}:{(commentRecordingDuration % 60).toString().padStart(2, '0')}
                    </span>
                    <button
                      type="button"
                      className={styles.commentStopBtn}
                      onClick={handleStopCommentRecording}
                      title="Arrêter l'enregistrement"
                    >
                      ■
                    </button>
                  </div>
                ) : correction?.commentaireGeneralAudio ? (
                  <div className={styles.commentAudioPlayback}>
                    <button
                      type="button"
                      className={styles.commentPlayBtn}
                      onClick={isPlayingComment ? handleStopPlayComment : handlePlayComment}
                      title={isPlayingComment ? 'Arrêter' : 'Écouter'}
                    >
                      {isPlayingComment ? '⏸' : '▶'}
                    </button>
                    <button
                      type="button"
                      className={styles.commentDeleteAudioBtn}
                      onClick={handleDeleteCommentAudio}
                      title="Supprimer"
                    >
                      🗑
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={styles.commentMicBtn}
                    onClick={startCommentRecording}
                    title="Enregistrer un commentaire vocal"
                  >
                    🎤
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
