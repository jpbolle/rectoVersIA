/**
 * Conversion entre notre format `Diagram` et les objets de React Flow.
 * Tout ce qui entre dans l'éditeur ou en sort passe par ici : en base et dans le
 * Markdown, on ne manipule jamais les objets React Flow.
 */
import { MarkerType, type Edge, type Node } from '@xyflow/react';
import {
  DEFAULT_NODE_COLOR,
  type BoxStyle,
  type ColorRef,
  type Diagram,
  type DiagramEdge,
  type DiagramNode,
  type LineStyle,
} from '@/types/diagram';

export type ConceptNodeData = { label: string; color: ColorRef; box?: BoxStyle };
export type ConceptNodeType = Node<ConceptNodeData, 'concept'>;

export type LabeledEdgeData = { label: string; line?: LineStyle };
export type LabeledEdgeType = Edge<LabeledEdgeData, 'labeled'>;

export const EDGE_MARKER = { type: MarkerType.ArrowClosed, width: 18, height: 18 } as const;

export function toFlowNodes(diagram: Diagram): ConceptNodeType[] {
  return diagram.nodes.map((n) => ({
    id: n.id,
    type: 'concept',
    position: { x: n.x, y: n.y },
    data: { label: n.label, color: n.color ?? DEFAULT_NODE_COLOR, box: n.box },
  }));
}

export function toFlowEdges(diagram: Diagram): LabeledEdgeType[] {
  return diagram.edges.map((e) => ({
    id: e.id,
    type: 'labeled',
    source: e.source,
    target: e.target,
    data: { label: e.label ?? '', line: e.line },
    markerEnd: EDGE_MARKER,
  }));
}

/** Reconstruit un `Diagram` à partir de l'état courant de l'éditeur. */
export function fromFlow(
  base: Diagram,
  nodes: ConceptNodeType[],
  edges: LabeledEdgeType[],
): Diagram {
  const diagramNodes: DiagramNode[] = nodes.map((n) => ({
    id: n.id,
    label: n.data.label,
    x: Math.round(n.position.x),
    y: Math.round(n.position.y),
    color: n.data.color,
    box: n.data.box,
  }));
  const diagramEdges: DiagramEdge[] = edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.data?.label || undefined,
    line: e.data?.line,
  }));
  return { ...base, nodes: diagramNodes, edges: diagramEdges };
}
