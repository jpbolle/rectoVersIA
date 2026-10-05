'use client';

/**
 * Une idée d'un schéma en arbre (carte mentale, schéma hiérarchisé) : boîte non
 * déplaçable (disposition automatique), texte modifiable au double-clic, barre de
 * couleurs, bouton « + idée ». Le numéro (1.2.1) n'apparaît que dans l'organigramme.
 * On peut y déposer un tag « à placer » : il devient une idée enfant.
 */
import { createContext, useContext, useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { Handle, NodeToolbar, Position, type Node, type NodeProps } from '@xyflow/react';
import { effectiveBox, resolveFill, resolveStroke, type ColorRef, type Diagram } from '@/types/diagram';
import type { Side } from '@/lib/diagram/tree-layout';
import { hasTagData, readTagData } from '@/lib/diagram/tag-drop';
import { ColorPicker } from './ColorPicker';
import styles from './TreeNode.module.css';

export type TreeNodeData = {
  label: string;
  color: ColorRef;
  box?: Diagram['nodes'][number]['box'];
  side: Side;
  number: string; // '' pour la racine ou hors organigramme
  isRoot: boolean;
  autoEdit: boolean; // idée qui vient d'être créée : s'ouvre en saisie
};
export type TreeNodeType = Node<TreeNodeData, 'idea'>;

/** Les actions sur l'arbre sont fournies par l'éditeur, pas stockées dans les données. */
export interface TreeActions {
  rename: (id: string, label: string) => void;
  recolor: (id: string, color: ColorRef) => void;
  addChild: (id: string, label?: string) => void;
  remove: (id: string) => void;
  dropTag: (id: string, tag: string) => void;
  openTools: () => void;
  readOnly: boolean;
  defaults: Diagram['defaults'];
}
export const TreeActionsContext = createContext<TreeActions | null>(null);

export function TreeNode({ id, data, selected }: NodeProps<TreeNodeType>) {
  const actions = useContext(TreeActionsContext);
  const [editing, setEditing] = useState(data.autoEdit);
  const [draft, setDraft] = useState(data.label);
  const [dropping, setDropping] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) return;
    // React Flow garde une boîte neuve invisible tant qu'il ne l'a pas mesurée, et un
    // élément invisible refuse le focus : on réessaie quelques images de suite.
    let frame = 0;
    let tries = 0;
    const focus = () => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      if (document.activeElement === input) input.select();
      else if (++tries < 20) frame = requestAnimationFrame(focus);
    };
    focus();
    return () => cancelAnimationFrame(frame);
  }, [editing]);

  const startEdit = () => {
    if (actions?.readOnly) return;
    setDraft(data.label);
    setEditing(true);
  };

  const commit = () => {
    actions?.rename(id, draft.trim() || (data.isRoot ? 'Sujet' : 'Idée'));
    setEditing(false);
  };

  const cancel = () => {
    if (data.autoEdit && !data.label) {
      actions?.remove(id);
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
    // Tab pendant la saisie : on valide, et l'éditeur (au-dessus) crée l'idée enfant.
    if (e.key === 'Tab') commit();
  };

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
    actions?.dropTag(id, tag);
  };

  // Points d'accroche selon le côté : l'entrée regarde le parent, la sortie les enfants.
  const inPosition = data.side === 'left' ? Position.Right : data.side === 'right' ? Position.Left : Position.Top;
  const outPosition = data.side === 'left' ? Position.Left : data.side === 'right' ? Position.Right : Position.Bottom;

  const box = effectiveBox(data.box, { defaults: actions?.defaults });
  const borderWidth = box.border === 'none' ? 0 : box.border === 'thick' ? 4 : data.isRoot ? 3 : 2;

  return (
    <div
      className={styles.node}
      data-root={data.isRoot || undefined}
      data-selected={selected || undefined}
      data-dropping={dropping || undefined}
      style={{
        background: resolveFill(data.color),
        borderWidth,
        borderColor: data.isRoot && !data.box?.borderColor && !actions?.defaults?.box?.borderColor ? 'var(--c-primary)' : resolveStroke(box.borderColor),
        borderRadius: box.corners === 'square' ? 2 : data.isRoot ? 14 : 10,
      }}
      onDoubleClick={startEdit}
      onDragOver={onDragOver}
      onDragLeave={() => setDropping(false)}
      onDrop={onDrop}
    >
      {actions && !actions.readOnly && (
        <NodeToolbar isVisible={selected && !editing} position={Position.Top} className={styles.toolbar}>
          <ColorPicker compact palette="fill" value={data.color} label="Fond" onChange={(c) => actions.recolor(id, c)} />
          <button type="button" className={styles.toolButton} onClick={() => actions.addChild(id)} title="Ajouter une idée (Tab)">
            ＋ idée
          </button>
          <button type="button" className={styles.toolButton} onClick={startEdit} title="Modifier le texte">
            ✎
          </button>
          {!data.isRoot && (
            <button type="button" className={styles.toolButton} onClick={() => actions.remove(id)} title="Supprimer cette branche">
              🗑
            </button>
          )}
          <button type="button" className={styles.toolButton} onClick={actions.openTools} title="Tous les réglages (bordure, branche)">
            Outils…
          </button>
        </NodeToolbar>
      )}

      {data.number && <span className={styles.number}>{data.number}</span>}

      {editing ? (
        <textarea
          ref={inputRef}
          className={`nodrag nowheel ${styles.input}`}
          value={draft}
          placeholder={data.isRoot ? 'Sujet' : 'Idée'}
          rows={1}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commit}
        />
      ) : (
        <div className={styles.label}>{data.label}</div>
      )}

      <Handle type="target" position={inPosition} id="in" className={styles.handle} isConnectable={false} />
      {data.isRoot ? (
        <>
          <Handle type="source" position={Position.Right} id="right" className={styles.handle} isConnectable={false} />
          <Handle type="source" position={Position.Left} id="left" className={styles.handle} isConnectable={false} />
          <Handle type="source" position={Position.Bottom} id="down" className={styles.handle} isConnectable={false} />
        </>
      ) : (
        <Handle type="source" position={outPosition} id="out" className={styles.handle} isConnectable={false} />
      )}
    </div>
  );
}
