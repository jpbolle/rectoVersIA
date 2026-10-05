'use client';

/**
 * L'éditeur des schémas en arbre (carte mentale, schéma hiérarchisé).
 * Contrairement à la carte conceptuelle, le `Diagram` reçu est LA source de vérité :
 * les boîtes et branches affichées en sont dérivées (disposition automatique), et
 * chaque action (renommer, ajouter, supprimer, colorer, déposer un tag) produit un
 * nouveau `Diagram` passé à `onChange`.
 */
import '@xyflow/react/dist/style.css';
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
  type Edge,
  type NodeChange,
} from '@xyflow/react';
import {
  DEFAULT_NODE_COLOR,
  dashArray,
  effectiveLine,
  newId,
  resolveStroke,
  type ColorRef,
  type Diagram,
} from '@/types/diagram';
import { insertAfter, insertAsLastChild, numberMap, rootOf, subtreeIds } from '@/lib/diagram/tree';
import { estimateSize, layoutTree, type Size } from '@/lib/diagram/tree-layout';
import { renderDiagramPng } from '@/lib/diagram/diagram-export';
import { labelForDroppedTag } from '@/lib/diagram/tag-drop';
import { TreeActionsContext, TreeNode, type TreeActions, type TreeNodeType } from './TreeNode';
import { DiagramToolbar } from './DiagramToolbar';
import type { EditorCommonProps } from './editor-types';
import styles from './ConceptMapEditor.module.css';

interface Props extends EditorCommonProps {
  diagram: Diagram;
  onChange: (diagram: Diagram) => void;
}

const nodeTypes = { idea: TreeNode };
const FIT_OPTIONS = { padding: 0.25, maxZoom: 1 };

function Editor({ diagram, onChange, grid, readOnly = false, onSelectionChange, exportRef, onOpenTools }: Props) {
  const { fitView, getNodes } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Tailles réelles mesurées par React Flow ; estimation avant la première mesure.
  const [sizes, setSizes] = useState<Map<string, Size>>(() => new Map());
  // Idée qui vient d'être créée : s'ouvre en saisie une seule fois.
  const [freshId, setFreshId] = useState<string | null>(null);

  const isHierarchy = diagram.type === 'hierarchy';
  const numbers = useMemo(() => (isHierarchy ? numberMap(diagram.nodes) : null), [isHierarchy, diagram.nodes]);
  const root = rootOf(diagram.nodes);

  const nodes = useMemo<TreeNodeType[]>(() => {
    const placements = layoutTree(diagram, (n) => sizes.get(n.id) ?? estimateSize(n.label));
    return diagram.nodes.map((n) => {
      const p = placements.get(n.id);
      return {
        id: n.id,
        type: 'idea',
        position: { x: p?.x ?? 0, y: p?.y ?? 0 },
        // Les boîtes sont recréées à chaque rendu : sans leur mesure, React Flow les
        // repasse en invisible (et la saisie en cours perd le focus).
        measured: sizes.get(n.id),
        selected: n.id === selectedId,
        draggable: false,
        data: {
          label: n.label,
          color: n.color ?? DEFAULT_NODE_COLOR,
          box: n.box,
          side: p?.side ?? 'down',
          number: numbers?.get(n.id) ?? '',
          isRoot: !n.parentId,
          autoEdit: n.id === freshId,
        },
      };
    });
  }, [diagram, sizes, selectedId, numbers, freshId]);

  const edges = useMemo<Edge[]>(
    () =>
      diagram.nodes
        .filter((n) => n.parentId)
        .map((n) => {
          const side = nodes.find((f) => f.id === n.id)?.data.side ?? 'down';
          const parentIsRoot = n.parentId === root?.id;
          const line = effectiveLine(n.branch, diagram);
          return {
            id: `t_${n.id}`,
            source: n.parentId!,
            target: n.id,
            sourceHandle: parentIsRoot ? side : 'out',
            targetHandle: 'in',
            type: isHierarchy ? 'smoothstep' : 'default',
            style: { stroke: resolveStroke(line.color), strokeWidth: line.width, strokeDasharray: dashArray(line.dash, line.width) },
            selectable: false,
            focusable: false,
          };
        }),
    [diagram, nodes, root, isHierarchy],
  );

  // Recadrer quand le nombre d'idées ou le type change (pas à chaque frappe), et
  // seulement une fois les boîtes mesurées : avant, la disposition n'est qu'estimée.
  const initialized = useNodesInitialized();
  const shape = `${diagram.type}:${diagram.nodes.length}`;
  useEffect(() => {
    if (!initialized) return;
    const t = requestAnimationFrame(() => fitView({ ...FIT_OPTIONS, duration: 200 }));
    return () => cancelAnimationFrame(t);
  }, [shape, initialized, fitView]);

  useEffect(() => {
    onSelectionChange?.({ nodeIds: selectedId ? [selectedId] : [], edgeIds: [] });
  }, [selectedId, onSelectionChange]);

  useImperativeHandle(exportRef, () => ({
    toPng: (options) => renderDiagramPng(containerRef.current!, getNodes(), options),
  }));

  // ─── Actions ────────────────────────────────────────────────────────────

  const update = useCallback(
    (updater: (d: Diagram) => Diagram) => onChange(updater(diagram)),
    [diagram, onChange],
  );

  const rename = useCallback(
    (id: string, label: string) => {
      setFreshId((current) => (current === id ? null : current));
      update((d) => ({
        ...d,
        // Le titre du schéma suit le sujet central.
        title: d.nodes.find((n) => n.id === id)?.parentId ? d.title : label,
        nodes: d.nodes.map((n) => (n.id === id ? { ...n, label } : n)),
      }));
    },
    [update],
  );

  const recolor = useCallback(
    (id: string, color: ColorRef) => update((d) => ({ ...d, nodes: d.nodes.map((n) => (n.id === id ? { ...n, color } : n)) })),
    [update],
  );

  const addChild = useCallback(
    (parentId: string, label = '', consumeTag?: string) => {
      const parent = diagram.nodes.find((n) => n.id === parentId);
      if (!parent) return;
      const node = { id: newId('n'), label, x: 0, y: 0, color: parent.color ?? DEFAULT_NODE_COLOR, parentId };
      if (!label) setFreshId(node.id);
      setSelectedId(node.id);
      update((d) => ({
        ...d,
        nodes: insertAsLastChild(d.nodes, node),
        pending: consumeTag ? removeOnce(d.pending, consumeTag) : d.pending,
      }));
    },
    [diagram.nodes, update],
  );

  const addSibling = useCallback(
    (id: string) => {
      const ref = diagram.nodes.find((n) => n.id === id);
      if (!ref || !ref.parentId) return; // la racine n'a pas de sœur
      const node = { id: newId('n'), label: '', x: 0, y: 0, color: ref.color ?? DEFAULT_NODE_COLOR, parentId: ref.parentId };
      setFreshId(node.id);
      setSelectedId(node.id);
      // Après le dernier descendant de la référence, pour rester groupé.
      const ids = subtreeIds(diagram.nodes, id);
      let last = id;
      for (const n of diagram.nodes) if (ids.has(n.id)) last = n.id;
      update((d) => ({ ...d, nodes: insertAfter(d.nodes, node, last) }));
    },
    [diagram.nodes, update],
  );

  const remove = useCallback(
    (id: string) => {
      const target = diagram.nodes.find((n) => n.id === id);
      if (!target || !target.parentId) return; // jamais la racine
      const ids = subtreeIds(diagram.nodes, id);
      setSelectedId(target.parentId);
      update((d) => ({ ...d, nodes: d.nodes.filter((n) => !ids.has(n.id)) }));
    },
    [diagram.nodes, update],
  );

  const dropTag = useCallback(
    (id: string, tag: string) => {
      const target = diagram.nodes.find((n) => n.id === id);
      if (!target) return;
      addChild(id, labelForDroppedTag(tag, target.label), tag);
    },
    [diagram.nodes, addChild],
  );

  const actions = useMemo<TreeActions>(
    () => ({ rename, recolor, addChild, remove, dropTag, openTools: onOpenTools ?? (() => {}), readOnly, defaults: diagram.defaults }),
    [rename, recolor, addChild, remove, dropTag, onOpenTools, readOnly, diagram.defaults],
  );

  // Les changements venant de React Flow : sélection, mesures, suppression clavier.
  const onNodesChange = useCallback(
    (changes: NodeChange<TreeNodeType>[]) => {
      for (const c of changes) {
        if (c.type === 'select') {
          setSelectedId((current) => (c.selected ? c.id : current === c.id ? null : current));
        } else if (c.type === 'dimensions' && c.dimensions) {
          const { width, height } = c.dimensions;
          setSizes((current) => {
            const prev = current.get(c.id);
            if (prev && prev.width === width && prev.height === height) return current;
            const next = new Map(current);
            next.set(c.id, { width, height });
            return next;
          });
        } else if (c.type === 'remove') {
          remove(c.id);
        }
      }
    },
    [remove],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (readOnly || !selectedId) return;
    const target = e.target as HTMLElement;
    const typing = target.tagName === 'TEXTAREA' || target.tagName === 'INPUT';
    if (e.key === 'Tab') {
      e.preventDefault();
      addChild(selectedId);
    } else if (e.key === 'Enter' && !typing) {
      e.preventDefault();
      addSibling(selectedId);
    }
  };

  const addFromToolbar = () => addChild(selectedId ?? root?.id ?? '');
  const canDelete = !!selectedId && selectedId !== root?.id;

  return (
    <TreeActionsContext.Provider value={actions}>
      <div ref={containerRef} className={styles.editor} onKeyDown={onKeyDown}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={!readOnly}
          fitView
          fitViewOptions={FIT_OPTIONS}
          minZoom={0.2}
          maxZoom={2.5}
          panOnScroll
          zoomOnScroll={false}
          zoomOnPinch
          zoomOnDoubleClick={false}
          deleteKeyCode={['Delete', 'Backspace']}
          proOptions={{ hideAttribution: true }}
        >
          {grid && <Background variant={BackgroundVariant.Lines} gap={24} color="var(--c-grid)" />}
          {!readOnly && (
            <DiagramToolbar
              onAdd={addFromToolbar}
              onDelete={() => selectedId && remove(selectedId)}
              canDelete={canDelete}
              addLabel="Ajouter une idée"
            />
          )}
        </ReactFlow>
      </div>
    </TreeActionsContext.Provider>
  );
}

function removeOnce(list: string[] | undefined, value: string): string[] | undefined {
  if (!list) return list;
  const i = list.indexOf(value);
  if (i < 0) return list;
  const next = [...list.slice(0, i), ...list.slice(i + 1)];
  return next.length ? next : undefined;
}

export function TreeEditor(props: Props) {
  return (
    <ReactFlowProvider>
      <Editor {...props} />
    </ReactFlowProvider>
  );
}
