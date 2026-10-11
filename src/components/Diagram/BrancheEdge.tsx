'use client';

/**
 * La branche d'un arbre (carte mentale : courbe ; hiérarchie : coudée), avec,
 * en correction, sa pastille PILE AU MILIEU du trait (JP, 2026-10-11) — la
 * pastille du rattachement d'une idée à son parent. Hors correction, c'est
 * exactement l'arête par défaut de React Flow.
 */
import { useContext } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, getSmoothStepPath, type Edge, type EdgeProps } from '@xyflow/react';
import { MarquesContext, Pastille } from './Pastilles';

export type BrancheEdgeType = Edge<{ coude?: boolean }, 'branche'>;

export function BrancheEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, data }: EdgeProps<BrancheEdgeType>) {
  const marques = useContext(MarquesContext);
  const params = { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition };
  const [path, milieuX, milieuY] = data?.coude ? getSmoothStepPath(params) : getBezierPath(params);
  return (
    <>
      <BaseEdge id={id} path={path} style={style} />
      {marques && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan"
            style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${milieuX}px, ${milieuY}px)`, pointerEvents: 'all' }}
          >
            <Pastille genre="liens" id={id} place="centre" />
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
