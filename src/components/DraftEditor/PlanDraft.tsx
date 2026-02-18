'use client';

import { useCallback } from 'react';
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
}: PlanDraftProps) {
  const showAnnotations = !!draftAnnotations && (!!onAnnotationChange || readOnlyAnnotations);
  const plan = draft.plan || [createPlanItem()];

  // Mise a jour recursive d'un item dans l'arbre
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
        // null = suppression
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

    // Chercher au niveau racine
    const rootIndex = plan.findIndex(item => item.id === id);
    if (rootIndex !== -1) {
      const updated = [...plan];
      updated.splice(rootIndex + 1, 0, newItem);
      onChange({ ...draft, plan: updated });
      return;
    }

    // Chercher dans l'arbre : ajouter apres l'item dans le parent
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
    // Empecher de supprimer le dernier item racine
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

  // Calcul de profondeur d'un item
  const getDepth = useCallback((id: string, items: PlanItem[] = plan, depth: number = 0): number => {
    for (const item of items) {
      if (item.id === id) return depth;
      const childDepth = getDepth(id, item.children, depth + 1);
      if (childDepth >= 0) return childDepth;
    }
    return -1;
  }, [plan]);

  // Generer le numero hierarchique (1, 1.1, 1.1.1, ...)
  const getItemNumber = useCallback((id: string, items: PlanItem[] = plan, prefix: string = ''): string => {
    for (let i = 0; i < items.length; i++) {
      const num = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
      if (items[i].id === id) return num;
      const childNum = getItemNumber(id, items[i].children, num);
      if (childNum) return childNum;
    }
    return '';
  }, [plan]);

  // Rendu d'une idee secondaire (depth >= 1)
  const renderChild = (item: PlanItem, depth: number) => {
    const number = getItemNumber(item.id);
    const canAddChild = depth < MAX_DEPTH - 1;

    const depthClass = styles[`depth${depth}` as keyof typeof styles] || '';

    return (
      <div key={item.id} className={`${styles.childContainer} ${depthClass}`}>
        <div className={styles.itemRow}>
          <div className={styles.childItem}>
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

        {/* Sous-enfants */}
        {item.children.length > 0 && (
          <div className={styles.subChildren}>
            {item.children.map(child => renderChild(child, depth + 1))}
          </div>
        )}

        {/* Bouton ajouter sous-idee */}
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

  // Rendu d'un bloc idee principale (depth 0)
  const renderMainItem = (item: PlanItem) => {
    const number = getItemNumber(item.id);

    return (
      <div key={item.id} className={styles.mainBlock}>
        {/* Encadre idee principale */}
        <div className={styles.itemRow}>
          <div className={styles.mainItem}>
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

        {/* Idees secondaires */}
        {item.children.length > 0 && (
          <div className={styles.children}>
            {item.children.map(child => renderChild(child, 1))}
          </div>
        )}

        {/* Bouton ajouter idee secondaire */}
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
      <div className={styles.header}>
        <span className={styles.headerIcon}>🗂️</span>
        <h3>Plan du texte</h3>
        <span className={styles.headerHint}>
          Ajoute progressivement les idées principales identifiées puis les idées secondaires
        </span>
      </div>

      <div className={styles.tree}>
        {plan.map((item) => (
          <div key={item.id}>
            {renderMainItem(item)}

            {/* Encadre pointille pour ajouter une idee principale */}
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
