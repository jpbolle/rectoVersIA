'use client';

/**
 * Un lien de carte conceptuelle : une flèche avec son mot de liaison au milieu.
 * Un clic sur le mot ouvre la saisie.
 */
import { useContext, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { BaseEdge, EdgeLabelRenderer, EdgeToolbar, getBezierPath, useReactFlow, type EdgeProps } from '@xyflow/react';
import { dashArray, effectiveLine, resolveStroke, type LineStyle } from '@/types/diagram';
import { ColorPicker } from './ColorPicker';
import type { LabeledEdgeData, LabeledEdgeType } from '@/lib/diagram-convert';
import { ConceptContextValue } from './ConceptNode';
import styles from './LabeledEdge.module.css';

export function LabeledEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps<LabeledEdgeType>) {
  const { setEdges, deleteElements } = useReactFlow();
  const { defaults, openTools } = useContext(ConceptContextValue);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data?.label ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const startEdit = () => {
    setDraft(data?.label ?? '');
    setEditing(true);
  };

  const commit = () => {
    const label = draft.trim();
    setEdges((edges) => edges.map((e) => (e.id === id ? { ...e, data: { ...e.data, label } } : e)));
    setEditing(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditing(false);
    }
  };

  const label = data?.label ?? '';
  const line = effectiveLine(data?.line, { defaults });
  const stroke = resolveStroke(line.color);

  const patchLine = (patch: LineStyle) =>
    setEdges((edges) =>
      edges.map((e) => {
        if (e.id !== id) return e;
        const current = (e.data ?? { label: '' }) as LabeledEdgeData;
        return { ...e, data: { ...current, line: { ...current.line, ...patch } } };
      }),
    );

  return (
    <>
      {selected && <BaseEdge id={`${id}-halo`} path={path} style={{ stroke: 'var(--c-primary)', strokeWidth: line.width + 6, opacity: 0.25 }} />}
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{ stroke, strokeWidth: line.width, strokeDasharray: dashArray(line.dash, line.width) }}
      />
      <EdgeToolbar edgeId={id} x={labelX} y={labelY} isVisible={selected && !editing} alignY="top" className={styles.toolbar}>
        <button type="button" className={styles.toolButton} onClick={startEdit} title="Modifier le mot de liaison">
          ✎
        </button>
        <span className={styles.group} role="radiogroup" aria-label="Épaisseur">
          {([1, 2, 4] as const).map((w) => (
            <button key={w} type="button" role="radio" aria-checked={line.width === w} className={styles.segment} data-active={line.width === w || undefined} onClick={() => patchLine({ width: w })} title={`Épaisseur ${w}`}>
              <span className={styles.widthSample} style={{ height: w }} />
            </button>
          ))}
        </span>
        <span className={styles.group} role="radiogroup" aria-label="Style du trait">
          {(
            [
              ['solid', 'Plein', '━'],
              ['dashed', 'Tirets', '╌'],
              ['dotted', 'Pointillé', '┈'],
            ] as const
          ).map(([dash, title, glyph]) => (
            <button key={dash} type="button" role="radio" aria-checked={line.dash === dash} className={styles.segment} data-active={line.dash === dash || undefined} onClick={() => patchLine({ dash })} title={title}>
              {glyph}
            </button>
          ))}
        </span>
        <ColorPicker compact palette="stroke" value={line.color} label="Couleur" onChange={(color) => patchLine({ color })} />
        <button type="button" className={styles.toolButton} onClick={() => deleteElements({ edges: [{ id }] })} title="Supprimer ce lien">
          🗑
        </button>
        <button type="button" className={styles.toolButton} onClick={openTools} title="Tous les réglages">
          Outils…
        </button>
      </EdgeToolbar>
      <EdgeLabelRenderer>
        <div
          className={`nodrag nopan ${styles.label}`}
          data-selected={selected || undefined}
          data-empty={!label || undefined}
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          onClick={startEdit}
          title="Cliquer pour écrire le mot de liaison"
        >
          {editing ? (
            <input
              ref={inputRef}
              className={styles.input}
              value={draft}
              placeholder="mot de liaison"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              onBlur={commit}
            />
          ) : (
            label || 'mot de liaison'
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
