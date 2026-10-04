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
import { DEFAULT_NODE_COLOR, newId, type Diagram } from '@/types/diagram';
import {
  EDGE_MARKER,
  fromFlow,
  toFlowEdges,
  toFlowNodes,
  type ConceptNodeType,
  type LabeledEdgeType,
} from '@/lib/diagram-convert';
import { renderDiagramPng } from '@/lib/diagram-export';
import { labelForDroppedTag } from '@/lib/tag-drop';
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
}

// Définis hors du composant : React Flow exige des références stables.
const nodeTypes = { concept: ConceptNode };
const edgeTypes = { labeled: LabeledEdge };
// Ajustement de la vue : on ne grossit jamais au-delà de 1, sinon trois boîtes
// remplissent l'écran et passent sous la barre d'outils.
const FIT_OPTIONS = { padding: 0.25, maxZoom: 1 };

function Editor({ diagram, revision, onChange, grid, readOnly = false, onSelectionChange, exportRef, onConsumeTag, onOpenTools }: Props) {
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
          { ...connection, id: newId('e'), type: 'labeled', data: { label: '' }, markerEnd: EDGE_MARKER },
          current,
        ),
      );
    },
    [setEdges],
  );

  const addConcept = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    const center = rect
      ? screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
      : { x: 0, y: 0 };
    // Léger décalage aléatoire : deux ajouts de suite ne se superposent pas exactement.
    const jitter = () => Math.round((Math.random() - 0.5) * 60);
    const node: ConceptNodeType = {
      id: newId('n'),
      type: 'concept',
      position: { x: center.x - 60 + jitter(), y: center.y - 20 + jitter() },
      data: { label: '', color: DEFAULT_NODE_COLOR },
      selected: true,
    };
    setNodes((current) => [...current.map((n) => ({ ...n, selected: false })), node]);
  }, [screenToFlowPosition, setNodes]);

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
    () => ({ defaults: diagram.defaults, dropTag, openTools: onOpenTools ?? (() => {}) }),
    [diagram.defaults, dropTag, onOpenTools],
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
          {!readOnly && <DiagramToolbar onAdd={addConcept} onDelete={deleteSelection} canDelete={hasSelection} />}
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
