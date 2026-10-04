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
  type EdgeArrow,
  type EdgePath,
  type LineStyle,
  type ShapeKind,
} from '@/types/diagram';

export type ConceptNodeData = { label: string; color: ColorRef; box?: BoxStyle; shape?: ShapeKind };
export type ConceptNodeType = Node<ConceptNodeData, 'concept'>;

export type LabeledEdgeData = { label: string; line?: LineStyle; path?: EdgePath; arrow?: EdgeArrow };
export type LabeledEdgeType = Edge<LabeledEdgeData, 'labeled'>;

export const EDGE_MARKER = { type: MarkerType.ArrowClosed, width: 18, height: 18 } as const;

/** Les pointes d'une flèche selon son sens (schéma libre ; ailleurs : toujours à l'arrivée). */
export function edgeMarkers(arrow: EdgeArrow | undefined): Pick<Edge, 'markerStart' | 'markerEnd'> {
  if (arrow === 'none') return { markerStart: undefined, markerEnd: undefined };
  if (arrow === 'both') return { markerStart: EDGE_MARKER, markerEnd: EDGE_MARKER };
  return { markerStart: undefined, markerEnd: EDGE_MARKER };
}

export function toFlowNodes(diagram: Diagram): ConceptNodeType[] {
  return diagram.nodes.map((n) => ({
    id: n.id,
    type: 'concept',
    position: { x: n.x, y: n.y },
    data: { label: n.label, color: n.color ?? DEFAULT_NODE_COLOR, box: n.box, shape: n.shape },
    // Taille fixée par l'élève (schéma libre) : React Flow la pose en style
    ...(n.width && n.height ? { width: n.width, height: n.height } : {}),
  }));
}

export function toFlowEdges(diagram: Diagram): LabeledEdgeType[] {
  return diagram.edges.map((e) => ({
    id: e.id,
    type: 'labeled',
    source: e.source,
    target: e.target,
    data: { label: e.label ?? '', line: e.line, path: e.path, arrow: e.arrow },
    ...edgeMarkers(e.arrow),
  }));
}

/** Reconstruit un `Diagram` à partir de l'état courant de l'éditeur. */
export function fromFlow(
  base: Diagram,
  nodes: ConceptNodeType[],
  edges: LabeledEdgeType[],
): Diagram {
  const diagramNodes: DiagramNode[] = nodes.map((n) => {
    const node: DiagramNode = {
      id: n.id,
      label: n.data.label,
      x: Math.round(n.position.x),
      y: Math.round(n.position.y),
      color: n.data.color,
      box: n.data.box,
    };
    if (n.data.shape) node.shape = n.data.shape;
    if (n.width && n.height) {
      node.width = Math.round(n.width);
      node.height = Math.round(n.height);
    }
    return node;
  });
  const diagramEdges: DiagramEdge[] = edges.map((e) => {
    const edge: DiagramEdge = {
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.data?.label || undefined,
      line: e.data?.line,
    };
    if (e.data?.path) edge.path = e.data.path;
    if (e.data?.arrow) edge.arrow = e.data.arrow;
    return edge;
  });
  return { ...base, nodes: diagramNodes, edges: diagramEdges };
}
