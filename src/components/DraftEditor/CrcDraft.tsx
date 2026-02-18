'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DraftContent, CrcPoint, CrcPlanItem } from '@/types/travail';
import type { DraftItemAnnotation } from '@/types/correction';
import { createCrcPoint, createCrcArgument } from '@/lib/draft-utils';
import DraftItemAnnotations from './DraftItemAnnotations';
import styles from './CrcDraft.module.css';

interface CrcDraftProps {
  draft: DraftContent;
  onChange: (draft: DraftContent) => void;
  disabled?: boolean;
  // Props d'annotation prof (optionnelles)
  draftAnnotations?: Record<string, DraftItemAnnotation>;
  onAnnotationChange?: (itemId: string, annotation: DraftItemAnnotation) => void;
  isRecording?: boolean;
  recordingItemId?: string | null;
  recordingDuration?: number;
  onStartRecording?: (itemId: string) => void;
  onStopRecording?: () => void;
  // Mode lecture seule (élève)
  readOnlyAnnotations?: boolean;
}

// Migration : ancien format string[] → CrcPoint[]
// + ancien format single explication/illustration → arguments[]
// + ancien format explications[]/illustrations[] → arguments[]
function migratePoints(points: string[] | CrcPoint[] | undefined): CrcPoint[] {
  if (!points || points.length === 0) return [createCrcPoint()];
  if (typeof points[0] === 'string') {
    return (points as string[]).map((text) => ({
      ...createCrcPoint(),
      text,
    }));
  }
  return (points as CrcPoint[]).map((p) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = p as any;
    if (Array.isArray(p.arguments)) return p;

    // Migration depuis ancien format
    if (Array.isArray(raw.explications)) {
      // Format explications[]/illustrations[]
      const maxLen = Math.max(raw.explications.length, raw.illustrations?.length || 0);
      const args = [];
      for (let i = 0; i < maxLen; i++) {
        args.push({
          explication: raw.explications[i] || '',
          illustration: raw.illustrations?.[i] || '',
        });
      }
      return { id: p.id, text: p.text, arguments: args.length > 0 ? args : [{ explication: '', illustration: '' }] };
    }
    if (typeof raw.explication === 'string') {
      // Format single explication/illustration
      return {
        id: p.id,
        text: p.text,
        arguments: [{
          explication: raw.explication || '',
          illustration: raw.illustration || '',
        }],
      };
    }
    return { ...p, arguments: [{ explication: '', illustration: '' }] };
  });
}

export default function CrcDraft({
  draft,
  onChange,
  disabled = false,
  draftAnnotations,
  onAnnotationChange,
  isRecording = false,
  recordingItemId = null,
  recordingDuration = 0,
  onStartRecording,
  onStopRecording,
  readOnlyAnnotations = false,
}: CrcDraftProps) {
  const showAnnotations = !!draftAnnotations && (!!onAnnotationChange || readOnlyAnnotations);
  const positifs = useMemo(() => migratePoints(draft.positifs), [draft.positifs]);
  const negatifs = useMemo(() => migratePoints(draft.negatifs), [draft.negatifs]);
  const crcPlan = draft.crcPlan || [];

  // Drag state
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragSideRef = useRef<'positif' | 'negatif'>('positif');

  // Card expand state (clic pour déplier/replier)
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [focusedCardId, setFocusedCardId] = useState<string | null>(null);
  const isCardExpanded = useCallback((id: string) => expandedCardId === id || focusedCardId === id, [expandedCardId, focusedCardId]);
  const toggleCard = useCallback((id: string) => {
    setExpandedCardId(prev => {
      if (prev === id) {
        // Fermeture : on clear le focus pour éviter que onFocusCapture re-ouvre
        setFocusedCardId(null);
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        return null;
      }
      return id;
    });
  }, []);

  // Fermer la carte ouverte quand on clique en dehors
  useEffect(() => {
    if (!expandedCardId) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const card = target.closest('[data-card-id]');
      if (!card || card.getAttribute('data-card-id') !== expandedCardId) {
        setExpandedCardId(null);
        setFocusedCardId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [expandedCardId]);

  // Edit popup state
  const [editingPointId, setEditingPointId] = useState<string | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editingPointId) return;
    const handleClick = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setEditingPointId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [editingPointId]);

  // -- Handlers --

  const updatePointText = useCallback((
    side: 'positifs' | 'negatifs',
    id: string,
    value: string
  ) => {
    const points = side === 'positifs' ? positifs : negatifs;
    const updated = points.map(p => p.id === id ? { ...p, text: value } : p);
    onChange({ ...draft, [side]: updated });
  }, [draft, onChange, positifs, negatifs]);

  const updateArgField = useCallback((
    side: 'positifs' | 'negatifs',
    id: string,
    argIndex: number,
    field: 'explication' | 'illustration',
    value: string
  ) => {
    const points = side === 'positifs' ? positifs : negatifs;
    const updated = points.map(p => {
      if (p.id !== id) return p;
      const args = [...p.arguments];
      args[argIndex] = { ...args[argIndex], [field]: value };
      return { ...p, arguments: args };
    });
    onChange({ ...draft, [side]: updated });
  }, [draft, onChange, positifs, negatifs]);

  const addArg = useCallback((
    side: 'positifs' | 'negatifs',
    id: string,
  ) => {
    const points = side === 'positifs' ? positifs : negatifs;
    const updated = points.map(p => {
      if (p.id !== id) return p;
      return { ...p, arguments: [...p.arguments, createCrcArgument()] };
    });
    onChange({ ...draft, [side]: updated });
  }, [draft, onChange, positifs, negatifs]);

  const removeArg = useCallback((
    side: 'positifs' | 'negatifs',
    id: string,
    argIndex: number
  ) => {
    const points = side === 'positifs' ? positifs : negatifs;
    const updated = points.map(p => {
      if (p.id !== id || p.arguments.length <= 1) return p;
      const args = [...p.arguments];
      args.splice(argIndex, 1);
      return { ...p, arguments: args };
    });
    onChange({ ...draft, [side]: updated });
  }, [draft, onChange, positifs, negatifs]);

  const addPoint = useCallback((side: 'positifs' | 'negatifs') => {
    const points = side === 'positifs' ? positifs : negatifs;
    onChange({ ...draft, [side]: [...points, createCrcPoint()] });
  }, [draft, onChange, positifs, negatifs]);

  const removePoint = useCallback((side: 'positifs' | 'negatifs', id: string) => {
    const points = side === 'positifs' ? positifs : negatifs;
    if (points.length <= 1) return;
    const updated = points.filter(p => p.id !== id);
    const updatedPlan = crcPlan.filter(item => item.pointId !== id);
    onChange({ ...draft, [side]: updated, crcPlan: updatedPlan });
  }, [draft, onChange, positifs, negatifs, crcPlan]);

  // -- Plan handlers --

  const addToPlan = useCallback((pointId: string, side: 'positif' | 'negatif') => {
    if (crcPlan.some(item => item.pointId === pointId)) return;
    const newItem: CrcPlanItem = {
      id: `pl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      pointId,
      side,
    };
    onChange({ ...draft, crcPlan: [...crcPlan, newItem] });
  }, [draft, onChange, crcPlan]);

  const removeFromPlan = useCallback((pointId: string) => {
    onChange({ ...draft, crcPlan: crcPlan.filter(item => item.pointId !== pointId) });
  }, [draft, onChange, crcPlan]);

  // -- Drag & drop --

  const handleDragStart = useCallback((pointId: string, side: 'positif' | 'negatif') => {
    setDraggedId(pointId);
    dragSideRef.current = side;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  }, []);

  const handleDropOnPlan = useCallback((e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (!draggedId) return;
    const existingIndex = crcPlan.findIndex(item => item.pointId === draggedId);
    if (existingIndex >= 0) {
      const updated = [...crcPlan];
      const [moved] = updated.splice(existingIndex, 1);
      updated.splice(targetIndex, 0, moved);
      onChange({ ...draft, crcPlan: updated });
    } else {
      const newItem: CrcPlanItem = {
        id: `pl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        pointId: draggedId,
        side: dragSideRef.current,
      };
      const updated = [...crcPlan];
      updated.splice(targetIndex, 0, newItem);
      onChange({ ...draft, crcPlan: updated });
    }
    setDraggedId(null);
    setDragOverIndex(null);
  }, [draft, onChange, crcPlan, draggedId]);

  const handleDropOnPlanZone = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedId) return;
    if (crcPlan.some(item => item.pointId === draggedId)) {
      setDraggedId(null);
      setDragOverIndex(null);
      return;
    }
    addToPlan(draggedId, dragSideRef.current);
    setDraggedId(null);
    setDragOverIndex(null);
  }, [draggedId, crcPlan, addToPlan]);

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDragOverIndex(null);
  }, []);

  // -- Lookup --

  const findPoint = useCallback((pointId: string): { point: CrcPoint; side: 'positif' | 'negatif' } | null => {
    const pos = positifs.find(p => p.id === pointId);
    if (pos) return { point: pos, side: 'positif' };
    const neg = negatifs.find(p => p.id === pointId);
    if (neg) return { point: neg, side: 'negatif' };
    return null;
  }, [positifs, negatifs]);

  const isInPlan = useCallback((pointId: string) => crcPlan.some(item => item.pointId === pointId), [crcPlan]);

  // Helpers pour modifier depuis le plan
  const getSide = useCallback((pointId: string): 'positifs' | 'negatifs' | null => {
    const found = findPoint(pointId);
    return found ? (found.side === 'positif' ? 'positifs' : 'negatifs') : null;
  }, [findPoint]);

  // Auto-resize textarea
  const autoResize = useCallback((e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    target.style.height = 'auto';
    target.style.height = target.scrollHeight + 'px';
  }, []);

  // -- Render helpers --

  const renderArguments = (
    args: CrcPoint['arguments'],
    side: 'positifs' | 'negatifs',
    pointId: string
  ) => (
    <>
      {args.map((arg, i) => (
        <div key={i} className={styles.argumentBlock}>
          <div className={styles.argumentHeader}>
            <span className={styles.argumentNumber}>{i + 1}</span>
            {!disabled && args.length > 1 && (
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.removeBtn} ${styles.argRemoveBtn}`}
                onClick={() => removeArg(side, pointId, i)}
                title="Supprimer cet argument"
              >
                ×
              </button>
            )}
          </div>
          <div className={styles.argumentFields}>
            <div className={styles.argumentField}>
              <label className={styles.subLabel}>Explication</label>
              <textarea
                className={styles.cardInput}
                value={arg.explication}
                onChange={(e) => updateArgField(side, pointId, i, 'explication', e.target.value)}
                placeholder="Prouve l'argument énoncé par un fait, une description, une explication détaillée"
                disabled={disabled}
                rows={1}
                onInput={autoResize}
              />
            </div>
            <div className={styles.argumentField}>
              <label className={styles.subLabel}>Illustration</label>
              <textarea
                className={styles.cardInput}
                value={arg.illustration}
                onChange={(e) => updateArgField(side, pointId, i, 'illustration', e.target.value)}
                placeholder="Un exemple concret..."
                disabled={disabled}
                rows={1}
                onInput={autoResize}
              />
            </div>
          </div>
        </div>
      ))}
      {!disabled && (
        <button
          type="button"
          className={styles.addArgBtn}
          onClick={() => addArg(side, pointId)}
        >
          + Ajouter une explication
        </button>
      )}
    </>
  );

  const renderPopupArguments = (
    args: CrcPoint['arguments'],
    pointId: string
  ) => {
    const side = getSide(pointId);
    if (!side) return null;
    return (
      <>
        {args.map((arg, i) => (
          <div key={i} className={styles.argumentBlock}>
            <div className={styles.argumentHeader}>
              <span className={styles.argumentNumber}>{i + 1}</span>
              {args.length > 1 && (
                <button
                  type="button"
                  className={`${styles.actionBtn} ${styles.removeBtn} ${styles.argRemoveBtn}`}
                  onClick={() => removeArg(side, pointId, i)}
                  title="Supprimer cet argument"
                >
                  ×
                </button>
              )}
            </div>
            <div className={styles.argumentFields}>
              <div className={styles.argumentField}>
                <label className={styles.subLabel}>Explication</label>
                <textarea
                  className={styles.cardInput}
                  value={arg.explication}
                  onChange={(e) => updateArgField(side, pointId, i, 'explication', e.target.value)}
                  placeholder="Prouve l'argument énoncé par un fait, une description, une explication détaillée"
                  rows={1}
                  onInput={autoResize}
                />
              </div>
              <div className={styles.argumentField}>
                <label className={styles.subLabel}>Illustration</label>
                <textarea
                  className={styles.cardInput}
                  value={arg.illustration}
                  onChange={(e) => updateArgField(side, pointId, i, 'illustration', e.target.value)}
                  placeholder="Un exemple concret..."
                  rows={1}
                  onInput={autoResize}
                />
              </div>
            </div>
          </div>
        ))}
        <button
          type="button"
          className={styles.addArgBtn}
          onClick={() => addArg(side, pointId)}
        >
          + Ajouter une explication
        </button>
      </>
    );
  };

  // Helpers pour verifier si un point a du contenu dans ses arguments
  const hasArgContent = (point: CrcPoint) =>
    point.arguments.some(a => a.explication.trim() || a.illustration.trim());

  // Render un point (etiquette)
  const renderPoint = (point: CrcPoint, side: 'positifs' | 'negatifs', sideLabel: 'positif' | 'negatif') => {
    if (isInPlan(point.id)) return null;
    const isDragging = draggedId === point.id;
    const expanded = isCardExpanded(point.id);
    const hasContent = point.text.trim().length > 0;

    return (
      <div
        key={point.id}
        data-card-id={point.id}
        className={`${styles.card} ${sideLabel === 'positif' ? styles.cardPositive : styles.cardNegative} ${isDragging ? styles.cardDragging : ''}`}
        draggable={!disabled && hasContent}
        onDragStart={() => handleDragStart(point.id, sideLabel)}
        onDragEnd={handleDragEnd}
        onFocusCapture={() => setFocusedCardId(point.id)}
        onBlurCapture={(e) => {
          // Ne clear le focus que si le focus quitte la carte entièrement
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setFocusedCardId(null);
          }
        }}
      >
        <div className={styles.cardHeader}>
          <span className={`${styles.cardBullet} ${sideLabel === 'positif' ? styles.bulletPositive : styles.bulletNegative}`}>
            {sideLabel === 'positif' ? '+' : '−'}
          </span>
          <textarea
            className={`${styles.cardInput} ${styles.cardInputMain}`}
            value={point.text}
            onChange={(e) => updatePointText(side, point.id, e.target.value)}
            placeholder={sideLabel === 'positif' ? 'Point positif...' : 'Point négatif...'}
            disabled={disabled}
            rows={1}
            onInput={autoResize}
          />
          {hasContent && hasArgContent(point) && (
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.chevronBtn} ${expanded ? styles.chevronOpen : ''}`}
              onClick={() => toggleCard(point.id)}
              title={expanded ? 'Replier' : 'Déplier'}
            >
              ▾
            </button>
          )}
          {!disabled && (
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.removeBtn}`}
              onClick={() => removePoint(side, point.id)}
              title="Supprimer"
            >
              ×
            </button>
          )}
        </div>

        {/* Mode replié : résumé des arguments (clic pour déplier) */}
        {hasContent && !expanded && hasArgContent(point) && (
          <div className={styles.cardSummary} onClick={() => toggleCard(point.id)}>
            {point.arguments.map((arg, ai) => (
              (arg.explication.trim() || arg.illustration.trim()) && (
                <div key={ai} className={styles.cardSummaryArg}>
                  {arg.explication.trim() && (
                    <span className={styles.planItemSub}>→ {arg.explication}</span>
                  )}
                  {arg.illustration.trim() && (
                    <span className={styles.planItemIllustration}>ex. {arg.illustration}</span>
                  )}
                </div>
              )
            ))}
          </div>
        )}

        {/* Mode déplié : champs éditables */}
        {hasContent && expanded && (
          <div className={styles.subFields}>
            {renderArguments(point.arguments, side, point.id)}
          </div>
        )}

        {!disabled && hasContent && expanded && (
          <div className={styles.dragHint}>
            Glisse vers le plan ↓
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      {/* ===== ETAPE 1 : BRAINSTORMING ===== */}
      <div className={styles.header}>
        <span className={styles.stepBadge}>Étape 1</span>
        <h3>Brainstorming</h3>
        <span className={styles.headerHint}>
          Avant de rédiger l&apos;avis critique, identifie les forces et les faiblesses de l&apos;objet culturel que tu as découvert
        </span>
      </div>

      <div className={styles.columns}>
        <div className={styles.column}>
          <div className={`${styles.columnHeader} ${styles.positiveHeader}`}>
            <span className={styles.columnIcon}>👍</span>
            <h4>Points positifs</h4>
          </div>
          <div className={styles.cards}>
            {positifs.map(point => renderPoint(point, 'positifs', 'positif'))}
            {!disabled && (
              <button
                type="button"
                className={`${styles.addButton} ${styles.addPositive}`}
                onClick={() => addPoint('positifs')}
              >
                + Ajouter un point positif
              </button>
            )}
          </div>
        </div>

        <div className={styles.divider} />

        <div className={styles.column}>
          <div className={`${styles.columnHeader} ${styles.negativeHeader}`}>
            <span className={styles.columnIcon}>👎</span>
            <h4>Points négatifs</h4>
          </div>
          <div className={styles.cards}>
            {negatifs.map(point => renderPoint(point, 'negatifs', 'negatif'))}
            {!disabled && (
              <button
                type="button"
                className={`${styles.addButton} ${styles.addNegative}`}
                onClick={() => addPoint('negatifs')}
              >
                + Ajouter un point négatif
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ===== ETAPE 2 : PLAN DE REDACTION ===== */}
      <div className={styles.planSection}>
        <div className={styles.header}>
          <span className={styles.stepBadge}>Étape 2</span>
          <h3>Plan de rédaction – Avis critique</h3>
          <span className={styles.headerHint}>
            Glisse tes étiquettes ici pour organiser ton argumentation
          </span>
        </div>

        {/* Avis général */}
        <div className={styles.avisGeneral}>
          <label className={styles.avisLabel}>Avis général</label>
          <textarea
            className={styles.avisInput}
            value={draft.crcAvisGeneral || ''}
            onChange={(e) => onChange({ ...draft, crcAvisGeneral: e.target.value })}
            placeholder="Indique ici si ton avis est enthousiaste, mitigé, négatif..."
            disabled={disabled}
            rows={2}
          />
        </div>

        <div
          className={`${styles.planZone} ${draggedId && !isInPlan(draggedId) ? styles.planZoneActive : ''}`}
          onDragOver={(e) => { e.preventDefault(); }}
          onDrop={handleDropOnPlanZone}
        >
          {crcPlan.length === 0 ? (
            <div className={styles.planEmpty}>
              <p>Glisse tes points positifs et négatifs ici pour construire ton plan</p>
            </div>
          ) : (
            <div className={styles.planItems}>
              {crcPlan.map((item, index) => {
                const found = findPoint(item.pointId);
                if (!found) return null;
                const { point, side } = found;

                return (
                  <div key={item.id} className={styles.planItemRow}>
                    <div
                      className={`${styles.planItemWrapper} ${side === 'positif' ? styles.planItemPositive : styles.planItemNegative} ${dragOverIndex === index ? styles.planItemDragOver : ''}`}
                      draggable={!disabled}
                      onDragStart={() => handleDragStart(item.pointId, side)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDrop={(e) => handleDropOnPlan(e, index)}
                      onDragEnd={handleDragEnd}
                    >
                     <div className={styles.planItem}>
                      <span className={styles.planItemNumber}>{index + 1}</span>
                      <span className={`${styles.planItemBullet} ${side === 'positif' ? styles.bulletPositive : styles.bulletNegative}`}>
                        {side === 'positif' ? '+' : '−'}
                      </span>
                      <div className={styles.planItemContent}>
                        <span className={styles.planItemText}>{point.text}</span>
                        {point.arguments.map((arg, ai) => (
                          (arg.explication.trim() || arg.illustration.trim()) && (
                            <div key={ai} className={styles.planItemArgSummary}>
                              {arg.explication.trim() && (
                                <span className={styles.planItemSub}>→ {arg.explication}</span>
                              )}
                              {arg.illustration.trim() && (
                                <span className={styles.planItemIllustration}>ex. {arg.illustration}</span>
                              )}
                            </div>
                          )
                        ))}
                      </div>
                      <span className={styles.planItemHandle}>⠿</span>
                      {!disabled && (
                        <div className={styles.planItemActions}>
                          <button
                            type="button"
                            className={`${styles.actionBtn} ${styles.editBtn}`}
                            onClick={() => setEditingPointId(editingPointId === item.pointId ? null : item.pointId)}
                            title="Modifier"
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            className={`${styles.actionBtn} ${styles.removeBtn}`}
                            onClick={() => removeFromPlan(item.pointId)}
                            title="Retirer du plan"
                          >
                            ×
                          </button>
                        </div>
                      )}
                     </div>

                      {editingPointId === item.pointId && (
                        <div className={styles.editPopup} ref={popupRef} onClick={(e) => e.stopPropagation()}>
                          <div className={styles.editPopupHeader}>
                            <span className={styles.editPopupTitle}>Modifier l&apos;étiquette</span>
                            <button
                              type="button"
                              className={styles.editPopupClose}
                              onClick={() => setEditingPointId(null)}
                            >
                              ×
                            </button>
                          </div>
                          <div className={styles.editPopupFields}>
                            <div className={styles.editPopupField}>
                              <label className={styles.subLabel}>Idée principale</label>
                              <textarea
                                className={styles.cardInput}
                                value={point.text}
                                onChange={(e) => {
                                  const s = getSide(item.pointId);
                                  if (s) updatePointText(s, item.pointId, e.target.value);
                                }}
                                rows={1}
                                onInput={autoResize}
                                autoFocus
                              />
                            </div>
                            {renderPopupArguments(point.arguments, item.pointId)}
                          </div>
                        </div>
                      )}
                    </div>
                    {showAnnotations && (
                      <DraftItemAnnotations
                        itemId={item.pointId}
                        annotation={draftAnnotations![item.pointId]}
                        onChange={onAnnotationChange!}
                        isRecording={isRecording}
                        recordingItemId={recordingItemId}
                        recordingDuration={recordingDuration}
                        onStartRecording={onStartRecording!}
                        onStopRecording={onStopRecording!}
                        readOnly={readOnlyAnnotations}
                      />
                    )}
                  </div>
                );
              })}

              <div
                className={`${styles.planDropTarget} ${dragOverIndex === crcPlan.length ? styles.planItemDragOver : ''}`}
                onDragOver={(e) => handleDragOver(e, crcPlan.length)}
                onDrop={(e) => handleDropOnPlan(e, crcPlan.length)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
