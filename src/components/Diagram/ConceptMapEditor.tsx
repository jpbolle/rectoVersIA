'use client';

/**
 * L'éditeur de carte conceptuelle. Reçoit un `Diagram` (notre format), appelle
 * `onChange` avec un `Diagram` à chaque modification. `revision` sert à recharger
 * l'éditeur depuis l'extérieur (import Markdown, transformation, changement de style) :
 * quand il change, l'état interne est reconstruit depuis `diagram` — en gardant la
 * sélection, et sans recadrer si les boîtes sont les mêmes.
 */
import '@xyflow/react/dist/style.css';
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
} from '@xyflow/react';
import { DEFAULT_NODE_COLOR, SHAPE_KINDS, newId, type Diagram, type ShapeKind } from '@/types/diagram';
import {
  EDGE_MARKER,
  edgeMarkers,
  fromFlow,
  toFlowEdges,
  toFlowNodes,
  type ConceptNodeType,
  type LabeledEdgeType,
} from '@/lib/diagram/diagram-convert';
import { renderDiagramPng } from '@/lib/diagram/diagram-export';
import { labelForDroppedTag } from '@/lib/diagram/tag-drop';
import { ConceptContextValue, ConceptNode, type ConceptContext } from './ConceptNode';
import { LabeledEdge } from './LabeledEdge';
import { DiagramToolbar } from './DiagramToolbar';
import type { EditorCommonProps } from './editor-types';
import styles from './ConceptMapEditor.module.css';

interface Props extends EditorCommonProps {
  diagram: Diagram;
  revision: number;
  onChange: (diagram: Diagram) => void;
  /** Un tag « à placer » a été déposé sur une boîte : la page le retire de la liste. */
  onConsumeTag?: (tag: string) => void;
  /** Schéma LIBRE : formes, tailles, tracés et sens des flèches (sinon : carte conceptuelle). */
  free?: boolean;
}

/** Taille de départ d'une forme ajoutée dans le schéma libre. */
const SHAPE_SIZE: Record<ShapeKind, { width: number; height: number }> = {
  rounded: { width: 160, height: 70 },
  rect: { width: 160, height: 70 },
  ellipse: { width: 170, height: 90 },
  diamond: { width: 170, height: 110 },
  note: { width: 170, height: 110 },
  text: { width: 150, height: 44 },
};

// Définis hors du composant : React Flow exige des références stables.
const nodeTypes = { concept: ConceptNode };
const edgeTypes = { labeled: LabeledEdge };
// Ajustement de la vue : on ne grossit jamais au-delà de 1, sinon trois boîtes
// remplissent l'écran et passent sous la barre d'outils.
const FIT_OPTIONS = { padding: 0.25, maxZoom: 1 };

function Editor({ diagram, revision, onChange, grid, readOnly = false, onSelectionChange, exportRef, onConsumeTag, onOpenTools, free = false }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<ConceptNodeType>(toFlowNodes(diagram));
  const [edges, setEdges, onEdgesChange] = useEdgesState<LabeledEdgeType>(toFlowEdges(diagram));
  const { screenToFlowPosition, deleteElements, fitView, getNodes } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);

  // Rechargement depuis l'extérieur (import Markdown, transformation, style).
  const lastRevision = useRef(revision);
  useEffect(() => {
    if (lastRevision.current === revision) return;
    lastRevision.current = revision;
    setNodes((current) => {
      const selected = new Set(current.filter((n) => n.selected).map((n) => n.id));
      const sameShape = current.length === diagram.nodes.length && current.every((n, i) => n.id === diagram.nodes[i]?.id);
      if (!sameShape) requestAnimationFrame(() => fitView(FIT_OPTIONS));
      return toFlowNodes(diagram).map((n) => ({ ...n, selected: selected.has(n.id) }));
    });
    setEdges((current) => {
      const selected = new Set(current.filter((e) => e.selected).map((e) => e.id));
      return toFlowEdges(diagram).map((e) => ({ ...e, selected: selected.has(e.id) }));
    });
  }, [revision, diagram, setNodes, setEdges, fitView]);

  // Remonte chaque modification dans notre format. `onChange` et `diagram` passent par
  // des refs (mises à jour dans un effet, jamais pendant le rendu) pour que l'effet de
  // propagation ne se relance que sur un vrai changement de nœuds ou de liens —
  // sinon : onChange → nouveau diagram → effet → onChange… en boucle.
  const onChangeRef = useRef(onChange);
  const baseRef = useRef(diagram);
  useEffect(() => {
    onChangeRef.current = onChange;
    baseRef.current = diagram;
  }, [onChange, diagram]);
  useEffect(() => {
    onChangeRef.current(fromFlow(baseRef.current, nodes, edges));
  }, [nodes, edges]);

  // Sélection courante, remontée à la page (onglet Outils).
  const selectionKey = `${nodes.filter((n) => n.selected).map((n) => n.id).join(',')}|${edges.filter((e) => e.selected).map((e) => e.id).join(',')}`;
  useEffect(() => {
    const [n, e] = selectionKey.split('|');
    onSelectionChange?.({ nodeIds: n ? n.split(',') : [], edgeIds: e ? e.split(',') : [] });
  }, [selectionKey, onSelectionChange]);

  useImperativeHandle(exportRef, () => ({
    toPng: (options) => renderDiagramPng(containerRef.current!, getNodes(), options),
  }));

  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source === connection.target) return; // pas de lien sur soi-même
      setEdges((current) =>
        addEdge<LabeledEdgeType>(
          { ...connection, id: newId('e'), type: 'labeled', data: { label: '' }, ...edgeMarkers(undefined) },
          current,
        ),
      );
    },
    [setEdges],
  );

  const addConcept = useCallback(
    (shape?: ShapeKind) => {
      const rect = containerRef.current?.getBoundingClientRect();
      const center = rect
        ? screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
        : { x: 0, y: 0 };
      // Léger décalage aléatoire : deux ajouts de suite ne se superposent pas exactement.
      const jitter = () => Math.round((Math.random() - 0.5) * 60);
      const size = shape ? SHAPE_SIZE[shape] : undefined;
      const node: ConceptNodeType = {
        id: newId('n'),
        type: 'concept',
        position: { x: center.x - (size?.width ?? 120) / 2 + jitter(), y: center.y - (size?.height ?? 40) / 2 + jitter() },
        data: { label: '', color: shape === 'text' ? 'white' : DEFAULT_NODE_COLOR, ...(shape ? { shape } : {}) },
        ...(size ?? {}),
        selected: true,
      };
      setNodes((current) => [...current.map((n) => ({ ...n, selected: false })), node]);
    },
    [screenToFlowPosition, setNodes],
  );

  /** Un tag déposé sur une boîte devient un concept relié, placé à sa droite. */
  const dropTag = useCallback(
    (targetId: string, tag: string) => {
      const target = nodes.find((n) => n.id === targetId);
      if (!target) return;
      const node: ConceptNodeType = {
        id: newId('n'),
        type: 'concept',
        position: { x: target.position.x + (target.measured?.width ?? 160) + 80, y: target.position.y + 40 },
        data: { label: labelForDroppedTag(tag, target.data.label), color: target.data.color },
        selected: true,
      };
      setNodes((current) => [...current.map((n) => ({ ...n, selected: false })), node]);
      setEdges((current) => [
        ...current,
        { id: newId('e'), type: 'labeled', source: targetId, target: node.id, sourceHandle: 'right', targetHandle: 'left', data: { label: '' }, markerEnd: EDGE_MARKER },
      ]);
      onConsumeTag?.(tag);
    },
    [nodes, setNodes, setEdges, onConsumeTag],
  );

  const context = useMemo<ConceptContext>(
    () => ({ defaults: diagram.defaults, dropTag, openTools: onOpenTools ?? (() => {}), free }),
    [diagram.defaults, dropTag, onOpenTools, free],
  );

  const deleteSelection = useCallback(() => {
    deleteElements({
      nodes: nodes.filter((n) => n.selected),
      edges: edges.filter((e) => e.selected),
    });
  }, [deleteElements, nodes, edges]);

  const hasSelection = nodes.some((n) => n.selected) || edges.some((e) => e.selected);

  return (
    <ConceptContextValue.Provider value={context}>
      <div ref={containerRef} className={styles.editor}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          connectionMode={ConnectionMode.Loose}
          fitView
          fitViewOptions={FIT_OPTIONS}
          minZoom={0.2}
          maxZoom={2.5}
          // Pavé tactile : deux doigts = déplacer la vue, pincer = zoomer.
          panOnScroll
          zoomOnScroll={false}
          zoomOnPinch
          zoomOnDoubleClick={false}
          deleteKeyCode={['Delete', 'Backspace']}
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          elementsSelectable={!readOnly}
          edgesFocusable={!readOnly}
          proOptions={{ hideAttribution: true }}
        >
          {grid && <Background variant={BackgroundVariant.Lines} gap={24} color="var(--c-grid)" />}
          {!readOnly && (
            <DiagramToolbar
              onAdd={() => addConcept(free ? 'rounded' : undefined)}
              addLabel={free ? 'Ajouter une boîte' : undefined}
              onDelete={deleteSelection}
              canDelete={hasSelection}
              extra={
                free ? (
                  <span className={styles.shapes} role="group" aria-label="Formes">
                    {SHAPE_KINDS.filter((s) => s.kind !== 'rounded').map((s) => (
                      <button key={s.kind} type="button" className={styles.shapeButton} onClick={() => addConcept(s.kind)} title={s.label}>
                        {s.glyph}
                      </button>
                    ))}
                  </span>
                ) : undefined
              }
            />
          )}
        </ReactFlow>
      </div>
    </ConceptContextValue.Provider>
  );
}

export function ConceptMapEditor(props: Props) {
  return (
    <ReactFlowProvider>
      <Editor {...props} />
    </ReactFlowProvider>
  );
}
