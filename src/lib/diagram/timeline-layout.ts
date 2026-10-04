/**
 * Disposition de la ligne du temps — sans dépendance.
 * L'axe est horizontal (y = 0) ; la position x d'un événement se CALCULE à partir de sa
 * date. Les étages sont des bandeaux au-dessus ou au-dessous ; dans un étage, les
 * événements qui se chevaucheraient s'empilent sur plusieurs rangées.
 */
import type { Diagram, DiagramNode, TimelineLane } from '@/types/diagram';
import { parseDate, toYears } from './dates';

export interface Scale {
  minYears: number;
  maxYears: number;
  pxPerYear: number;
  x0: number; // x de minYears
  xOf: (years: number) => number;
}

export interface Tick {
  x: number;
  years: number;
  step: number;
  major: boolean;
}

export interface LaneBand {
  lane: TimelineLane | null; // null = « sur l'axe »
  top: number;
  height: number;
  side: 'above' | 'below';
}

export interface EventPlacement {
  x: number;
  y: number;
  width: number;
  isPeriod: boolean;
  years: number;
  endYears?: number;
}

export interface TimelineLayout {
  scale: Scale;
  ticks: Tick[];
  bands: LaneBand[];
  events: Map<string, EventPlacement>;
  /** Zone totale (axe, étages, graduations) pour l'export et le recadrage. */
  bounds: { x: number; y: number; width: number; height: number };
}

export const AXIS_HEIGHT = 36; // hauteur réservée aux graduations sous l'axe
export const ROW_HEIGHT = 56;
export const BAND_PADDING = 14;
export const BAND_GAP = 10;
export const MIN_EVENT_WIDTH = 110;
const TARGET_WIDTH = 1400;
const ROW_GAP_PX = 12;

export interface EventSize {
  width: number;
  height: number;
}

export function eventYears(n: DiagramNode): { start: number; end?: number } | null {
  const start = parseDate(n.date);
  if (!start) return null;
  const end = parseDate(n.endDate);
  const s = toYears(start);
  const e = end ? toYears(end) : undefined;
  return e !== undefined && e > s ? { start: s, end: e } : { start: s };
}

export function computeScale(nodes: DiagramNode[]): Scale {
  let min = Infinity;
  let max = -Infinity;
  for (const n of nodes) {
    const y = eventYears(n);
    if (!y) continue;
    min = Math.min(min, y.start);
    max = Math.max(max, y.end ?? y.start);
  }
  if (!Number.isFinite(min)) {
    const now = new Date().getFullYear();
    min = now - 10;
    max = now;
  }
  if (max - min < 1e-6) {
    min -= 1;
    max += 1;
  }
  const span = max - min;
  const pad = span * 0.06;
  const minYears = min - pad;
  const maxYears = max + pad;
  const pxPerYear = TARGET_WIDTH / (maxYears - minYears);
  return { minYears, maxYears, pxPerYear, x0: 0, xOf: (years) => (years - minYears) * pxPerYear };
}

/** Graduations lisibles : un pas « rond » qui donne entre 6 et 14 traits. */
export function computeTicks(scale: Scale): Tick[] {
  const span = scale.maxYears - scale.minYears;
  const candidates = [5000, 2000, 1000, 500, 200, 100, 50, 25, 20, 10, 5, 2, 1, 0.5, 1 / 4, 1 / 12];
  let step = candidates[0];
  for (const c of candidates) {
    step = c;
    if (span / c >= 6) break;
  }
  const ticks: Tick[] = [];
  const first = Math.ceil(scale.minYears / step) * step;
  const majorEvery = step >= 1 ? (step === 1 ? 5 : step === 2 ? 5 : 2) : 12 * step >= 1 ? 1 : 12;
  for (let y = first; y <= scale.maxYears + 1e-9; y += step) {
    const years = Math.round(y / step) * step;
    const index = Math.round(years / step);
    ticks.push({ x: scale.xOf(years), years, step, major: index % majorEvery === 0 });
  }
  return ticks;
}

export function layoutTimeline(diagram: Diagram, sizeOf: (n: DiagramNode) => EventSize): TimelineLayout {
  const scale = computeScale(diagram.nodes);
  const ticks = computeTicks(scale);
  const lanes = diagram.lanes ?? [];
  const events = new Map<string, EventPlacement>();

  // Regrouper par étage (null = sur l'axe).
  const byLane = new Map<string | null, DiagramNode[]>();
  byLane.set(null, []);
  for (const l of lanes) byLane.set(l.id, []);
  for (const n of diagram.nodes) {
    const y = eventYears(n);
    if (!y) continue; // sans date : pas sur la frise (reste « à placer »)
    const key = n.laneId && byLane.has(n.laneId) ? n.laneId : null;
    byLane.get(key)!.push(n);
  }

  /** Empile les événements d'un étage : renvoie rangée par id et le nombre de rangées. */
  const stack = (list: DiagramNode[]) => {
    const sorted = [...list].sort((a, b) => eventYears(a)!.start - eventYears(b)!.start);
    const rowEnds: number[] = [];
    const rows = new Map<string, { row: number; x: number; width: number }>();
    for (const n of sorted) {
      const y = eventYears(n)!;
      const x = scale.xOf(y.start);
      const natural = sizeOf(n).width;
      const width = y.end !== undefined ? Math.max(MIN_EVENT_WIDTH, scale.xOf(y.end) - x) : natural;
      let row = rowEnds.findIndex((end) => end + ROW_GAP_PX <= x);
      if (row < 0) {
        row = rowEnds.length;
        rowEnds.push(x + width);
      } else rowEnds[row] = x + width;
      rows.set(n.id, { row, x, width });
    }
    return { rows, count: Math.max(1, rowEnds.length) };
  };

  const bands: LaneBand[] = [];
  // Au-dessus de l'axe : d'abord « sur l'axe » (sans bandeau), puis les étages du dessus.
  let topCursor = 0; // y du bord bas de la prochaine bande au-dessus
  const above = [null, ...lanes.filter((l) => l.side === 'above').map((l) => l.id)];
  for (const key of above) {
    const list = byLane.get(key) ?? [];
    const lane = key ? lanes.find((l) => l.id === key)! : null;
    if (!lane && list.length === 0) continue;
    const { rows, count } = stack(list);
    const height = count * ROW_HEIGHT + BAND_PADDING * 2;
    const top = topCursor - height;
    bands.push({ lane, top, height, side: 'above' });
    for (const n of list) {
      const r = rows.get(n.id)!;
      const y = eventYears(n)!;
      // Rangée 0 = la plus proche de l'axe.
      events.set(n.id, {
        x: r.x,
        y: top + height - BAND_PADDING - (r.row + 1) * ROW_HEIGHT + (ROW_HEIGHT - sizeOf(n).height) / 2,
        width: r.width,
        isPeriod: y.end !== undefined,
        years: y.start,
        endYears: y.end,
      });
    }
    topCursor = top - BAND_GAP;
  }
  // Au-dessous : après la zone des graduations.
  let bottomCursor = AXIS_HEIGHT;
  for (const l of lanes.filter((l) => l.side === 'below')) {
    const list = byLane.get(l.id) ?? [];
    const { rows, count } = stack(list);
    const height = count * ROW_HEIGHT + BAND_PADDING * 2;
    const top = bottomCursor;
    bands.push({ lane: l, top, height, side: 'below' });
    for (const n of list) {
      const r = rows.get(n.id)!;
      const y = eventYears(n)!;
      events.set(n.id, {
        x: r.x,
        y: top + BAND_PADDING + r.row * ROW_HEIGHT + (ROW_HEIGHT - sizeOf(n).height) / 2,
        width: r.width,
        isPeriod: y.end !== undefined,
        years: y.start,
        endYears: y.end,
      });
    }
    bottomCursor = top + height + BAND_GAP;
  }

  const width = scale.xOf(scale.maxYears);
  const minY = Math.min(topCursor, -ROW_HEIGHT);
  const maxY = Math.max(bottomCursor, AXIS_HEIGHT);
  return { scale, ticks, bands, events, bounds: { x: -60, y: minY, width: width + 120, height: maxY - minY } };
}

export function estimateEventSize(label: string): EventSize {
  const width = Math.min(240, Math.max(MIN_EVENT_WIDTH, label.length * 7.5 + 28));
  return { width, height: 40 };
}
