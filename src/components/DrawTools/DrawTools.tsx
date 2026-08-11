'use client';

// Atelier de tracé sur image : toolbar (6 outils) + overlay SVG interactif.
// Porté du module drawing-tools de romantismesam (sans flip ni dépendance motion).
// Coordonnées en % (0-100) → les tracés restent alignés quelle que soit la
// taille d'affichage, chez l'élève comme chez le prof.

import { useEffect, useRef, useState } from 'react';
import type { DrawTool, DrawPoint, DrawShape } from '@/types/draw';
import { newShapeId, colorForKind } from '@/types/draw';
import styles from './DrawTools.module.css';

const TOOLS: { id: DrawTool; label: string; icon: string }[] = [
  { id: 'select', label: 'Sélectionner / déplacer / supprimer (Suppr)', icon: '➤' },
  { id: 'line', label: 'Ligne droite (2 clics)', icon: '╱' },
  { id: 'pencil', label: 'Crayon (tracé libre)', icon: '✎' },
  { id: 'cross', label: 'Axes perpendiculaires (clic pour poser)', icon: '✚' },
  { id: 'rect', label: 'Rectangle / encadrer (clic + tirer)', icon: '▭' },
  { id: 'ellipse', label: 'Cercle / ellipse (clic + tirer)', icon: '◯' },
];

export function DrawToolbar({
  tool,
  setTool,
  hasSelection,
  direction = 'vertical',
}: {
  tool: DrawTool;
  setTool: (t: DrawTool) => void;
  hasSelection: boolean;
  // 'horizontal' : barre en ligne (panneaux étroits comme l'onglet Ressources)
  direction?: 'vertical' | 'horizontal';
}) {
  return (
    <div className={`${styles.toolbar} ${direction === 'horizontal' ? styles.toolbarHorizontal : ''}`}>
      {TOOLS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => setTool(t.id)}
          title={t.label}
          aria-label={t.label}
          aria-pressed={tool === t.id}
          className={`${styles.toolBtn} ${tool === t.id ? styles.toolBtnActive : ''}`}
        >
          {t.icon}
        </button>
      ))}
      {hasSelection && <p className={styles.deleteHint}>Suppr pour effacer</p>}
    </div>
  );
}

// Image + overlay. readOnly : affichage seul (vue prof, travail remis).
export function DrawCanvas({
  imageUrl,
  alt,
  shapes,
  onShapesChange,
  tool,
  selectedShapeId,
  setSelectedShapeId,
  readOnly = false,
}: {
  imageUrl: string;
  alt?: string;
  shapes: DrawShape[];
  onShapesChange?: (updater: (prev: DrawShape[]) => DrawShape[]) => void;
  tool: DrawTool;
  selectedShapeId: string | null;
  setSelectedShapeId: (id: string | null) => void;
  readOnly?: boolean;
}) {
  const enabled = !readOnly && !!onShapesChange;
  return (
    <div className={styles.canvasWrap}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt={alt ?? ''} className={styles.canvasImg} draggable={false} />
      <DrawOverlay
        enabled={enabled}
        shapes={shapes}
        onShapesChange={onShapesChange ?? (() => {})}
        tool={tool}
        selectedShapeId={selectedShapeId}
        setSelectedShapeId={setSelectedShapeId}
      />
    </div>
  );
}

type CrossEndpoint = 'left' | 'right' | 'top' | 'bottom' | 'center';
type RectEndpoint = 'tl' | 'tr' | 'bl' | 'br' | 'center';
type DragState =
  | { kind: 'line'; shapeId: string; endpoint: 'a' | 'b' }
  | { kind: 'cross'; shapeId: string; endpoint: CrossEndpoint }
  | { kind: 'rect'; shapeId: string; endpoint: RectEndpoint }
  | { kind: 'ellipse'; shapeId: string; endpoint: RectEndpoint };

function DrawOverlay({
  enabled,
  shapes,
  onShapesChange,
  tool,
  selectedShapeId,
  setSelectedShapeId,
}: {
  enabled: boolean;
  shapes: DrawShape[];
  onShapesChange: (updater: (prev: DrawShape[]) => DrawShape[]) => void;
  tool: DrawTool;
  selectedShapeId: string | null;
  setSelectedShapeId: (id: string | null) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [pendingA, setPendingA] = useState<DrawPoint | null>(null);
  const [drawingId, setDrawingId] = useState<string | null>(null);
  const [drawingRectAnchor, setDrawingRectAnchor] = useState<DrawPoint | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  useEffect(() => {
    setPendingA(null);
  }, [tool]);

  // Clavier : Suppr efface la forme sélectionnée, Échap déselectionne
  useEffect(() => {
    if (!enabled) return;
    function onKey(e: KeyboardEvent) {
      const tgt = document.activeElement;
      if (tgt && (tgt.tagName === 'TEXTAREA' || tgt.tagName === 'INPUT' || (tgt as HTMLElement).isContentEditable)) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedShapeId) {
        e.preventDefault();
        onShapesChange((prev) => prev.filter((s) => s.id !== selectedShapeId));
        setSelectedShapeId(null);
      } else if (e.key === 'Escape') {
        setSelectedShapeId(null);
        setPendingA(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, selectedShapeId, onShapesChange, setSelectedShapeId]);

  function pointFromEvent(e: { clientX: number; clientY: number }): DrawPoint {
    const svg = svgRef.current;
    if (!svg) return { x: 50, y: 50 };
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  }

  function onSvgPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (!enabled || drag) return;
    if (tool === 'select') {
      setSelectedShapeId(null);
      return;
    }
    setSelectedShapeId(null);
    const p = pointFromEvent(e);

    if (tool === 'line') {
      if (!pendingA) setPendingA(p);
      else {
        const a = pendingA;
        onShapesChange((prev) => [...prev, { id: newShapeId(), kind: 'line', a, b: p }]);
        setPendingA(null);
      }
      return;
    }
    if (tool === 'pencil') {
      const id = newShapeId();
      onShapesChange((prev) => [...prev, { id, kind: 'pencil', points: [p] }]);
      setDrawingId(id);
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (tool === 'cross') {
      const id = newShapeId();
      onShapesChange((prev) => [...prev, { id, kind: 'cross', center: p, halfW: 18, halfH: 18 }]);
      setSelectedShapeId(id);
      return;
    }
    if (tool === 'rect' || tool === 'ellipse') {
      const id = newShapeId();
      onShapesChange((prev) => [...prev, { id, kind: tool, x: p.x, y: p.y, w: 0, h: 0 }]);
      setDrawingId(id);
      setDrawingRectAnchor(p);
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
  }

  function onSvgPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!drawingId) return;
    const p = pointFromEvent(e);
    onShapesChange((prev) =>
      prev.map((s) => {
        if (s.id !== drawingId) return s;
        if (s.kind === 'pencil') return { ...s, points: [...s.points, p] };
        if ((s.kind === 'rect' || s.kind === 'ellipse') && drawingRectAnchor) {
          const a = drawingRectAnchor;
          return {
            ...s,
            x: Math.min(a.x, p.x),
            y: Math.min(a.y, p.y),
            w: Math.abs(p.x - a.x),
            h: Math.abs(p.y - a.y),
          };
        }
        return s;
      })
    );
  }

  function onSvgPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    if (!drawingId) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    // Un rect/ellipse trop petit (simple clic) est supprimé pour ne pas polluer
    onShapesChange((prev) =>
      prev.filter((s) => {
        if (s.id !== drawingId) return true;
        if ((s.kind === 'rect' || s.kind === 'ellipse') && (s.w < 1 || s.h < 1)) return false;
        return true;
      })
    );
    setDrawingId(null);
    setDrawingRectAnchor(null);
  }

  function startDrag(e: React.PointerEvent<SVGCircleElement>, nextDrag: DragState) {
    if (!enabled) return;
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag(nextDrag);
    setSelectedShapeId(nextDrag.shapeId);
  }

  function onHandleMove(e: React.PointerEvent<SVGCircleElement>) {
    if (!drag) return;
    const p = pointFromEvent(e);
    if (drag.kind === 'line') {
      onShapesChange((prev) =>
        prev.map((s) =>
          s.id === drag.shapeId && s.kind === 'line' ? { ...s, [drag.endpoint]: p } : s
        )
      );
    } else if (drag.kind === 'cross') {
      onShapesChange((prev) =>
        prev.map((s) => {
          if (s.id !== drag.shapeId || s.kind !== 'cross') return s;
          if (drag.endpoint === 'center') return { ...s, center: p };
          if (drag.endpoint === 'right') return { ...s, halfW: Math.max(2, p.x - s.center.x) };
          if (drag.endpoint === 'left') return { ...s, halfW: Math.max(2, s.center.x - p.x) };
          if (drag.endpoint === 'bottom') return { ...s, halfH: Math.max(2, p.y - s.center.y) };
          if (drag.endpoint === 'top') return { ...s, halfH: Math.max(2, s.center.y - p.y) };
          return s;
        })
      );
    } else if (drag.kind === 'rect' || drag.kind === 'ellipse') {
      const expectedKind = drag.kind;
      onShapesChange((prev) =>
        prev.map((s) => {
          if (s.id !== drag.shapeId || s.kind !== expectedKind) return s;
          const x2 = s.x + s.w;
          const y2 = s.y + s.h;
          if (drag.endpoint === 'tl') return { ...s, x: p.x, y: p.y, w: Math.max(1, x2 - p.x), h: Math.max(1, y2 - p.y) };
          if (drag.endpoint === 'tr') return { ...s, y: p.y, w: Math.max(1, p.x - s.x), h: Math.max(1, y2 - p.y) };
          if (drag.endpoint === 'bl') return { ...s, x: p.x, w: Math.max(1, x2 - p.x), h: Math.max(1, p.y - s.y) };
          if (drag.endpoint === 'br') return { ...s, w: Math.max(1, p.x - s.x), h: Math.max(1, p.y - s.y) };
          if (drag.endpoint === 'center') return { ...s, x: p.x - s.w / 2, y: p.y - s.h / 2 };
          return s;
        })
      );
    }
  }

  function onHandleUp(e: React.PointerEvent<SVGCircleElement>) {
    if (!drag) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDrag(null);
  }

  const cursorClass = !enabled
    ? styles.overlayReadOnly
    : tool === 'select'
      ? styles.overlaySelect
      : styles.overlayDraw;

  const showHandles = enabled && tool === 'select';

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={`${styles.overlay} ${cursorClass}`}
      onPointerDown={onSvgPointerDown}
      onPointerMove={onSvgPointerMove}
      onPointerUp={onSvgPointerUp}
    >
      {shapes.map((s) => {
        const isSelected = s.id === selectedShapeId;
        const stroke = colorForKind(s.kind);
        if (s.kind === 'line') {
          return (
            <g key={s.id}>
              {isSelected && (
                <line x1={s.a.x} y1={s.a.y} x2={s.b.x} y2={s.b.y} stroke="#e8c56a" strokeOpacity="0.6" strokeWidth="2" strokeLinecap="round" />
              )}
              <line x1={s.a.x} y1={s.a.y} x2={s.b.x} y2={s.b.y} stroke={stroke} strokeWidth="0.6" strokeLinecap="round" />
              {showHandles && (
                <>
                  <Handle p={s.a} onDown={(e) => startDrag(e, { kind: 'line', shapeId: s.id, endpoint: 'a' })} onMove={onHandleMove} onUp={onHandleUp} selected={isSelected} color={stroke} />
                  <Handle p={s.b} onDown={(e) => startDrag(e, { kind: 'line', shapeId: s.id, endpoint: 'b' })} onMove={onHandleMove} onUp={onHandleUp} selected={isSelected} color={stroke} />
                </>
              )}
            </g>
          );
        }
        if (s.kind === 'pencil') {
          const pts = s.points.map((p) => `${p.x},${p.y}`).join(' ');
          return (
            <g key={s.id}>
              {isSelected && (
                <polyline points={pts} fill="none" stroke="#e8c56a" strokeOpacity="0.6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              )}
              <polyline points={pts} fill="none" stroke={stroke} strokeWidth="0.6" strokeLinecap="round" strokeLinejoin="round" />
              {showHandles && s.points.length > 0 && (
                <Handle
                  p={s.points[0]}
                  onDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setSelectedShapeId(s.id);
                  }}
                  onMove={() => {}}
                  onUp={() => {}}
                  selected={isSelected}
                  color={stroke}
                />
              )}
            </g>
          );
        }
        if (s.kind === 'cross') {
          const cx = s.center.x;
          const cy = s.center.y;
          return (
            <g key={s.id}>
              {isSelected && (
                <>
                  <line x1={cx - s.halfW} y1={cy} x2={cx + s.halfW} y2={cy} stroke="#e8c56a" strokeOpacity="0.6" strokeWidth="2" strokeLinecap="round" />
                  <line x1={cx} y1={cy - s.halfH} x2={cx} y2={cy + s.halfH} stroke="#e8c56a" strokeOpacity="0.6" strokeWidth="2" strokeLinecap="round" />
                </>
              )}
              <line x1={cx - s.halfW} y1={cy} x2={cx + s.halfW} y2={cy} stroke={stroke} strokeWidth="0.6" strokeLinecap="round" />
              <line x1={cx} y1={cy - s.halfH} x2={cx} y2={cy + s.halfH} stroke={stroke} strokeWidth="0.6" strokeLinecap="round" />
              {showHandles && (
                <>
                  <Handle p={{ x: cx - s.halfW, y: cy }} onDown={(e) => startDrag(e, { kind: 'cross', shapeId: s.id, endpoint: 'left' })} onMove={onHandleMove} onUp={onHandleUp} selected={isSelected} color={stroke} />
                  <Handle p={{ x: cx + s.halfW, y: cy }} onDown={(e) => startDrag(e, { kind: 'cross', shapeId: s.id, endpoint: 'right' })} onMove={onHandleMove} onUp={onHandleUp} selected={isSelected} color={stroke} />
                  <Handle p={{ x: cx, y: cy - s.halfH }} onDown={(e) => startDrag(e, { kind: 'cross', shapeId: s.id, endpoint: 'top' })} onMove={onHandleMove} onUp={onHandleUp} selected={isSelected} color={stroke} />
                  <Handle p={{ x: cx, y: cy + s.halfH }} onDown={(e) => startDrag(e, { kind: 'cross', shapeId: s.id, endpoint: 'bottom' })} onMove={onHandleMove} onUp={onHandleUp} selected={isSelected} color={stroke} />
                  <Handle p={{ x: cx, y: cy }} onDown={(e) => startDrag(e, { kind: 'cross', shapeId: s.id, endpoint: 'center' })} onMove={onHandleMove} onUp={onHandleUp} selected={isSelected} variant="center" />
                </>
              )}
            </g>
          );
        }
        if (s.kind === 'ellipse') {
          const cx = s.x + s.w / 2;
          const cy = s.y + s.h / 2;
          return (
            <g key={s.id}>
              {isSelected && <ellipse cx={cx} cy={cy} rx={s.w / 2} ry={s.h / 2} fill="none" stroke="#e8c56a" strokeOpacity="0.6" strokeWidth="2" />}
              <ellipse cx={cx} cy={cy} rx={s.w / 2} ry={s.h / 2} fill="none" stroke={stroke} strokeWidth="0.6" />
              {showHandles && (
                <>
                  <Handle p={{ x: s.x, y: s.y }} onDown={(e) => startDrag(e, { kind: 'ellipse', shapeId: s.id, endpoint: 'tl' })} onMove={onHandleMove} onUp={onHandleUp} selected={isSelected} color={stroke} />
                  <Handle p={{ x: s.x + s.w, y: s.y }} onDown={(e) => startDrag(e, { kind: 'ellipse', shapeId: s.id, endpoint: 'tr' })} onMove={onHandleMove} onUp={onHandleUp} selected={isSelected} color={stroke} />
                  <Handle p={{ x: s.x, y: s.y + s.h }} onDown={(e) => startDrag(e, { kind: 'ellipse', shapeId: s.id, endpoint: 'bl' })} onMove={onHandleMove} onUp={onHandleUp} selected={isSelected} color={stroke} />
                  <Handle p={{ x: s.x + s.w, y: s.y + s.h }} onDown={(e) => startDrag(e, { kind: 'ellipse', shapeId: s.id, endpoint: 'br' })} onMove={onHandleMove} onUp={onHandleUp} selected={isSelected} color={stroke} />
                  <Handle p={{ x: cx, y: cy }} onDown={(e) => startDrag(e, { kind: 'ellipse', shapeId: s.id, endpoint: 'center' })} onMove={onHandleMove} onUp={onHandleUp} selected={isSelected} variant="center" />
                </>
              )}
            </g>
          );
        }
        // rect
        return (
          <g key={s.id}>
            {isSelected && <rect x={s.x} y={s.y} width={s.w} height={s.h} fill="none" stroke="#e8c56a" strokeOpacity="0.6" strokeWidth="2" />}
            <rect x={s.x} y={s.y} width={s.w} height={s.h} fill="none" stroke={stroke} strokeWidth="0.6" />
            {showHandles && (
              <>
                <Handle p={{ x: s.x, y: s.y }} onDown={(e) => startDrag(e, { kind: 'rect', shapeId: s.id, endpoint: 'tl' })} onMove={onHandleMove} onUp={onHandleUp} selected={isSelected} color={stroke} />
                <Handle p={{ x: s.x + s.w, y: s.y }} onDown={(e) => startDrag(e, { kind: 'rect', shapeId: s.id, endpoint: 'tr' })} onMove={onHandleMove} onUp={onHandleUp} selected={isSelected} color={stroke} />
                <Handle p={{ x: s.x, y: s.y + s.h }} onDown={(e) => startDrag(e, { kind: 'rect', shapeId: s.id, endpoint: 'bl' })} onMove={onHandleMove} onUp={onHandleUp} selected={isSelected} color={stroke} />
                <Handle p={{ x: s.x + s.w, y: s.y + s.h }} onDown={(e) => startDrag(e, { kind: 'rect', shapeId: s.id, endpoint: 'br' })} onMove={onHandleMove} onUp={onHandleUp} selected={isSelected} color={stroke} />
                <Handle p={{ x: s.x + s.w / 2, y: s.y + s.h / 2 }} onDown={(e) => startDrag(e, { kind: 'rect', shapeId: s.id, endpoint: 'center' })} onMove={onHandleMove} onUp={onHandleUp} selected={isSelected} variant="center" />
              </>
            )}
          </g>
        );
      })}
      {pendingA && tool === 'line' && (
        <circle cx={pendingA.x} cy={pendingA.y} r="1.5" fill={colorForKind('line')} opacity="0.6" />
      )}
    </svg>
  );
}

function Handle({
  p,
  onDown,
  onMove,
  onUp,
  selected,
  variant,
  color,
}: {
  p: DrawPoint;
  onDown: (e: React.PointerEvent<SVGCircleElement>) => void;
  onMove: (e: React.PointerEvent<SVGCircleElement>) => void;
  onUp: (e: React.PointerEvent<SVGCircleElement>) => void;
  selected: boolean;
  variant?: 'center';
  color?: string;
}) {
  const isCenter = variant === 'center';
  const handleFill = isCenter ? '#e8c56a' : (color ?? '#b3432f');
  return (
    <g style={{ cursor: isCenter ? 'move' : 'grab' }}>
      <circle
        cx={p.x}
        cy={p.y}
        r={isCenter ? 3 : 2}
        fill={handleFill}
        stroke={isCenter ? '#3d3832' : selected ? '#e8c56a' : 'white'}
        strokeWidth={isCenter ? 0.6 : selected ? 0.8 : 0.4}
        style={{ touchAction: 'none' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
      />
      {isCenter && (
        <>
          <line x1={p.x - 1.2} y1={p.y} x2={p.x + 1.2} y2={p.y} stroke="#3d3832" strokeWidth="0.5" strokeLinecap="round" pointerEvents="none" />
          <line x1={p.x} y1={p.y - 1.2} x2={p.x} y2={p.y + 1.2} stroke="#3d3832" strokeWidth="0.5" strokeLinecap="round" pointerEvents="none" />
        </>
      )}
    </g>
  );
}
