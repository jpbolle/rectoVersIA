/**
 * Transformation d'un schéma en un autre type, via la structure (pas via le texte,
 * mais avec exactement les mêmes règles que le Markdown).
 *
 * | De → vers                       | Résultat                                             |
 * |---------------------------------|------------------------------------------------------|
 * | mindmap ↔ hierarchy             | même arbre, autre disposition                        |
 * | arbre → conceptmap              | chaque branche devient un lien sans mot de liaison   |
 * | conceptmap → arbre              | refusée si cycle ; concept à plusieurs parents → on   |
 * |                                 | garde le premier lien et on liste les liens perdus ; |
 * |                                 | plusieurs racines → rattachées à la première         |
 * | timeline → arbre                | titre au centre, un étage par branche, un événement  |
 * |                                 | par idée « 1815 : Titre », dans l'ordre du temps      |
 * | arbre → timeline                | une branche = un étage si ses idées commencent par   |
 * |                                 | une date ; le reste va « à placer »                   |
 * | conceptmap ↔ timeline           | en passant par l'arbre                               |
 */
import { newId, type Diagram, type DiagramEdge, type DiagramNode, type DiagramType, type TimelineLane } from '@/types/diagram';
import { childrenMap, isTreeType, rootOf } from './tree';
import { estimateSize, layoutTree } from './tree-layout';
import { parseDate, toIso, toYears } from './dates';

export interface TransformResult {
  diagram: Diagram;
  warnings: string[];
}

export function transformDiagram(diagram: Diagram, target: DiagramType): TransformResult {
  if (diagram.type === target) return { diagram, warnings: [] };
  // Schéma libre : une carte conceptuelle avec des formes. Vers la carte, les formes
  // s'oublient ; vers le reste, on passe par la carte. Depuis n'importe quoi vers le
  // libre : on fait d'abord une carte, puis on la déclare libre (formes par défaut).
  if (diagram.type === 'libre') {
    const asMap = freeToConceptMap(diagram);
    if (target === 'conceptmap') return asMap;
    const final = transformDiagram(asMap.diagram, target);
    return { diagram: final.diagram, warnings: [...asMap.warnings, ...final.warnings] };
  }
  if (target === 'libre') {
    const step = diagram.type === 'conceptmap' ? { diagram, warnings: [] } : transformDiagram(diagram, 'conceptmap');
    return { diagram: { ...step.diagram, type: 'libre' }, warnings: step.warnings };
  }
  if (diagram.type === 'timeline' && isTreeType(target)) return timelineToTree(diagram, target);
  if (isTreeType(diagram.type) && target === 'timeline') return treeToTimeline(diagram);
  if (diagram.type === 'timeline' || target === 'timeline') {
    // Carte conceptuelle ↔ frise : en passant par la carte mentale.
    const step = transformDiagram(diagram, 'mindmap');
    const final = transformDiagram(step.diagram, target);
    return { diagram: final.diagram, warnings: [...step.warnings, ...final.warnings] };
  }
  if (isTreeType(diagram.type) && isTreeType(target)) {
    return { diagram: { ...diagram, type: target }, warnings: [] };
  }
  // Les éléments à placer et les réglages par défaut survivent à toute transformation.
  if (isTreeType(diagram.type) && target === 'conceptmap') return treeToConceptMap(diagram);
  return conceptMapToTree(diagram, target);
}

function freeToConceptMap(diagram: Diagram): TransformResult {
  let formes = 0;
  const nodes: DiagramNode[] = diagram.nodes.map((n) => {
    if (n.shape || n.width || n.height) formes++;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { shape, width, height, ...rest } = n;
    return rest;
  });
  const edges: DiagramEdge[] = diagram.edges.map((e) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { path, arrow, ...rest } = e;
    return rest;
  });
  return {
    diagram: { ...diagram, type: 'conceptmap', nodes, edges },
    warnings: formes ? ['Les formes et les tailles du schéma libre ne sont pas conservées.'] : [],
  };
}

function treeToConceptMap(diagram: Diagram): TransformResult {
  // Positions : celles mémorisées quand la carte est devenue un arbre (l'élève retrouve
  // sa disposition) ; une idée née dans l'arbre se place sous son parent ; sans aucune
  // mémoire, disposition automatique pour que la carte s'ouvre déjà lisible.
  const saved = diagram.layouts?.conceptmap ?? {};
  const placements = layoutTree(diagram, (n) => estimateSize(n.label));
  const placed = new Map<string, { x: number; y: number }>();
  const siblingRank = new Map<string, number>();
  for (const n of diagram.nodes) {
    const s = saved[n.id];
    if (s) {
      placed.set(n.id, { x: s.x, y: s.y });
      continue;
    }
    const parentPos = n.parentId ? placed.get(n.parentId) : undefined;
    if (parentPos) {
      const rank = siblingRank.get(n.parentId!) ?? 0;
      siblingRank.set(n.parentId!, rank + 1);
      placed.set(n.id, { x: parentPos.x + 40 + rank * 60, y: parentPos.y + 130 + rank * 30 });
      continue;
    }
    const p = placements.get(n.id);
    placed.set(n.id, { x: p?.x ?? 0, y: p?.y ?? 0 });
  }
  const nodes: DiagramNode[] = diagram.nodes.map((n) => {
    const p = placed.get(n.id)!;
    return { id: n.id, label: n.label, x: Math.round(p.x), y: Math.round(p.y), color: n.color, box: n.box };
  });
  // Le style de la branche devient celui du lien.
  const edges: DiagramEdge[] = diagram.nodes
    .filter((n) => n.parentId)
    .map((n) => ({ id: newId('e'), source: n.parentId!, target: n.id, line: n.branch }));
  return {
    diagram: { type: 'conceptmap', title: diagram.title, nodes, edges, defaults: diagram.defaults, pending: diagram.pending },
    // (pas de `layouts` : les positions sont redevenues celles des nœuds)
    warnings: edges.length ? ['Les mots de liaison sont à compléter.'] : [],
  };
}

function conceptMapToTree(diagram: Diagram, target: DiagramType): TransformResult {
  const warnings: string[] = [];
  // Ce qui ne trouve pas sa place devient un tag « à placer » (glissable sur une boîte).
  const pending: string[] = [...(diagram.pending ?? [])];
  const byId = new Map(diagram.nodes.map((n) => [n.id, n]));
  const label = (id: string) => byId.get(id)?.label ?? id;
  const linkText = (e: DiagramEdge) => (e.label ? `${label(e.source)} → ${e.label} → ${label(e.target)}` : `${label(e.source)} → ${label(e.target)}`);

  // 1. Un seul parent par concept : on garde le premier lien entrant, les autres vont « à placer ».
  const parentOf = new Map<string, string>();
  const parentEdge = new Map<string, DiagramEdge>();
  for (const e of diagram.edges) {
    if (!byId.has(e.source) || !byId.has(e.target) || e.source === e.target) continue;
    if (parentOf.has(e.target)) {
      warnings.push(`Lien mis de côté : ${linkText(e)} (« ${label(e.target)} » a déjà un parent).`);
      pending.push(linkText(e));
      continue;
    }
    parentOf.set(e.target, e.source);
    parentEdge.set(e.target, e);
  }

  // 2. Pas de cycle : on remonte depuis chaque nœud, un cycle = un lien coupé.
  for (const n of diagram.nodes) {
    const seen = new Set<string>([n.id]);
    let current = parentOf.get(n.id);
    while (current) {
      if (seen.has(current)) {
        const culprit = [...seen].find((id) => parentOf.get(id) === current) ?? n.id;
        const cut = parentEdge.get(culprit);
        warnings.push(`Lien mis de côté pour casser une boucle : ${label(current)} → ${label(culprit)}.`);
        pending.push(cut ? linkText(cut) : `${label(current)} → ${label(culprit)}`);
        parentOf.delete(culprit);
        parentEdge.delete(culprit);
        break;
      }
      seen.add(current);
      current = parentOf.get(current);
    }
  }

  // 3. Une seule racine : les autres sont rattachées à la première.
  const roots = diagram.nodes.filter((n) => !parentOf.has(n.id));
  if (roots.length === 0) {
    throw new Error('Impossible de trouver un concept de départ : la carte forme une boucle.');
  }
  const root = roots[0];
  for (const extra of roots.slice(1)) {
    parentOf.set(extra.id, root.id);
    warnings.push(`« ${label(extra.id)} » n'était relié à rien : rattaché à « ${label(root.id)} ».`);
  }

  // 4. Ordre des frères : ordre d'apparition dans la carte, racine d'abord.
  const nodes: DiagramNode[] = [
    { id: root.id, label: root.label, x: 0, y: 0, color: root.color, box: root.box },
    ...diagram.nodes
      .filter((n) => n.id !== root.id)
      .map((n) => ({
        id: n.id,
        label: n.label,
        x: 0,
        y: 0,
        color: n.color,
        box: n.box,
        parentId: parentOf.get(n.id),
        branch: parentEdge.get(n.id)?.line, // le style du lien devient celui de la branche
      })),
  ];
  const keptLabels = [...parentEdge.values()].filter((e) => e.label).length;
  if (keptLabels) warnings.push(`Les mots de liaison (${keptLabels}) ne sont pas conservés dans un arbre.`);

  // On mémorise la disposition de la carte pour la retrouver si on y revient.
  const conceptmap: Record<string, { x: number; y: number }> = { ...diagram.layouts?.conceptmap };
  for (const n of diagram.nodes) conceptmap[n.id] = { x: n.x, y: n.y };
  const result: Diagram = { type: target, title: diagram.title || root.label, nodes, edges: [], defaults: diagram.defaults, layouts: { conceptmap } };
  if (pending.length) result.pending = pending;
  return { diagram: result, warnings };
}

/** Utilitaire partagé : la racine et ses enfants directs (pour l'éditeur et les tests). */
export function describeTree(diagram: Diagram): { root?: DiagramNode; topLevel: DiagramNode[] } {
  const root = rootOf(diagram.nodes);
  return { root, topLevel: root ? childrenMap(diagram.nodes).get(root.id) ?? [] : [] };
}

// ─── Ligne du temps ─────────────────────────────────────────────────────────

const eventText = (n: DiagramNode) => {
  const start = parseDate(n.date);
  if (!start) return n.label;
  const end = parseDate(n.endDate);
  return `${toIso(start)}${end ? `..${toIso(end)}` : ''} : ${n.label}`;
};

function timelineToTree(diagram: Diagram, target: DiagramType): TransformResult {
  const warnings: string[] = [];
  const root: DiagramNode = { id: newId('n'), label: diagram.title || 'Ligne du temps', x: 0, y: 0 };
  const nodes: DiagramNode[] = [root];
  const byDate = (a: DiagramNode, b: DiagramNode) => {
    const da = parseDate(a.date);
    const db = parseDate(b.date);
    return (da ? toYears(da) : 0) - (db ? toYears(db) : 0);
  };
  const lanes = diagram.lanes ?? [];
  const laneIds = new Set(lanes.map((l) => l.id));
  // Les dates restent dans `date` / `endDate` (invisibles dans l'arbre, retrouvées au retour).
  const asIdea = (n: DiagramNode, parentId: string): DiagramNode => ({
    id: n.id,
    label: eventText(n),
    x: 0,
    y: 0,
    color: n.color,
    box: n.box,
    date: n.date,
    endDate: n.endDate,
    parentId,
  });
  for (const n of diagram.nodes.filter((n) => !n.laneId || !laneIds.has(n.laneId)).sort(byDate)) nodes.push(asIdea(n, root.id));
  for (const lane of lanes) {
    const branch: DiagramNode = { id: lane.id, label: lane.label, x: 0, y: 0, color: lane.color, parentId: root.id };
    nodes.push(branch);
    for (const n of diagram.nodes.filter((n) => n.laneId === lane.id).sort(byDate)) nodes.push(asIdea(n, branch.id));
  }
  const result: Diagram = { type: target, title: root.label, nodes, edges: [], defaults: diagram.defaults, lanes: diagram.lanes };
  if (diagram.pending?.length) result.pending = diagram.pending;
  return { diagram: result, warnings };
}

function treeToTimeline(diagram: Diagram): TransformResult {
  const warnings: string[] = [];
  const pending: string[] = [...(diagram.pending ?? [])];
  const root = rootOf(diagram.nodes);
  if (!root) throw new Error("L'arbre n'a pas de racine.");
  const children = childrenMap(diagram.nodes);
  const previousLanes = new Map((diagram.lanes ?? []).map((l) => [l.label.toLowerCase(), l]));
  const lanes: TimelineLane[] = [];
  const nodes: DiagramNode[] = [];
  let sideToggle: 'above' | 'below' = 'above';

  /** Une idée devient un événement si son texte commence par une date (« 1815 : … »),
   *  sinon si elle porte encore une date d'une frise précédente. */
  const toEvent = (n: DiagramNode, laneId?: string): DiagramNode | null => {
    const parsed = parseEventText(n.label) ?? (n.date ? { date: n.date, endDate: n.endDate, label: n.label } : null);
    if (!parsed) return null;
    const ev: DiagramNode = { id: n.id, label: parsed.label, x: 0, y: 0, color: n.color, box: n.box, date: parsed.date };
    if (parsed.endDate) ev.endDate = parsed.endDate;
    if (laneId) ev.laneId = laneId;
    return ev;
  };

  /** Tout le sous-arbre d'une idée, aplati (une frise n'a pas de profondeur). */
  const flatten = (id: string, into: DiagramNode[], prefix: string) => {
    for (const child of children.get(id) ?? []) {
      into.push(child);
      if ((children.get(child.id) ?? []).length) {
        warnings.push(`« ${child.label} » : ses sous-idées sont remontées au même niveau (une frise n'a pas de profondeur).`);
        flatten(child.id, into, prefix);
      }
    }
  };

  for (const child of children.get(root.id) ?? []) {
    const grandChildren: DiagramNode[] = [];
    flatten(child.id, grandChildren, child.label);
    const ownEvent = toEvent(child);
    const datedKids = grandChildren.filter((g) => toEvent(g));
    if (datedKids.length) {
      // Une branche avec des idées datées = un étage.
      const before = previousLanes.get(child.label.toLowerCase());
      const side = before?.side ?? sideToggle;
      if (!before) sideToggle = sideToggle === 'above' ? 'below' : 'above';
      const lane: TimelineLane = { id: child.id, label: child.label, side };
      if (child.color ?? before?.color) lane.color = child.color ?? before?.color;
      lanes.push(lane);
      if (ownEvent) {
        // La branche elle-même est datée : c'est aussi un événement de son étage.
        nodes.push({ ...ownEvent, id: newId('n'), laneId: lane.id });
      }
      for (const g of grandChildren) {
        const ev = toEvent(g, lane.id);
        if (ev) nodes.push(ev);
        else {
          warnings.push(`« ${g.label} » n'a pas de date → à placer.`);
          pending.push(`${child.label} › ${g.label}`);
        }
      }
    } else if (ownEvent) {
      nodes.push(ownEvent); // idée datée sous la racine : sur l'axe
      for (const g of grandChildren) pending.push(`${child.label} › ${g.label}`);
      if (grandChildren.length) warnings.push(`Les sous-idées de « ${child.label} » n'ont pas de date → à placer.`);
    } else {
      warnings.push(`« ${child.label} » n'a ni date ni idée datée → à placer.`);
      pending.push(child.label);
      for (const g of grandChildren) pending.push(`${child.label} › ${g.label}`);
    }
  }

  const result: Diagram = { type: 'timeline', title: root.label, nodes, edges: [], lanes, defaults: diagram.defaults };
  if (pending.length) result.pending = pending;
  return { diagram: result, warnings };
}

/** « 1815 : Titre » / « 1830..1831 : Titre » → dates canoniques (même règle que le Markdown). */
export function parseEventText(text: string): { date: string; endDate?: string; label: string } | null {
  const idx = text.indexOf(':');
  if (idx <= 0) return null;
  const left = text.slice(0, idx).trim();
  const label = text.slice(idx + 1).trim();
  const [startText, endText] = left.split('..').map((p) => p.trim());
  const start = parseDate(startText);
  if (!start || !label) return null;
  const end = endText ? parseDate(endText) : null;
  if (endText && !end) return null;
  return end ? { date: toIso(start), endDate: toIso(end), label } : { date: toIso(start), label };
}
