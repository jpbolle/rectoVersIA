'use client';

/**
 * Un lien de carte conceptuelle : une flèche avec son mot de liaison au milieu.
 * Un clic sur le mot ouvre la saisie.
 *
 * Schéma LIBRE (contexte `free`) : le tracé se choisit (courbe, coudé, droit) et le
 * sens aussi (pointe à l'arrivée, aux deux bouts, aucune).
 */
import { useContext, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeToolbar,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  useReactFlow,
  type EdgeProps,
} from '@xyflow/react';
import { dashArray, effectiveLine, resolveStroke, type EdgeArrow, type EdgePath, type LineStyle } from '@/types/diagram';
import { ColorPicker } from './ColorPicker';
import { edgeMarkers, type LabeledEdgeData, type LabeledEdgeType } from '@/lib/diagram/diagram-convert';
import { ConceptContextValue } from './ConceptNode';
import styles from './LabeledEdge.module.css';

const PATHS: { id: EdgePath; title: string; glyph: string }[] = [
  { id: 'curve', title: 'Courbe', glyph: '⌒' },
  { id: 'ortho', title: 'Coudé', glyph: '⌐' },
  { id: 'straight', title: 'Droit', glyph: '╱' },
];
const ARROWS: { id: EdgeArrow; title: string; glyph: string }[] = [
  { id: 'end', title: 'Pointe à l’arrivée', glyph: '→' },
  { id: 'both', title: 'Pointes aux deux bouts', glyph: '↔' },
  { id: 'none', title: 'Sans pointe', glyph: '—' },
];

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
  markerStart,
}: EdgeProps<LabeledEdgeType>) {
  const { setEdges, deleteElements } = useReactFlow();
  const { defaults, openTools, free } = useContext(ConceptContextValue);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data?.label ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  const pathKind: EdgePath = free ? data?.path ?? 'curve' : 'curve';
  const geometry = { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition };
  const [path, labelX, labelY] =
    pathKind === 'straight' ? getStraightPath(geometry) : pathKind === 'ortho' ? getSmoothStepPath({ ...geometry, borderRadius: 8 }) : getBezierPath(geometry);

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

  /** Tracé et sens (schéma libre) : les pointes de flèche suivent le sens. */
  const patchEdge = (patch: Pick<LabeledEdgeData, 'path' | 'arrow'>) =>
    setEdges((edges) =>
      edges.map((e) => {
        if (e.id !== id) return e;
        const current = (e.data ?? { label: '' }) as LabeledEdgeData;
        const next = { ...current, ...patch };
        return { ...e, data: next, ...edgeMarkers(next.arrow) };
      }),
    );

  return (
    <>
      {selected && <BaseEdge id={`${id}-halo`} path={path} style={{ stroke: 'var(--c-primary)', strokeWidth: line.width + 6, opacity: 0.25 }} />}
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        markerStart={markerStart}
        style={{ stroke, strokeWidth: line.width, strokeDasharray: dashArray(line.dash, line.width) }}
      />
      <EdgeToolbar edgeId={id} x={labelX} y={labelY} isVisible={selected && !editing} alignY="top" className={styles.toolbar}>
        <button type="button" className={styles.toolButton} onClick={startEdit} title="Modifier le mot de liaison">
          ✎
        </button>
        {free && (
          <>
            <span className={styles.group} role="radiogroup" aria-label="Tracé">
              {PATHS.map((p) => (
                <button key={p.id} type="button" role="radio" aria-checked={pathKind === p.id} className={styles.segment} data-active={pathKind === p.id || undefined} onClick={() => patchEdge({ path: p.id })} title={p.title}>
                  {p.glyph}
                </button>
              ))}
            </span>
            <span className={styles.group} role="radiogroup" aria-label="Sens">
              {ARROWS.map((a) => (
                <button key={a.id} type="button" role="radio" aria-checked={(data?.arrow ?? 'end') === a.id} className={styles.segment} data-active={(data?.arrow ?? 'end') === a.id || undefined} onClick={() => patchEdge({ arrow: a.id })} title={a.title}>
                  {a.glyph}
                </button>
              ))}
            </span>
          </>
        )}
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
      {/* Schéma libre : pas d'étiquette fantôme sur une flèche sans texte (sauf sélection). */}
      {!(free && !label && !selected && !editing) && (
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
            label || (free ? '' : 'mot de liaison')
          )}
        </div>
      </EdgeLabelRenderer>
      )}
    </>
  );
}
