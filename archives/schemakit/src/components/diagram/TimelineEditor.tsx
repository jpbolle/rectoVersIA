'use client';

/**
 * L'éditeur de ligne du temps. Le `Diagram` reçu est la source de vérité : les
 * événements (boîtes React Flow) se placent à la date calculée ; l'axe gradué et les
 * étages (bandeaux) sont dessinés dans le repère du schéma via `ViewportPortal`.
 * Les événements se créent et se modifient par popup (formulaire) ; un tag « à placer »
 * déposé sur un bandeau devient un événement de cet étage.
 */
import '@xyflow/react/dist/style.css';
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type DragEvent } from 'react';
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  ViewportPortal,
  useReactFlow,
  type NodeChange,
} from '@xyflow/react';
import { DEFAULT_NODE_COLOR, newId, resolveFill, type ColorRef, type Diagram, type DiagramNode, type TimelineLane } from '@/types/diagram';
import { formatDate, formatTick, parseDate } from '@/lib/dates';
import { AXIS_HEIGHT, estimateEventSize, layoutTimeline, type EventSize } from '@/lib/timeline-layout';
import { renderDiagramPng } from '@/lib/diagram-export';
import { hasTagData, readTagData } from '@/lib/tag-drop';
import { parseEventText } from '@/lib/diagram-transform';
import { EventNode, TimelineActionsContext, type EventNodeType, type TimelineActions } from './EventNode';
import { EventModal, LaneModal, type EventValues, type LaneValues } from './TimelineModals';
import { DiagramToolbar } from './DiagramToolbar';
import toolbarStyles from './DiagramToolbar.module.css';
import type { EditorCommonProps } from './editor-types';
import editorStyles from './ConceptMapEditor.module.css';
import styles from './TimelineEditor.module.css';

interface Props extends EditorCommonProps {
  diagram: Diagram;
  onChange: (diagram: Diagram) => void;
}

const nodeTypes = { event: EventNode };
const FIT = { padding: 0.15, maxZoom: 1.2 };

type Editing =
  | { kind: 'event'; id?: string; prefill?: Partial<EventValues> }
  | { kind: 'lane'; id?: string }
  | null;

function caption(n: DiagramNode): string {
  const start = parseDate(n.date);
  if (!start) return '';
  const end = parseDate(n.endDate);
  return end ? `${formatDate(start)} → ${formatDate(end)}` : formatDate(start);
}

function Editor({ diagram, onChange, grid, readOnly = false, onSelectionChange, exportRef, onOpenTools }: Props) {
  const { fitBounds, getNodes } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sizes, setSizes] = useState<Map<string, EventSize>>(() => new Map());
  const [editing, setEditing] = useState<Editing>(null);
  const [dropLane, setDropLane] = useState<string | null | undefined>(undefined); // bandeau survolé par un tag

  const lanes = diagram.lanes ?? [];
  const layout = useMemo(
    () => layoutTimeline(diagram, (n) => sizes.get(n.id) ?? estimateEventSize(n.label)),
    [diagram, sizes],
  );

  const nodes = useMemo<EventNodeType[]>(
    () =>
      diagram.nodes
        .filter((n) => layout.events.has(n.id))
        .map((n) => {
          const p = layout.events.get(n.id)!;
          return {
            id: n.id,
            type: 'event',
            position: { x: p.x, y: p.y },
            selected: n.id === selectedId,
            draggable: false,
            data: {
              label: n.label,
              caption: caption(n),
              color: n.color ?? DEFAULT_NODE_COLOR,
              box: n.box,
              isPeriod: p.isPeriod,
              width: p.isPeriod ? p.width : undefined,
            },
          };
        }),
    [diagram.nodes, layout, selectedId],
  );

  // Recadrer sur toute la frise (axe et étages compris) quand sa forme change, une fois
  // les boîtes mesurées. (Pas `useNodesInitialized` : un événement n'a pas de point
  // d'accroche, et React Flow ne le déclare jamais « initialisé ».)
  const initialized = nodes.every((n) => sizes.has(n.id));
  const shape = `${diagram.nodes.length}:${lanes.length}:${Math.round(layout.bounds.width)}`;
  useEffect(() => {
    if (!initialized) return;
    const t = requestAnimationFrame(() => fitBounds(layout.bounds, { ...FIT, duration: 200 }));
    return () => cancelAnimationFrame(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- volontairement sur la forme, pas sur chaque frappe
  }, [shape, initialized, fitBounds]);

  useEffect(() => {
    onSelectionChange?.({ nodeIds: selectedId ? [selectedId] : [], edgeIds: [] });
  }, [selectedId, onSelectionChange]);

  useImperativeHandle(exportRef, () => ({
    toPng: (options) => renderDiagramPng(containerRef.current!, getNodes(), options, layout.bounds),
  }));

  // ─── Actions ────────────────────────────────────────────────────────────
  const update = useCallback((updater: (d: Diagram) => Diagram) => onChange(updater(diagram)), [diagram, onChange]);

  const saveEvent = (values: EventValues, id?: string) => {
    if (id) {
      update((d) => ({
        ...d,
        nodes: d.nodes.map((n) => (n.id === id ? { ...n, label: values.label, date: values.date, endDate: values.endDate, laneId: values.laneId } : n)),
      }));
    } else {
      const node: DiagramNode = { id: newId('n'), label: values.label, x: 0, y: 0, color: DEFAULT_NODE_COLOR, date: values.date };
      if (values.endDate) node.endDate = values.endDate;
      if (values.laneId) node.laneId = values.laneId;
      setSelectedId(node.id);
      update((d) => ({ ...d, nodes: [...d.nodes, node] }));
    }
    setEditing(null);
  };

  const removeEvent = useCallback(
    (id: string) => {
      setSelectedId((current) => (current === id ? null : current));
      setEditing(null);
      update((d) => ({ ...d, nodes: d.nodes.filter((n) => n.id !== id) }));
    },
    [update],
  );

  const recolor = useCallback((id: string, color: ColorRef) => update((d) => ({ ...d, nodes: d.nodes.map((n) => (n.id === id ? { ...n, color } : n)) })), [update]);

  const saveLane = (values: LaneValues, id?: string) => {
    if (id) {
      update((d) => ({ ...d, lanes: (d.lanes ?? []).map((l) => (l.id === id ? { ...l, ...values, color: values.color } : l)) }));
    } else {
      const lane: TimelineLane = { id: newId('l'), ...values };
      update((d) => ({ ...d, lanes: [...(d.lanes ?? []), lane] }));
    }
    setEditing(null);
  };

  const removeLane = (id: string) => {
    setEditing(null);
    update((d) => ({
      ...d,
      lanes: (d.lanes ?? []).filter((l) => l.id !== id),
      nodes: d.nodes.map((n) => (n.laneId === id ? { ...n, laneId: undefined } : n)),
    }));
  };

  /** Un tag déposé : s'il porte une date, l'événement est créé ; sinon la popup s'ouvre pré-remplie. */
  const dropTag = useCallback(
    (tag: string, laneId: string | undefined) => {
      const parsed = parseEventText(tag);
      const consume = (d: Diagram) => {
        const list = d.pending ?? [];
        const i = list.indexOf(tag);
        const next = i < 0 ? list : [...list.slice(0, i), ...list.slice(i + 1)];
        return next.length ? next : undefined;
      };
      if (parsed) {
        const node: DiagramNode = { id: newId('n'), label: parsed.label, x: 0, y: 0, color: DEFAULT_NODE_COLOR, date: parsed.date };
        if (parsed.endDate) node.endDate = parsed.endDate;
        if (laneId) node.laneId = laneId;
        setSelectedId(node.id);
        update((d) => ({ ...d, nodes: [...d.nodes, node], pending: consume(d) }));
      } else {
        update((d) => ({ ...d, pending: consume(d) }));
        setEditing({ kind: 'event', prefill: { label: tag.replace(/^.*›\s*/, ''), laneId } });
      }
    },
    [update],
  );

  const actions = useMemo<TimelineActions>(
    () => ({
      edit: (id) => setEditing({ kind: 'event', id }),
      recolor,
      remove: removeEvent,
      dropTag,
      laneOf: (id) => diagram.nodes.find((n) => n.id === id)?.laneId,
      openTools: onOpenTools ?? (() => {}),
      readOnly,
      defaults: diagram.defaults,
    }),
    [recolor, removeEvent, dropTag, diagram.nodes, diagram.defaults, onOpenTools, readOnly],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<EventNodeType>[]) => {
      for (const c of changes) {
        if (c.type === 'select') setSelectedId((current) => (c.selected ? c.id : current === c.id ? null : current));
        else if (c.type === 'dimensions' && c.dimensions) {
          const { width, height } = c.dimensions;
          setSizes((current) => {
            const prev = current.get(c.id);
            if (prev && prev.width === width && prev.height === height) return current;
            const next = new Map(current);
            next.set(c.id, { width, height });
            return next;
          });
        } else if (c.type === 'remove') removeEvent(c.id);
      }
    },
    [removeEvent],
  );

  // Dépôt d'un tag sur un bandeau (ou sur la zone de l'axe).
  const bandDragOver = (laneId: string | null) => (e: DragEvent) => {
    if (!hasTagData(e) || readOnly) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropLane(laneId);
  };
  const bandDrop = (laneId: string | null) => (e: DragEvent) => {
    const tag = readTagData(e);
    setDropLane(undefined);
    if (!tag) return;
    e.preventDefault();
    dropTag(tag, laneId ?? undefined);
  };

  const editingEvent = editing?.kind === 'event' ? diagram.nodes.find((n) => n.id === editing.id) : undefined;
  const editingLane = editing?.kind === 'lane' ? lanes.find((l) => l.id === editing.id) : undefined;
  const { scale, ticks, bands } = layout;
  const width = scale.xOf(scale.maxYears);
  const empty = diagram.nodes.filter((n) => layout.events.has(n.id)).length === 0;

  return (
    <TimelineActionsContext.Provider value={actions}>
      <div ref={containerRef} className={editorStyles.editor}>
        <ReactFlow
          nodes={nodes}
          edges={[]}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={!readOnly}
          minZoom={0.1}
          maxZoom={2.5}
          panOnScroll
          zoomOnScroll={false}
          zoomOnPinch
          zoomOnDoubleClick={false}
          deleteKeyCode={['Delete', 'Backspace']}
          proOptions={{ hideAttribution: true }}
        >
          {grid && <Background variant={BackgroundVariant.Lines} gap={24} color="var(--c-grid)" />}
          <ViewportPortal>
            {bands.map((b) => (
              <div
                key={b.lane?.id ?? 'axis'}
                className={styles.band}
                data-axis={!b.lane || undefined}
                data-dropping={dropLane === (b.lane?.id ?? null) || undefined}
                style={{
                  left: 0,
                  top: b.top,
                  width,
                  height: b.height,
                  background: b.lane ? `color-mix(in srgb, ${resolveFill(b.lane.color ?? 'white')} 55%, transparent)` : undefined,
                }}
                onDragOver={bandDragOver(b.lane?.id ?? null)}
                onDragLeave={() => setDropLane(undefined)}
                onDrop={bandDrop(b.lane?.id ?? null)}
              >
                {b.lane && (
                  <button
                    type="button"
                    className={styles.laneLabel}
                    onClick={() => !readOnly && setEditing({ kind: 'lane', id: b.lane!.id })}
                    title={readOnly ? undefined : 'Modifier l’étage'}
                  >
                    {b.lane.label}
                  </button>
                )}
              </div>
            ))}
            <div className={styles.axis} style={{ left: 0, top: -1, width }} onDragOver={bandDragOver(null)} onDrop={bandDrop(null)} />
            {ticks.map((t) => (
              <div key={t.years} className={styles.tick} data-major={t.major || undefined} style={{ left: t.x, top: 0, height: t.major ? 12 : 7 }}>
                {t.major && (
                  <span className={styles.tickLabel} style={{ top: AXIS_HEIGHT - 24 }}>
                    {formatTick(t.years, t.step)}
                  </span>
                )}
              </div>
            ))}
            {empty && !readOnly && (
              <p className={styles.emptyHint} style={{ left: width / 2, top: -90 }}>
                Ajoute un premier événement, puis des étages (Politique, Économie…).
              </p>
            )}
          </ViewportPortal>
          {!readOnly && (
            <DiagramToolbar
              onAdd={() => setEditing({ kind: 'event' })}
              addLabel="Ajouter un événement"
              onDelete={() => selectedId && removeEvent(selectedId)}
              canDelete={!!selectedId}
              extra={
                <button type="button" className={toolbarStyles.button} onClick={() => setEditing({ kind: 'lane' })}>
                  ＋ Étage
                </button>
              }
            />
          )}
        </ReactFlow>
      </div>

      <EventModal
        open={editing?.kind === 'event'}
        isNew={!editingEvent}
        lanes={lanes}
        initial={
          editingEvent
            ? { label: editingEvent.label, date: editingEvent.date ?? '', endDate: editingEvent.endDate, laneId: editingEvent.laneId }
            : { label: editing?.kind === 'event' ? editing.prefill?.label ?? '' : '', date: '', laneId: editing?.kind === 'event' ? editing.prefill?.laneId : undefined }
        }
        onClose={() => setEditing(null)}
        onSave={(values) => saveEvent(values, editingEvent?.id)}
        onDelete={editingEvent ? () => removeEvent(editingEvent.id) : undefined}
      />
      <LaneModal
        open={editing?.kind === 'lane'}
        isNew={!editingLane}
        initial={editingLane ? { label: editingLane.label, side: editingLane.side, color: editingLane.color } : { label: '', side: lanes.length % 2 === 0 ? 'above' : 'below' }}
        onClose={() => setEditing(null)}
        onSave={(values) => saveLane(values, editingLane?.id)}
        onDelete={editingLane ? () => removeLane(editingLane.id) : undefined}
      />
    </TimelineActionsContext.Provider>
  );
}

export function TimelineEditor(props: Props) {
  return (
    <ReactFlowProvider>
      <Editor {...props} />
    </ReactFlowProvider>
  );
}
