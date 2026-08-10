'use client';

import { useCallback, useState } from 'react';
import type { DraftContent, PlanItem } from '@/types/travail';
import type { DraftItemAnnotation } from '@/types/correction';
import { createPlanItem } from '@/lib/draft-utils';
import DraftItemAnnotations from './DraftItemAnnotations';
import styles from './PlanDraft.module.css';

const MAX_DEPTH = 5;

interface PlanDraftProps {
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
  // Masquer le bandeau d'en-tête « Plan du texte » (ex. corrigé prof dans le
  // formulaire de création, où le contenu n'est pas forcément un plan de texte)
  hideHeader?: boolean;
}

export default function PlanDraft({
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
  hideHeader = false,
}: PlanDraftProps) {
  const showAnnotations = !!draftAnnotations && (!!onAnnotationChange || readOnlyAnnotations);
  const plan = draft.plan || [createPlanItem()];

  // État drag & drop
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<{ id: string; position: 'before' | 'after' } | null>(null);

  // --- Helpers arbre existants ---

  const updateItemInTree = useCallback((
    items: PlanItem[],
    targetId: string,
    updater: (item: PlanItem) => PlanItem | null
  ): PlanItem[] => {
    const result: PlanItem[] = [];
    for (const item of items) {
      if (item.id === targetId) {
        const updated = updater(item);
        if (updated) result.push(updated);
      } else {
        result.push({
          ...item,
          children: updateItemInTree(item.children, targetId, updater),
        });
      }
    }
    return result;
  }, []);

  const handleTextChange = useCallback((id: string, text: string) => {
    const updated = updateItemInTree(plan, id, (item) => ({ ...item, text }));
    onChange({ ...draft, plan: updated });
  }, [draft, onChange, plan, updateItemInTree]);

  const handleAddChild = useCallback((parentId: string) => {
    const newItem = createPlanItem();
    const updated = updateItemInTree(plan, parentId, (item) => ({
      ...item,
      children: [...item.children, newItem],
    }));
    onChange({ ...draft, plan: updated });
  }, [draft, onChange, plan, updateItemInTree]);

  const handleAddSibling = useCallback((id: string) => {
    const newItem = createPlanItem();

    const rootIndex = plan.findIndex(item => item.id === id);
    if (rootIndex !== -1) {
      const updated = [...plan];
      updated.splice(rootIndex + 1, 0, newItem);
      onChange({ ...draft, plan: updated });
      return;
    }

    const addSiblingInTree = (items: PlanItem[]): PlanItem[] => {
      const result: PlanItem[] = [];
      for (const item of items) {
        const childIndex = item.children.findIndex(c => c.id === id);
        if (childIndex !== -1) {
          const updatedChildren = [...item.children];
          updatedChildren.splice(childIndex + 1, 0, newItem);
          result.push({ ...item, children: updatedChildren });
        } else {
          result.push({ ...item, children: addSiblingInTree(item.children) });
        }
      }
      return result;
    };

    onChange({ ...draft, plan: addSiblingInTree(plan) });
  }, [draft, onChange, plan]);

  const handleRemove = useCallback((id: string) => {
    if (plan.length === 1 && plan[0].id === id) return;

    const rootIndex = plan.findIndex(item => item.id === id);
    if (rootIndex !== -1) {
      const updated = plan.filter((_, i) => i !== rootIndex);
      onChange({ ...draft, plan: updated });
      return;
    }

    const updated = updateItemInTree(plan, id, () => null);
    onChange({ ...draft, plan: updated });
  }, [draft, onChange, plan, updateItemInTree]);

  const getDepth = useCallback((id: string, items: PlanItem[] = plan, depth: number = 0): number => {
    for (const item of items) {
      if (item.id === id) return depth;
      const childDepth = getDepth(id, item.children, depth + 1);
      if (childDepth >= 0) return childDepth;
    }
    return -1;
  }, [plan]);

  const getItemNumber = useCallback((id: string, items: PlanItem[] = plan, prefix: string = ''): string => {
    for (let i = 0; i < items.length; i++) {
      const num = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
      if (items[i].id === id) return num;
      const childNum = getItemNumber(id, items[i].children, num);
      if (childNum) return childNum;
    }
    return '';
  }, [plan]);

  // --- Drag & drop ---

  // Retourne l'id du parent de l'item (null = racine, undefined = introuvable)
  const findParentId = useCallback((
    items: PlanItem[],
    targetId: string,
    parentId: string | null = null
  ): string | null | undefined => {
    for (const item of items) {
      if (item.id === targetId) return parentId;
      const found = findParentId(item.children, targetId, item.id);
      if (found !== undefined) return found;
    }
    return undefined;
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    e.dataTransfer.effectAllowed = 'move';
    // Timeout pour que le navigateur capture l'image de drag avant le re-render
    setTimeout(() => setDraggedId(id), 0);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDragOver(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedId || draggedId === id) return;

    const draggedParent = findParentId(plan, draggedId);
    const targetParent = findParentId(plan, id);

    // Idée principale (root) ↔ idée principale uniquement
    // Sous-idée ↔ n'importe quelle autre sous-idée (même parent ou non)
    const draggedIsRoot = draggedParent === null;
    const targetIsRoot = targetParent === null;
    if (draggedIsRoot !== targetIsRoot) return;

    e.dataTransfer.dropEffect = 'move';

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const position: 'before' | 'after' = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';

    if (dragOver?.id !== id || dragOver?.position !== position) {
      setDragOver({ id, position });
    }
  }, [draggedId, findParentId, plan, dragOver]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOver(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();

    const cleanup = () => { setDraggedId(null); setDragOver(null); };

    if (!draggedId || draggedId === targetId || !dragOver) { cleanup(); return; }

    const draggedParent = findParentId(plan, draggedId);
    const targetParent = findParentId(plan, targetId);
    const draggedIsRoot = draggedParent === null;
    const targetIsRoot = targetParent === null;
    if (draggedIsRoot !== targetIsRoot) { cleanup(); return; }

    // 1. Extraire l'item dragué de l'arbre
    let extracted: PlanItem | null = null;
    const extract = (items: PlanItem[]): PlanItem[] => {
      const result: PlanItem[] = [];
      for (const item of items) {
        if (item.id === draggedId) {
          extracted = item;
        } else {
          result.push({ ...item, children: extract(item.children) });
        }
      }
      return result;
    };

    const treeWithout = extract(plan);
    if (!extracted) { cleanup(); return; }

    // 2. Insérer avant/après le target (à n'importe quel niveau)
    const insert = (items: PlanItem[]): PlanItem[] => {
      const result: PlanItem[] = [];
      for (const item of items) {
        if (item.id === targetId) {
          if (dragOver.position === 'before') {
            result.push(extracted!);
            result.push({ ...item, children: insert(item.children) });
          } else {
            result.push({ ...item, children: insert(item.children) });
            result.push(extracted!);
          }
        } else {
          result.push({ ...item, children: insert(item.children) });
        }
      }
      return result;
    };

    onChange({ ...draft, plan: insert(treeWithout) });
    cleanup();
  }, [draggedId, dragOver, findParentId, plan, draft, onChange]);

  // Style de l'indicateur de drop (ligne avant/après)
  const dropIndicatorStyle = (id: string): React.CSSProperties => {
    if (dragOver?.id !== id) return {};
    return dragOver.position === 'before'
      ? { borderTop: '2px solid var(--c-primary)' }
      : { borderBottom: '2px solid var(--c-primary)' };
  };

  // --- Rendu ---

  const renderDragHandle = (id: string) => {
    if (disabled) return null;
    return (
      <span
        draggable
        onDragStart={(e) => handleDragStart(e, id)}
        onDragEnd={handleDragEnd}
        title="Déplacer"
        style={{
          cursor: 'grab',
          padding: '0 6px 0 0',
          color: 'var(--c-border, #ccc)',
          userSelect: 'none',
          fontSize: '16px',
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ⠿
      </span>
    );
  };

  const renderChild = (item: PlanItem, depth: number) => {
    const number = getItemNumber(item.id);
    const canAddChild = depth < MAX_DEPTH - 1;
    const depthClass = styles[`depth${depth}` as keyof typeof styles] || '';

    return (
      <div
        key={item.id}
        className={`${styles.childContainer} ${depthClass}`}
        style={draggedId === item.id ? { opacity: 0.4 } : {}}
      >
        <div
          className={styles.itemRow}
          onDragOver={(e) => handleDragOver(e, item.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, item.id)}
          style={dropIndicatorStyle(item.id)}
        >
          <div className={styles.childItem}>
            {renderDragHandle(item.id)}
            <span className={`${styles.number} ${depthClass ? styles[`number${depth}` as keyof typeof styles] || '' : ''}`}>
              {number}
            </span>
            <textarea
              className={styles.itemInput}
              value={item.text}
              onChange={(e) => handleTextChange(item.id, e.target.value)}
              placeholder={`Idée secondaire ${number}...`}
              disabled={disabled}
              rows={1}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = target.scrollHeight + 'px';
              }}
            />

            {!disabled && (
              <button
                type="button"
                className={`${styles.actionButton} ${styles.removeAction}`}
                onClick={() => handleRemove(item.id)}
                title="Supprimer"
              >
                ×
              </button>
            )}
          </div>
          {showAnnotations && (
            <DraftItemAnnotations
              itemId={item.id}
              annotation={draftAnnotations![item.id]}
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

        {item.children.length > 0 && (
          <div className={styles.subChildren}>
            {item.children.map(child => renderChild(child, depth + 1))}
          </div>
        )}

        {!disabled && canAddChild && (
          <button
            type="button"
            className={styles.addChildButton}
            onClick={() => handleAddChild(item.id)}
          >
            + Ajouter une sous-idée
          </button>
        )}
      </div>
    );
  };

  const renderMainItem = (item: PlanItem) => {
    const number = getItemNumber(item.id);

    return (
      <div
        key={item.id}
        className={styles.mainBlock}
        style={draggedId === item.id ? { opacity: 0.4 } : {}}
      >
        <div
          className={styles.itemRow}
          onDragOver={(e) => handleDragOver(e, item.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, item.id)}
          style={dropIndicatorStyle(item.id)}
        >
          <div className={styles.mainItem}>
            {renderDragHandle(item.id)}
            <span className={`${styles.number} ${styles.numberMain}`}>
              {number}
            </span>
            <textarea
              className={`${styles.itemInput} ${styles.itemInputMain}`}
              value={item.text}
              onChange={(e) => handleTextChange(item.id, e.target.value)}
              placeholder={`Idée principale ${number}...`}
              disabled={disabled}
              rows={1}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = target.scrollHeight + 'px';
              }}
            />

            {!disabled && !(plan.length === 1 && item.children.length === 0) && (
              <button
                type="button"
                className={`${styles.actionButton} ${styles.removeAction}`}
                onClick={() => handleRemove(item.id)}
                title="Supprimer"
              >
                ×
              </button>
            )}
          </div>
          {showAnnotations && (
            <DraftItemAnnotations
              itemId={item.id}
              annotation={draftAnnotations![item.id]}
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

        {item.children.length > 0 && (
          <div className={styles.children}>
            {item.children.map(child => renderChild(child, 1))}
          </div>
        )}

        {!disabled && (
          <button
            type="button"
            className={styles.addChildButton}
            onClick={() => handleAddChild(item.id)}
          >
            + Ajouter une idée secondaire
          </button>
        )}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      {!hideHeader && (
        <div className={styles.header}>
          <span className={styles.headerIcon}>🗂️</span>
          <h3>Plan du texte</h3>
          <span className={styles.headerHint}>
            Ajoute progressivement les idées principales identifiées puis les idées secondaires
          </span>
        </div>
      )}

      <div className={styles.tree}>
        {plan.map((item) => (
          <div key={item.id}>
            {renderMainItem(item)}

            {!disabled && (
              <button
                type="button"
                className={styles.addRootButton}
                onClick={() => handleAddSibling(item.id)}
              >
                + Ajouter une idée principale
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
