'use client';

import React, { useCallback, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import type { Grille } from '@/types/grille';
import { LEVEL_LABELS, LEVEL_PERCENTAGES } from '@/types/grille';
import type { Correction } from '@/types/correction';
import type { AiGridResult } from '@/types/ai-grid';
import type { NonRenduStatus } from '@/types/travail';
import LuciditeBilan from '@/components/LuciditeBilan';
import { BILAN_GRILLE_VIDE, bilanGrille, niveauLabel, phraseGrille } from '@/lib/grille-lucidite';
import styles from './GrilleTab.module.css';

interface GrilleTabProps {
  grille: Grille | null;
  isLoading: boolean;
  error: string | null;
  selfEvaluation: Record<string, number> | null;
  onSelfEvaluationChange: (evaluation: Record<string, number>) => void;
  disabled?: boolean;
  studentName?: string;
  correction?: Correction | null;
  isProfessorView?: boolean;
  // Props IA grille
  accesIA?: boolean;
  showAiData?: boolean;
  aiGridResult?: AiGridResult | null;
  aiGridRequesting?: boolean;
  aiGridError?: string | null;
  onRequestAiGrid?: () => void;
  studentContent?: string;
  // Critères masqués pour CE devoir (choisis à la création de l'activité)
  hiddenCriteria?: string[];
  /** Auto-évaluation désactivée sur l'activité : l'élève ne se prononce pas */
  autoEvaluation?: boolean;
  // Travail non rendu (décision du prof) — toggle en vue prof, bandeau en vue élève
  nonRendu?: NonRenduStatus | null;
  onNonRenduChange?: (nonRendu: NonRenduStatus | null) => void;
}

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

export default function GrilleTab({
  grille,
  isLoading,
  error,
  selfEvaluation,
  onSelfEvaluationChange,
  disabled = false,
  studentName = '',
  correction = null,
  isProfessorView = false,
  accesIA = false,
  showAiData = false,
  aiGridResult = null,
  aiGridRequesting = false,
  aiGridError = null,
  onRequestAiGrid,
  studentContent = '',
  hiddenCriteria,
  autoEvaluation = true,
  nonRendu = null,
  onNonRenduChange,
}: GrilleTabProps) {
  // Set des critères masqués pour ce devoir (lookup rapide)
  const hiddenSet = React.useMemo(() => new Set(hiddenCriteria || []), [hiddenCriteria]);
  const initials = studentName ? getInitials(studentName) : '?';
  const [activePopup, setActivePopup] = useState<string | null>(null);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Fermer le popup quand on clique ailleurs
  useEffect(() => {
    if (!activePopup) return;
    const handleClick = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setActivePopup(null);
        setPopupPos(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [activePopup]);

  const handleLevelClick = useCallback((criterionId: string, level: number) => {
    if (disabled) return;

    if (isProfessorView) {
      const currentEval = correction?.evaluation || {};
      const newEval = { ...currentEval };

      if (newEval[criterionId] === level) {
        delete newEval[criterionId];
      } else {
        newEval[criterionId] = level;
      }

      onSelfEvaluationChange(newEval);
    } else {
      const newEvaluation = { ...selfEvaluation };

      if (newEvaluation[criterionId] === level) {
        delete newEvaluation[criterionId];
      } else {
        newEvaluation[criterionId] = level;
      }

      onSelfEvaluationChange(newEvaluation);
    }
  }, [selfEvaluation, correction, onSelfEvaluationChange, disabled, isProfessorView]);

  // Calculer les points à partir d'une évaluation
  const computeScore = useCallback((evaluation: Record<string, number> | null) => {
    if (!grille || !evaluation) return null;
    let totalPoints = 0;
    let maxPoints = 0;

    grille.criteria.forEach((criterion) => {
      const level = evaluation[criterion.id];
      // Un critère masqué pour ce devoir ne compte pas dans le total — sauf
      // s'il a été évalué (correction antérieure au masquage)
      if (hiddenSet.has(criterion.id) && level === undefined) return;
      if (level !== undefined) {
        const percentage = LEVEL_PERCENTAGES[level] ?? 0;
        totalPoints += (criterion.weight * percentage) / 100;
      }
      maxPoints += criterion.weight;
    });

    if (maxPoints === 0) return null;
    const pct = Math.round((totalPoints / maxPoints) * 100);
    const pts = Math.round(totalPoints * 10) / 10;
    return { pct, pts, max: maxPoints };
  }, [grille, hiddenSet]);

  const studentScoreData = React.useMemo(() => computeScore(selfEvaluation), [computeScore, selfEvaluation]);
  const profScoreData = React.useMemo(() => computeScore(correction?.evaluation || null), [computeScore, correction?.evaluation]);

  // Score IA : convertir aiGridResult.criteria en Record<criterionId, level>
  const aiEvaluation = React.useMemo(() => {
    if (!aiGridResult) return null;
    const eval_: Record<string, number> = {};
    for (const c of aiGridResult.criteria) {
      eval_[c.criterionId] = c.selectedLevel;
    }
    return eval_;
  }, [aiGridResult]);
  const aiScoreData = React.useMemo(() => computeScore(aiEvaluation), [computeScore, aiEvaluation]);

  // Critères visibles : les non-masqués + les masqués déjà évalués (historique)
  const visibleCriteria = React.useMemo(() => {
    if (!grille) return [];
    return grille.criteria.filter((c) =>
      !hiddenSet.has(c.id) ||
      selfEvaluation?.[c.id] !== undefined ||
      correction?.evaluation?.[c.id] !== undefined ||
      aiEvaluation?.[c.id] !== undefined
    );
  }, [grille, hiddenSet, selfEvaluation, correction?.evaluation, aiEvaluation]);

  // Vérifier si l'élève a rempli ≥75% de la grille (critères non masqués)
  const selfEvalCount = selfEvaluation ? Object.keys(selfEvaluation).length : 0;
  const totalCriteria = grille?.criteria.filter((c) => !hiddenSet.has(c.id)).length ?? 0;
  const selfEvalPct = totalCriteria > 0 ? selfEvalCount / totalCriteria : 0;
  const hasEnoughSelfEval = selfEvalPct >= 0.75;
  const hasContent = studentContent.replace(/<[^>]*>/g, '').trim().length > 0;
  const canRequestAiGrid = accesIA && !isProfessorView && hasEnoughSelfEval && hasContent && !aiGridResult && !aiGridRequesting;
  // Le prof peut demander l'IA uniquement si l'élève ne l'a pas déjà utilisée
  const canProfRequestAiGrid = isProfessorView && (accesIA || showAiData) && hasContent && !aiGridResult && !aiGridRequesting;

  // Lookup rapide : criterionId → AiGridCriterionResult
  const aiCriteriaMap = React.useMemo(() => {
    if (!aiGridResult) return new Map<string, { selectedLevel: number; justification: string }>();
    const map = new Map<string, { selectedLevel: number; justification: string }>();
    for (const c of aiGridResult.criteria) {
      map.set(c.criterionId, { selectedLevel: c.selectedLevel, justification: c.justification });
    }
    return map;
  }, [aiGridResult]);

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <span>Chargement de la grille...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.error}>
        <span>⚠️</span>
        <span>{error}</span>
      </div>
    );
  }

  if (!grille || grille.criteria.length === 0) {
    return (
      <div className={styles.empty}>
        <span>📋</span>
        <span>Aucune grille d&apos;evaluation disponible.</span>
      </div>
    );
  }

  const profEvaluation = isProfessorView
    ? (correction?.evaluation || null)
    : (correction?.visibleParEleve ? correction.evaluation : null);

  // Lucidité : l'élève et le prof se sont prononcés sur les MÊMES critères et
  // la MÊME échelle — l'écart se lit directement en crans. Le bloc n'apparaît
  // qu'une fois la correction lisible : avant, il n'y a rien à confronter.
  const lucidite = React.useMemo(
    () =>
      autoEvaluation
        ? bilanGrille(grille, selfEvaluation, profEvaluation, hiddenCriteria)
        : BILAN_GRILLE_VIDE,
    [autoEvaluation, grille, selfEvaluation, profEvaluation, hiddenCriteria]
  );

  return (
    <div className={styles.container}>
      {!isProfessorView && (
        <>
          {(selfEvaluation && Object.keys(selfEvaluation).length > 0 && studentScoreData) || profEvaluation || aiGridResult ? (
            <div className={styles.bannersContainer}>
              {selfEvaluation && Object.keys(selfEvaluation).length > 0 && studentScoreData && (
                <div className={styles.studentScoreBanner}>
                  <span className={styles.studentInitials}>{initials}</span>
                  <span>Auto-évaluation : <strong>{studentScoreData.pct}%</strong> ({studentScoreData.pts}/{studentScoreData.max})</span>
                </div>
              )}

              {aiGridResult && aiScoreData && (
                <div className={styles.aiScoreBanner}>
                  <span className={styles.aiBannerIcon}>🤖</span>
                  <span>Évaluation IA : <strong>{aiScoreData.pct}%</strong> ({aiScoreData.pts}/{aiScoreData.max})</span>
                </div>
              )}

              {profEvaluation && (
                profScoreData && Object.keys(profEvaluation).length > 0 ? (
                  <div className={styles.profScoreBanner}>
                    <Image src="/jpavatar.png" alt="Prof" width={24} height={24} className={styles.profAvatarSmall} />
                    <span>Correction du professeur : <strong>{profScoreData.pct}%</strong> ({profScoreData.pts}/{profScoreData.max})</span>
                  </div>
                ) : (
                  <div className={styles.profScoreBannerEmpty}>
                    <Image src="/jpavatar.png" alt="Prof" width={24} height={24} className={styles.profAvatarSmall} />
                    <span>Correction : <em>non évalué</em></span>
                  </div>
                )
              )}
            </div>
          ) : null}

          <div className={styles.instructionRow}>
            <p className={styles.instructionText}>
              {autoEvaluation
                ? 'Evalue ton travail en choisissant pour chaque critère l’indicateur qui te semble le plus pertinent.'
                : 'La grille d’évaluation de cette activité. Ton professeur ne t’a pas demandé de t’y situer.'}
            </p>
            {selfEvaluation && Object.keys(selfEvaluation).length > 0 && (
              <div className={styles.summary}>
                <span className={styles.summaryLabel}>Critères évalués :</span>
                <span className={styles.summaryValue}>
                  {Object.keys(selfEvaluation).length} / {grille.criteria.length}
                </span>
              </div>
            )}
          </div>
        </>
      )}

      {isProfessorView && (
        (selfEvaluation && Object.keys(selfEvaluation).length > 0 && studentScoreData) || profScoreData || (aiGridResult && aiScoreData)
      ) && (
        <div className={styles.bannersContainer}>
          {selfEvaluation && Object.keys(selfEvaluation).length > 0 && studentScoreData && (
            <div className={styles.studentScoreBanner}>
              <span className={styles.studentInitials}>{initials}</span>
              <span>Auto-évaluation de {studentName} : <strong>{studentScoreData.pct}%</strong> ({studentScoreData.pts}/{studentScoreData.max})</span>
            </div>
          )}
          {aiGridResult && aiScoreData && (
            <div className={styles.aiScoreBanner}>
              <span className={styles.aiBannerIcon}>🤖</span>
              <span>Évaluation IA : <strong>{aiScoreData.pct}%</strong> ({aiScoreData.pts}/{aiScoreData.max})</span>
            </div>
          )}
          {correction?.evaluation && Object.keys(correction.evaluation).length > 0 && profScoreData ? (
            <div className={styles.profScoreBanner}>
              <Image src="/jpavatar.png" alt="Prof" width={24} height={24} className={styles.profAvatarSmall} />
              <span>Votre correction : <strong>{profScoreData.pct}%</strong> ({profScoreData.pts}/{profScoreData.max})</span>
            </div>
          ) : isProfessorView ? (
            <div className={styles.profScoreBannerEmpty}>
              <Image src="/jpavatar.png" alt="Prof" width={24} height={24} className={styles.profAvatarSmall} />
              <span>Correction : <em>non évalué</em></span>
            </div>
          ) : null}
        </div>
      )}

      {/* Écart entre l'auto-évaluation de l'élève et la correction du prof.
          Le même bloc des deux côtés : le prof voit ce que voit l'élève. */}
      <LuciditeBilan
        titre="Ton regard sur ton travail, face à celui du professeur"
        tendance={lucidite.tendance}
        comparees={lucidite.comparees}
        justes={lucidite.justes}
        sousEstimations={lucidite.sousEstimations}
        surestimations={lucidite.surestimations}
        unite="critère"
        phrase={phraseGrille(lucidite)}
        lignes={lucidite.ecarts
          .filter((e) => e.net)
          .map((e) => ({
            id: e.criterionId,
            label: e.nom,
            gauche: niveauLabel(e.eleve),
            droite: niveauLabel(e.prof),
          }))}
        note={
          lucidite.sansAutoEval > 0
            ? `${lucidite.sansAutoEval} critère${lucidite.sansAutoEval > 1 ? 's' : ''} corrigé${
                lucidite.sansAutoEval > 1 ? 's' : ''
              } sans auto-évaluation — hors de cette comparaison.`
            : undefined
        }
        isProfessorView={isProfessorView}
      />

      {/* Travail non rendu — décision du prof (jamais automatique) */}
      {isProfessorView && onNonRenduChange && (
        <div className={styles.excuseBlock}>
          <label className={styles.excuseToggle}>
            <input
              type="checkbox"
              checked={nonRendu !== null}
              onChange={(e) => onNonRenduChange(e.target.checked ? 'justifie' : null)}
            />
            Travail non rendu
          </label>
          {nonRendu !== null && (
            <div className={styles.excuseMotifs}>
              <label className={styles.excuseMotif}>
                <input
                  type="radio"
                  name="non-rendu-motif"
                  checked={nonRendu === 'justifie'}
                  onChange={() => onNonRenduChange('justifie')}
                />
                Justifié — pas de note
              </label>
              <label className={styles.excuseMotif}>
                <input
                  type="radio"
                  name="non-rendu-motif"
                  checked={nonRendu === 'nonJustifie'}
                  onChange={() => onNonRenduChange('nonJustifie')}
                />
                Non justifié — note : 0
              </label>
            </div>
          )}
        </div>
      )}

      {/* Bandeau élève : travail marqué non rendu par le prof */}
      {!isProfessorView && nonRendu !== null && (
        <div className={nonRendu === 'nonJustifie' ? styles.nonRenduBannerSanction : styles.nonRenduBannerInfo}>
          {nonRendu === 'nonJustifie'
            ? 'Travail non fait, non justifié — note : 0 %'
            : 'Travail non rendu — justifié, pas de note pour cette activité.'}
        </div>
      )}

      <div className={styles.criteria}>
        {visibleCriteria.map((criterion) => (
          <div key={criterion.id} className={styles.criterion}>
            <div className={styles.criterionHeader}>
              <span className={styles.criterionName}>{criterion.name}</span>
              <span className={styles.criterionWeight}>({criterion.weight} pts)</span>
            </div>
            <div className={styles.levels}>
              {criterion.levels.map((level) => {
                const isStudentSelected = selfEvaluation?.[criterion.id] === level.level;
                const isProfSelected = profEvaluation?.[criterion.id] === level.level;
                const profSuccess = isProfSelected && isSuccessLevel(level.level);
                const profFailure = isProfSelected && !isSuccessLevel(level.level);

                // IA
                const aiCrit = aiCriteriaMap.get(criterion.id);
                const isAiSelected = aiCrit?.selectedLevel === level.level;
                const popupKey = `${criterion.id}-${level.level}`;

                return (
                  <button
                    key={level.level}
                    type="button"
                    className={`${styles.levelButton} ${
                      profSuccess ? styles.levelProfSuccess : ''
                    } ${
                      profFailure ? styles.levelProfFailure : ''
                    }`}
                    onClick={() => handleLevelClick(criterion.id, level.level)}
                    disabled={disabled}
                    title={level.indicators.length > 0 ? level.indicators.join(' • ') : LEVEL_LABELS[level.level] || `Niveau ${level.level}`}
                  >
                    {isAiSelected && (
                      <span
                        className={styles.aiBubble}
                        title=""
                        onMouseEnter={(e) => {
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          setPopupPos({ top: rect.top, left: rect.left + rect.width / 2 });
                          setActivePopup(popupKey);
                        }}
                        onMouseLeave={() => {
                          setActivePopup(null);
                          setPopupPos(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        🤖
                      </span>
                    )}
                    {isStudentSelected && (
                      <span className={styles.studentBubble} title={isProfessorView ? `Choix de ${studentName}` : "Votre choix"}>
                        {initials}
                      </span>
                    )}
                    {isProfSelected && (
                      <span className={styles.profBubble} title="Choix du professeur">
                        <Image src="/jpavatar.png" alt="Prof" width={22} height={22} className={styles.profAvatar} />
                      </span>
                    )}
                    <span className={styles.levelDescription}>
                      {level.indicators.length > 0
                        ? level.indicators.map((ind, i) => (
                            <span key={i} className={styles.indicator}>• {ind}</span>
                          ))
                        : LEVEL_LABELS[level.level] || `Niveau ${level.level}`}
                    </span>

                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Bouton IA pour le prof — uniquement si l'élève ne l'a pas déjà utilisé */}
      {canProfRequestAiGrid && (
        <div className={styles.aiRequestSection}>
          <button
            type="button"
            className={styles.aiRequestButton}
            onClick={onRequestAiGrid}
          >
            <span>🤖</span>
            <span>Évaluation IA (élève n&apos;a pas utilisé l&apos;IA)</span>
          </button>
        </div>
      )}

      {/* Badge / bouton évaluation IA — après la grille */}
      {!isProfessorView && (accesIA || showAiData) && (
        <div className={styles.aiRequestSection}>
          {aiGridResult ? null : aiGridRequesting ? (
            <div className={styles.aiRequestLoading}>
              <div className={styles.aiSpinner} />
              <span>L&apos;IA analyse votre travail...</span>
            </div>
          ) : canRequestAiGrid ? (
            <button
              type="button"
              className={styles.aiRequestButton}
              onClick={onRequestAiGrid}
            >
              <span>🤖</span>
              <span>Demander l&apos;avis de l&apos;IA</span>
            </button>
          ) : (
            <div
              className={styles.aiRequestDisabled}
              title={
                !hasContent
                  ? 'Rédigez votre texte avant de demander une évaluation IA'
                  : !hasEnoughSelfEval
                    ? `Complétez au moins 75% de votre auto-évaluation (${selfEvalCount}/${totalCriteria})`
                    : ''
              }
            >
              <span>🤖</span>
              <span>
                {!hasContent
                  ? 'Rédigez votre texte pour activer'
                  : `Auto-évaluation : ${selfEvalCount}/${totalCriteria} (75% requis)`}
              </span>
            </div>
          )}
          {aiGridError && (
            <div className={styles.aiErrorMsg}>⚠️ {aiGridError}</div>
          )}
        </div>
      )}

      {/* Commentaires IA + prof — en colonnes si les deux sont présents */}
      {(aiGridResult?.commentaireFinal || (!isProfessorView && correction?.visibleParEleve && (correction?.commentaireGeneral || correction?.commentaireGeneralAudio))) && (
        <div className={styles.commentairesRow}>
          {aiGridResult && aiGridResult.commentaireFinal && (
            <div className={styles.aiCommentaire}>
              <div className={styles.aiCommentaireHeader}>
                <span>🤖</span>
                <strong>Commentaire de l&apos;IA</strong>
              </div>
              <p className={styles.aiCommentaireText}>{aiGridResult.commentaireFinal}</p>
            </div>
          )}

          {!isProfessorView && correction?.visibleParEleve && (correction?.commentaireGeneral || correction?.commentaireGeneralAudio) && (
            <div className={styles.profCommentaire}>
              <div className={styles.profCommentaireHeader}>
                <Image src="/jpavatar.png" alt="Prof" width={20} height={20} className={styles.profAvatarSmall} />
                <strong>Commentaire du professeur</strong>
              </div>
              {correction.commentaireGeneralAudio && (
                <div className={styles.profCommentaireAudio}>
                  <audio controls src={correction.commentaireGeneralAudio} style={{ height: 32, maxWidth: '100%' }} />
                </div>
              )}
              {correction.commentaireGeneral && (
                <p className={styles.profCommentaireText}>{correction.commentaireGeneral}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Popup justification IA — rendu via portal pour échapper à overflow:hidden */}
      {activePopup && popupPos && (() => {
        const fullCritId = activePopup.substring(0, activePopup.lastIndexOf('-'));
        const lvl = Number(activePopup.substring(activePopup.lastIndexOf('-') + 1));
        const aiCrit = aiCriteriaMap.get(fullCritId);
        if (!aiCrit || aiCrit.selectedLevel !== lvl) return null;
        return createPortal(
          <div
            ref={popupRef}
            className={styles.aiPopupFixed}
            style={{ top: popupPos.top, left: popupPos.left }}
            onMouseEnter={() => setActivePopup(activePopup)}
            onMouseLeave={() => { setActivePopup(null); setPopupPos(null); }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.aiPopupHeader}>
              <span>🤖</span>
              <strong>Avis de l&apos;IA</strong>
            </div>
            <p className={styles.aiPopupText}>{aiCrit.justification}</p>
          </div>,
          document.body
        );
      })()}
    </div>
  );
}
