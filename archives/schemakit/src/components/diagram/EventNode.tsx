'use client';

/**
 * Un événement de la ligne du temps : une boîte posée à la date calculée, avec sa date
 * en légende. Une période s'étire entre ses deux dates. Le texte se modifie par la
 * popup (double-clic ou ✎), pas en place : la date en fait partie.
 */
import { createContext, useContext, useState, type DragEvent } from 'react';
import { NodeToolbar, Position, type Node, type NodeProps } from '@xyflow/react';
import { effectiveBox, resolveFill, resolveStroke, type BoxStyle, type ColorRef, type Diagram } from '@/types/diagram';
import { hasTagData, readTagData } from '@/lib/tag-drop';
import { ColorPicker } from './ColorPicker';
import styles from './EventNode.module.css';

export type EventNodeData = {
  label: string;
  caption: string; // « 18 juin 1815 » ou « 1830 → 1831 »
  color: ColorRef;
  box?: BoxStyle;
  isPeriod: boolean;
  width?: number; // période : largeur imposée par les dates
};
export type EventNodeType = Node<EventNodeData, 'event'>;

export interface TimelineActions {
  edit: (id: string) => void;
  recolor: (id: string, color: ColorRef) => void;
  remove: (id: string) => void;
  dropTag: (tag: string, laneId: string | undefined) => void;
  laneOf: (id: string) => string | undefined;
  openTools: () => void;
  readOnly: boolean;
  defaults: Diagram['defaults'];
}
export const TimelineActionsContext = createContext<TimelineActions | null>(null);

export function EventNode({ id, data, selected }: NodeProps<EventNodeType>) {
  const actions = useContext(TimelineActionsContext);
  const [dropping, setDropping] = useState(false);
  const box = effectiveBox(data.box, { defaults: actions?.defaults });
  const borderWidth = box.border === 'none' ? 0 : box.border === 'thick' ? 4 : 2;

  const onDragOver = (e: DragEvent) => {
    if (!hasTagData(e) || actions?.readOnly) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropping(true);
  };
  const onDrop = (e: DragEvent) => {
    const tag = readTagData(e);
    setDropping(false);
    if (!tag) return;
    e.preventDefault();
    actions?.dropTag(tag, actions.laneOf(id));
  };

  return (
    <div
      className={styles.node}
      data-selected={selected || undefined}
      data-period={data.isPeriod || undefined}
      data-dropping={dropping || undefined}
      style={{
        background: resolveFill(data.color),
        borderWidth,
        borderColor: resolveStroke(box.borderColor),
        borderRadius: box.corners === 'square' ? 2 : 10,
        width: data.width,
      }}
      onDoubleClick={() => !actions?.readOnly && actions?.edit(id)}
      onDragOver={onDragOver}
      onDragLeave={() => setDropping(false)}
      onDrop={onDrop}
    >
      {actions && !actions.readOnly && (
        <NodeToolbar isVisible={selected} position={Position.Top} className={styles.toolbar}>
          <ColorPicker compact palette="fill" value={data.color} label="Fond" onChange={(c) => actions.recolor(id, c)} />
          <button type="button" className={styles.toolButton} onClick={() => actions.edit(id)} title="Modifier (titre, dates, étage)">
            ✎
          </button>
          <button type="button" className={styles.toolButton} onClick={() => actions.remove(id)} title="Supprimer cet événement">
            🗑
          </button>
          <button type="button" className={styles.toolButton} onClick={actions.openTools} title="Tous les réglages">
            Outils…
          </button>
        </NodeToolbar>
      )}
      <span className={styles.caption}>{data.caption}</span>
      <span className={styles.label}>{data.label}</span>
    </div>
  );
}
