'use client';

/**
 * Un concept de la carte conceptuelle : une boîte dans laquelle l'élève écrit
 * directement (double-clic), avec quatre points d'accroche pour tirer un lien.
 * La barre au-dessus (couleurs, suppression) apparaît quand la boîte est sélectionnée.
 * On peut y déposer un tag « à placer » : il devient un concept relié.
 *
 * Schéma LIBRE (contexte `free`) : la boîte a une forme (arrondie, rectangle,
 * ellipse, losange, note, texte seul) et se redimensionne par ses poignées.
 */
import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type DragEvent, type KeyboardEvent } from 'react';
import { Handle, NodeResizer, NodeToolbar, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import { DEFAULT_SHAPE, SHAPE_KINDS, effectiveBox, resolveFill, resolveStroke, type Diagram, type ShapeKind } from '@/types/diagram';
import type { ConceptNodeType } from '@/lib/diagram/diagram-convert';
import { hasTagData, readTagData } from '@/lib/diagram/tag-drop';
import { ColorPicker } from './ColorPicker';
import styles from './ConceptNode.module.css';

/** Ce que les nœuds reçoivent de l'éditeur sans passer par leurs données. */
export interface ConceptContext {
  defaults: Diagram['defaults'];
  dropTag: (nodeId: string, tag: string) => void;
  /** Ouvre l'onglet « Outils » du volet du bas (tous les réglages de la sélection). */
  openTools: () => void;
  /** Schéma libre : formes et poignées de taille. */
  free: boolean;
}
export const ConceptContextValue = createContext<ConceptContext>({ defaults: undefined, dropTag: () => {}, openTools: () => {}, free: false });

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
    const label = draft.trim() || (shape === 'text' ? 'Texte' : 'Concept');
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
  const shape: ShapeKind = ctx.free ? data.shape ?? DEFAULT_SHAPE : 'rounded';
  const borderWidth = shape === 'text' ? 0 : box.border === 'none' ? 0 : box.border === 'thick' ? 4 : 2;
  const stroke = resolveStroke(box.borderColor);

  const style: CSSProperties = {
    background: shape === 'text' ? 'transparent' : resolveFill(data.color),
    borderWidth,
    borderColor: stroke,
    borderRadius: shape === 'ellipse' ? '50%' : shape === 'rect' || shape === 'diamond' || box.corners === 'square' ? 2 : 12,
  };
  if (shape === 'diamond') {
    // Le losange est un fond dessiné (pas de bordure CSS possible sur un clip-path).
    style.background = 'transparent';
    style.borderWidth = 0;
  }

  return (
    <div
      className={styles.node}
      data-selected={selected || undefined}
      data-dropping={dropping || undefined}
      data-shape={shape}
      data-free={ctx.free || undefined}
      style={style}
      onDoubleClick={startEdit}
      onDragOver={onDragOver}
      onDragLeave={() => setDropping(false)}
      onDrop={onDrop}
    >
      {shape === 'diamond' && (
        <svg className={styles.diamond} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <polygon points="50,1 99,50 50,99 1,50" fill={resolveFill(data.color)} stroke={stroke} strokeWidth={borderWidth} vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      {shape === 'note' && <span className={styles.noteCorner} style={{ borderColor: stroke }} aria-hidden />}

      {ctx.free && (
        <NodeResizer
          isVisible={selected && !editing}
          minWidth={60}
          minHeight={36}
          lineClassName={styles.resizeLine}
          handleClassName={styles.resizeHandle}
        />
      )}

      <NodeToolbar isVisible={selected && !editing} position={Position.Top} className={styles.toolbar}>
        {ctx.free && (
          <select
            className={`nodrag ${styles.shapeSelect}`}
            value={shape}
            title="Forme"
            aria-label="Forme"
            onChange={(e) => updateNodeData(id, { shape: e.target.value as ShapeKind })}
          >
            {SHAPE_KINDS.map((s) => (
              <option key={s.kind} value={s.kind}>
                {s.glyph} {s.label}
              </option>
            ))}
          </select>
        )}
        {shape !== 'text' && (
          <ColorPicker compact palette="fill" value={data.color} label="Fond" onChange={(color) => updateNodeData(id, { color })} />
        )}
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
          placeholder={shape === 'text' ? 'Texte' : 'Concept'}
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
