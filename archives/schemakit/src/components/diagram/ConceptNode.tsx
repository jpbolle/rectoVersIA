'use client';

/**
 * Un concept de la carte conceptuelle : une boîte dans laquelle l'élève écrit
 * directement (double-clic), avec quatre points d'accroche pour tirer un lien.
 * La barre au-dessus (couleurs, suppression) apparaît quand la boîte est sélectionnée.
 * On peut y déposer un tag « à placer » : il devient un concept relié.
 */
import { createContext, useContext, useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { Handle, NodeToolbar, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import { effectiveBox, resolveFill, resolveStroke, type Diagram } from '@/types/diagram';
import type { ConceptNodeType } from '@/lib/diagram-convert';
import { hasTagData, readTagData } from '@/lib/tag-drop';
import { ColorPicker } from './ColorPicker';
import styles from './ConceptNode.module.css';

/** Ce que les nœuds reçoivent de l'éditeur sans passer par leurs données. */
export interface ConceptContext {
  defaults: Diagram['defaults'];
  dropTag: (nodeId: string, tag: string) => void;
  /** Ouvre l'onglet « Outils » du volet du bas (tous les réglages de la sélection). */
  openTools: () => void;
}
export const ConceptContextValue = createContext<ConceptContext>({ defaults: undefined, dropTag: () => {}, openTools: () => {} });

export function ConceptNode({ id, data, selected }: NodeProps<ConceptNodeType>) {
  const { updateNodeData, deleteElements } = useReactFlow();
  const ctx = useContext(ConceptContextValue);
  // Un concept créé vide s'ouvre directement en saisie.
  const [editing, setEditing] = useState(data.label === '');
  const [draft, setDraft] = useState(data.label);
  const [dropping, setDropping] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const startEdit = () => {
    setDraft(data.label);
    setEditing(true);
  };

  const commit = () => {
    const label = draft.trim() || 'Concept';
    updateNodeData(id, { label });
    setEditing(false);
  };

  const cancel = () => {
    if (data.label === '') {
      // Concept jamais nommé : on l'abandonne plutôt que de laisser une boîte vide.
      deleteElements({ nodes: [{ id }] });
      return;
    }
    setEditing(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  };

  const onDragOver = (e: DragEvent) => {
    if (!hasTagData(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropping(true);
  };
  const onDrop = (e: DragEvent) => {
    const tag = readTagData(e);
    setDropping(false);
    if (!tag) return;
    e.preventDefault();
    ctx.dropTag(id, tag);
  };

  const box = effectiveBox(data.box, { defaults: ctx.defaults });
  const borderWidth = box.border === 'none' ? 0 : box.border === 'thick' ? 4 : 2;

  return (
    <div
      className={styles.node}
      data-selected={selected || undefined}
      data-dropping={dropping || undefined}
      style={{
        background: resolveFill(data.color),
        borderWidth,
        borderColor: resolveStroke(box.borderColor),
        borderRadius: box.corners === 'square' ? 2 : 12,
      }}
      onDoubleClick={startEdit}
      onDragOver={onDragOver}
      onDragLeave={() => setDropping(false)}
      onDrop={onDrop}
    >
      <NodeToolbar isVisible={selected && !editing} position={Position.Top} className={styles.toolbar}>
        <ColorPicker compact palette="fill" value={data.color} label="Fond" onChange={(color) => updateNodeData(id, { color })} />
        <button type="button" className={styles.toolButton} onClick={startEdit} title="Modifier le texte">
          ✎
        </button>
        <button
          type="button"
          className={styles.toolButton}
          onClick={() => deleteElements({ nodes: [{ id }] })}
          title="Supprimer ce concept"
        >
          🗑
        </button>
        <button type="button" className={styles.toolButton} onClick={ctx.openTools} title="Tous les réglages (bordure, coins, contour)">
          Outils…
        </button>
      </NodeToolbar>

      {editing ? (
        <textarea
          ref={inputRef}
          className={`nodrag nowheel ${styles.input}`}
          value={draft}
          placeholder="Concept"
          rows={1}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commit}
        />
      ) : (
        <div className={styles.label}>{data.label}</div>
      )}

      <Handle type="source" position={Position.Top} id="top" className={styles.handle} />
      <Handle type="source" position={Position.Right} id="right" className={styles.handle} />
      <Handle type="source" position={Position.Bottom} id="bottom" className={styles.handle} />
      <Handle type="source" position={Position.Left} id="left" className={styles.handle} />
    </div>
  );
}
