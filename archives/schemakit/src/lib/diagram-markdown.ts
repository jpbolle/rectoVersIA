/**
 * Export et import Markdown d'un schéma — le format d'échange lisible par un humain.
 * Grammaire fixée dans harnais/plans/2026-09-12-editeur-carte-conceptuelle.md, étendue
 * le 2026-09-13 (styles, éléments à placer).
 *
 * Carte conceptuelle :
 *   ---
 *   type: conceptmap
 *   ---
 *   # Titre
 *   ## Concepts
 *   - Soleil <!-- x:120 y:80 couleur:jaune bordure:épaisse -->
 *   ## Liens
 *   - Soleil → provoque → Évaporation <!-- trait:tirets épaisseur:4 couleur:rouge -->
 *   ## À placer
 *   - Pluie → Océan
 *
 * Carte mentale et schéma hiérarchisé (même texte, seule la disposition change) :
 *   ---
 *   type: mindmap
 *   ---
 *   # Racine
 *   - Branche <!-- couleur:vert trait:pointillé -->
 *     - Sous-branche
 * À l'import, les lignes numérotées sont acceptées aussi : `1. Branche`, `1.1 Sous-branche`.
 *
 * Ligne du temps : les étages sont des sections, les événements des lignes datées.
 *   ---
 *   type: timeline
 *   ---
 *   # Le XIXe siècle
 *   - 1815 : Congrès de Vienne            (sans section : sur l'axe)
 *   ## Politique <!-- côté:dessus couleur:bleu -->
 *   - 1830..1831 : Révolution belge
 *
 * Les commentaires sont facultatifs : sans eux, positions reprises d'un concept de même
 * nom dans le schéma précédent (sinon placement automatique) et styles par défaut.
 * Les réglages par défaut du schéma vont dans l'en-tête (`trait: tirets`, `bordure: épaisse`…).
 */
import {
  DEFAULT_NODE_COLOR,
  NODE_COLOR_NAMES,
  STROKE_COLOR_NAMES,
  isHexColor,
  newId,
  type BoxStyle,
  type ColorRef,
  type Diagram,
  type DiagramEdge,
  type DiagramNode,
  type DiagramType,
  type LineStyle,
} from '@/types/diagram';
import { childrenMap, isTreeType, rootOf } from './tree';
import { parseDate, toIso } from './dates';

export interface MarkdownOptions {
  /** Ajoute `<!-- x:.. y:.. -->` aux concepts (les styles et couleurs sont toujours écrits). */
  withPositions?: boolean;
}

export interface MarkdownImportResult {
  diagram: Diagram;
  warnings: string[];
}

const ARROW = '→';
/** Accepte →, ->, --> et —> comme flèche à l'import. */
const ARROW_SPLIT = /\s*(?:→|—>|-+>)\s*/;

type Comment = Record<string, string>;

// ─── Vocabulaire français des styles ───────────────────────────────────────

const DASH_TEXT: Record<NonNullable<LineStyle['dash']>, string> = { solid: 'plein', dashed: 'tirets', dotted: 'pointillé' };
const BORDER_TEXT: Record<NonNullable<BoxStyle['border']>, string> = { thin: 'fine', thick: 'épaisse', none: 'aucune' };
const CORNERS_TEXT: Record<NonNullable<BoxStyle['corners']>, string> = { round: 'arrondis', square: 'carrés' };

const invert = <K extends string>(map: Record<K, string>): Record<string, K> =>
  Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k])) as Record<string, K>;
const DASH_BY_TEXT = invert(DASH_TEXT);
const BORDER_BY_TEXT = invert(BORDER_TEXT);
const CORNERS_BY_TEXT = invert(CORNERS_TEXT);
const FILL_BY_TEXT = invert(NODE_COLOR_NAMES);
const STROKE_BY_TEXT = invert(STROKE_COLOR_NAMES);

function fillToText(ref: ColorRef | undefined): string | undefined {
  if (!ref || ref === DEFAULT_NODE_COLOR) return undefined;
  if (ref in NODE_COLOR_NAMES) return NODE_COLOR_NAMES[ref as keyof typeof NODE_COLOR_NAMES];
  return isHexColor(ref) ? ref.toLowerCase() : undefined;
}

function strokeToText(ref: ColorRef | undefined): string | undefined {
  if (!ref) return undefined;
  if (ref in STROKE_COLOR_NAMES) return STROKE_COLOR_NAMES[ref as keyof typeof STROKE_COLOR_NAMES];
  return isHexColor(ref) ? ref.toLowerCase() : undefined;
}

function parseColor(text: string | undefined, byText: Record<string, string>, warnings: string[]): ColorRef | undefined {
  if (!text) return undefined;
  if (byText[text]) return byText[text];
  if (isHexColor(text)) return text.toLowerCase();
  warnings.push(`Couleur inconnue : « ${text} ».`);
  return undefined;
}

/** Style d'un trait → paires clé:valeur (`couleur` ou `trait-couleur` selon le contexte). */
function lineToPairs(line: LineStyle | undefined, colorKey: string): string[] {
  if (!line) return [];
  const pairs: string[] = [];
  if (line.dash) pairs.push(`trait:${DASH_TEXT[line.dash]}`);
  if (line.width) pairs.push(`épaisseur:${line.width}`);
  const color = strokeToText(line.color);
  if (color) pairs.push(`${colorKey}:${color}`);
  return pairs;
}

function boxToPairs(box: BoxStyle | undefined): string[] {
  if (!box) return [];
  const pairs: string[] = [];
  if (box.border) pairs.push(`bordure:${BORDER_TEXT[box.border]}`);
  if (box.corners) pairs.push(`coins:${CORNERS_TEXT[box.corners]}`);
  const color = strokeToText(box.borderColor);
  if (color) pairs.push(`contour:${color}`);
  return pairs;
}

function pairsToLine(c: Comment, colorKey: string, warnings: string[]): LineStyle | undefined {
  const line: LineStyle = {};
  if (c.trait) {
    const dash = DASH_BY_TEXT[c.trait];
    if (dash) line.dash = dash;
    else warnings.push(`Style de trait inconnu : « ${c.trait} ».`);
  }
  if (c['épaisseur'] ?? c.epaisseur) {
    const w = Number(c['épaisseur'] ?? c.epaisseur);
    if (w === 1 || w === 2 || w === 4) line.width = w;
    else warnings.push(`Épaisseur inconnue : « ${c['épaisseur'] ?? c.epaisseur} » (1, 2 ou 4).`);
  }
  const color = parseColor(c[colorKey], STROKE_BY_TEXT, warnings);
  if (color) line.color = color;
  return Object.keys(line).length ? line : undefined;
}

function pairsToBox(c: Comment, warnings: string[]): BoxStyle | undefined {
  const box: BoxStyle = {};
  if (c.bordure) {
    const b = BORDER_BY_TEXT[c.bordure];
    if (b) box.border = b;
    else warnings.push(`Bordure inconnue : « ${c.bordure} ».`);
  }
  if (c.coins) {
    const k = CORNERS_BY_TEXT[c.coins];
    if (k) box.corners = k;
    else warnings.push(`Coins inconnus : « ${c.coins} ».`);
  }
  const color = parseColor(c.contour, STROKE_BY_TEXT, warnings);
  if (color) box.borderColor = color;
  return Object.keys(box).length ? box : undefined;
}

function comment(pairs: string[]): string {
  return pairs.length ? ` <!-- ${pairs.join(' ')} -->` : '';
}

// ─── Export ────────────────────────────────────────────────────────────────

export function toMarkdown(diagram: Diagram, options: MarkdownOptions = {}): string {
  if (isTreeType(diagram.type)) return treeToMarkdown(diagram, options);
  if (diagram.type === 'timeline') return timelineToMarkdown(diagram);
  const names = displayNames(diagram.nodes);
  const lines: string[] = frontMatter(diagram);
  lines.push(`# ${diagram.title || 'Sans titre'}`, '', '## Concepts');
  for (const n of diagram.nodes) {
    const pairs: string[] = [];
    if (options.withPositions) pairs.push(`x:${n.x}`, `y:${n.y}`);
    const fill = fillToText(n.color);
    if (fill) pairs.push(`couleur:${fill}`);
    pairs.push(...boxToPairs(n.box));
    lines.push(`- ${names.get(n.id)}${comment(pairs)}`);
  }
  lines.push('', '## Liens');
  for (const e of diagram.edges) {
    const from = names.get(e.source);
    const to = names.get(e.target);
    if (!from || !to) continue; // lien orphelin : on ne l'exporte pas
    const middle = e.label ? ` ${ARROW} ${e.label}` : '';
    lines.push(`- ${from}${middle} ${ARROW} ${to}${comment(lineToPairs(e.line, 'couleur'))}`);
  }
  lines.push(...pendingSection(diagram));
  return lines.join('\n') + '\n';
}

function treeToMarkdown(diagram: Diagram, options: MarkdownOptions): string {
  const lines: string[] = frontMatter(diagram);
  const root = rootOf(diagram.nodes);
  const children = childrenMap(diagram.nodes);
  const saved = diagram.layouts?.conceptmap ?? {};
  const nodePairs = (n: DiagramNode, withBranch: boolean) => {
    const pairs: string[] = [];
    // Positions mémorisées de la carte conceptuelle (pas celles de l'arbre, automatiques).
    const s = options.withPositions ? saved[n.id] : undefined;
    if (s) pairs.push(`x:${s.x}`, `y:${s.y}`);
    const fill = fillToText(n.color);
    if (fill) pairs.push(`couleur:${fill}`);
    pairs.push(...boxToPairs(n.box));
    if (withBranch) pairs.push(...lineToPairs(n.branch, 'trait-couleur'));
    return comment(pairs);
  };
  if (!root) {
    lines.push(`# ${diagram.title || 'Sans titre'}`);
  } else {
    lines.push(`# ${cleanLabel(root.label) || 'Sans titre'}${nodePairs(root, false)}`);
    const walk = (parentId: string, depth: number) => {
      for (const child of children.get(parentId) ?? []) {
        lines.push(`${'  '.repeat(depth)}- ${cleanLabel(child.label) || 'Idée'}${nodePairs(child, true)}`);
        walk(child.id, depth + 1);
      }
    };
    walk(root.id, 0);
  }
  lines.push(...pendingSection(diagram));
  return lines.join('\n') + '\n';
}

const SIDE_TEXT = { above: 'dessus', below: 'dessous' } as const;

function timelineToMarkdown(diagram: Diagram): string {
  const lines: string[] = frontMatter(diagram);
  lines.push(`# ${diagram.title || 'Sans titre'}`);
  const stray: string[] = []; // événements sans date lisible → « à placer »
  const eventLine = (n: DiagramNode): string | null => {
    const start = parseDate(n.date);
    if (!start) {
      stray.push(cleanLabel(n.label));
      return null;
    }
    const end = parseDate(n.endDate);
    const when = end ? `${toIso(start)}..${toIso(end)}` : toIso(start);
    const pairs: string[] = [];
    const fill = fillToText(n.color);
    if (fill) pairs.push(`couleur:${fill}`);
    pairs.push(...boxToPairs(n.box));
    return `- ${when} : ${cleanLabel(n.label) || 'Événement'}${comment(pairs)}`;
  };
  const lanes = diagram.lanes ?? [];
  const laneIds = new Set(lanes.map((l) => l.id));
  const byDate = (a: DiagramNode, b: DiagramNode) => (parseDate(a.date) && parseDate(b.date) ? toIso(parseDate(a.date)!).localeCompare(toIso(parseDate(b.date)!)) : 0);
  for (const n of [...diagram.nodes].filter((n) => !n.laneId || !laneIds.has(n.laneId)).sort(byDate)) {
    const l = eventLine(n);
    if (l) lines.push(l);
  }
  for (const lane of lanes) {
    const pairs = [`côté:${SIDE_TEXT[lane.side]}`];
    const color = fillToText(lane.color);
    if (color) pairs.push(`couleur:${color}`);
    lines.push('', `## ${cleanLabel(lane.label) || 'Étage'}${comment(pairs)}`);
    for (const n of diagram.nodes.filter((n) => n.laneId === lane.id).sort(byDate)) {
      const l = eventLine(n);
      if (l) lines.push(l);
    }
  }
  const pending = [...(diagram.pending ?? []), ...stray];
  if (pending.length) lines.push('', '## À placer', ...pending.map((p) => `- ${p}`));
  return lines.join('\n') + '\n';
}

function frontMatter(diagram: Diagram): string[] {
  const lines = ['---', `type: ${diagram.type}`];
  const line = diagram.defaults?.line;
  const box = diagram.defaults?.box;
  if (line?.dash) lines.push(`trait: ${DASH_TEXT[line.dash]}`);
  if (line?.width) lines.push(`épaisseur: ${line.width}`);
  const lc = strokeToText(line?.color);
  if (lc) lines.push(`couleur-trait: ${lc}`);
  if (box?.border) lines.push(`bordure: ${BORDER_TEXT[box.border]}`);
  if (box?.corners) lines.push(`coins: ${CORNERS_TEXT[box.corners]}`);
  const bc = strokeToText(box?.borderColor);
  if (bc) lines.push(`contour: ${bc}`);
  lines.push('---');
  return lines;
}

function pendingSection(diagram: Diagram): string[] {
  if (!diagram.pending?.length) return [];
  return ['', '## À placer', ...diagram.pending.map((p) => `- ${p.replace(/\s+/g, ' ').trim()}`)];
}

/**
 * Dans le Markdown, un concept est désigné par son texte. Deux concepts de même texte
 * reçoivent un suffixe « (2) », « (3) »… pour rester distinguables dans les liens.
 */
function displayNames(nodes: DiagramNode[]): Map<string, string> {
  const seen = new Map<string, number>();
  const names = new Map<string, string>();
  for (const n of nodes) {
    const base = cleanLabel(n.label) || 'Concept';
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    names.set(n.id, count === 1 ? base : `${base} (${count})`);
  }
  return names;
}

/** Un texte sur une seule ligne, sans flèche (qui casserait la syntaxe des liens). */
function cleanLabel(label: string): string {
  return label.replace(/\s+/g, ' ').replace(ARROW_SPLIT, ' - ').trim();
}

// ─── Import ────────────────────────────────────────────────────────────────

export function fromMarkdown(text: string, previous?: Diagram): MarkdownImportResult {
  const warnings: string[] = [];
  const { type, defaults, body } = readFrontMatter(text, warnings);
  const resolvedType: DiagramType = type ?? guessType(body, previous);
  if (isTreeType(resolvedType)) return treeFromMarkdown(body, resolvedType, defaults, previous, warnings);
  if (resolvedType === 'timeline') return timelineFromMarkdown(body, defaults, previous, warnings);

  let title = previous?.title ?? '';
  const conceptLines: string[] = [];
  const linkLines: string[] = [];
  const pending: string[] = [];
  let section: 'concepts' | 'links' | 'pending' | null = null;

  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('# ')) {
      title = line.slice(2).trim();
      continue;
    }
    if (line.startsWith('## ')) {
      section = sectionOf(line.slice(3));
      if (!section) warnings.push(`Section « ${line.slice(3).trim()} » ignorée.`);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const item = line.replace(/^[-*]\s+/, '');
      if (section === 'concepts') conceptLines.push(item);
      else if (section === 'links') linkLines.push(item);
      else if (section === 'pending') pending.push(splitComment(item).text);
      else warnings.push(`Ligne hors section ignorée : « ${item} ».`);
    }
  }

  const nodes: DiagramNode[] = [];
  const byName = new Map<string, DiagramNode>();
  const previousByName = new Map<string, DiagramNode>();
  for (const n of previous?.nodes ?? []) previousByName.set(cleanLabel(n.label), n);
  const placer = autoPlacer(previous?.nodes ?? []);

  const addNode = (name: string, c: Comment): DiagramNode => {
    const existing = byName.get(name);
    if (existing) return existing;
    const before = previousByName.get(name);
    const x = numberOr(c.x, before?.x);
    const y = numberOr(c.y, before?.y);
    const pos = x !== undefined && y !== undefined ? { x, y } : placer.next();
    const color = parseColor(c.couleur, FILL_BY_TEXT, warnings) ?? before?.color;
    const node: DiagramNode = {
      id: before?.id ?? newId('n'),
      label: name,
      x: pos.x,
      y: pos.y,
      color: color ?? DEFAULT_NODE_COLOR,
    };
    const box = pairsToBox(c, warnings);
    if (box) node.box = box;
    nodes.push(node);
    byName.set(name, node);
    return node;
  };

  for (const item of conceptLines) {
    const { text, comment: c } = splitComment(item);
    if (text) addNode(text, c);
  }

  const edges: DiagramEdge[] = [];
  for (const item of linkLines) {
    const { text, comment: c } = splitComment(item);
    const parts = text.split(ARROW_SPLIT).map((p) => p.trim()).filter(Boolean);
    if (parts.length < 2 || parts.length > 3) {
      warnings.push(`Lien illisible : « ${text} » (forme attendue : A → mot → B).`);
      continue;
    }
    const [fromName, ...rest] = parts;
    const toName = rest[rest.length - 1];
    const label = rest.length === 2 ? rest[0] : undefined;
    for (const name of [fromName, toName]) {
      if (!byName.has(name)) {
        warnings.push(`Concept « ${name} » créé depuis un lien.`);
        addNode(name, {});
      }
    }
    const source = byName.get(fromName)!;
    const target = byName.get(toName)!;
    const before = previous?.edges.find((e) => e.source === source.id && e.target === target.id);
    const edge: DiagramEdge = { id: before?.id ?? newId('e'), source: source.id, target: target.id, label };
    const line = pairsToLine(c, 'couleur', warnings);
    if (line) edge.line = line;
    edges.push(edge);
  }

  const diagram: Diagram = { type: resolvedType, title, nodes, edges, viewport: previous?.viewport };
  if (defaults) diagram.defaults = defaults;
  if (pending.length) diagram.pending = pending;
  return { diagram, warnings };
}

function sectionOf(heading: string): 'concepts' | 'links' | 'pending' | null {
  const name = heading.trim().toLowerCase();
  if (name.startsWith('concept')) return 'concepts';
  if (name.startsWith('lien') || name.startsWith('relation')) return 'links';
  if (name.startsWith('à placer') || name.startsWith('a placer')) return 'pending';
  return null;
}

/** Sans en-tête `type:`, on devine : sections « Concepts / Liens » = carte conceptuelle,
 *  sinon le type du schéma précédent s'il est en arbre, sinon carte mentale. */
function guessType(body: string, previous?: Diagram): DiagramType {
  if (/^##\s*(concept|lien|relation)/im.test(body)) return 'conceptmap';
  if (previous?.type === 'timeline') return 'timeline';
  if (/^\s*[-*]\s+-?\d{1,4}(?:-\d{2})?(?:-\d{2})?(?:\.\.\S+)?\s*:/m.test(body)) return 'timeline';
  if (previous && isTreeType(previous.type)) return previous.type;
  return 'mindmap';
}

/** « 1815 : Titre » ou « 1830..1831 : Titre » → dates canoniques et titre. */
export function parseEventLine(text: string): { date: string; endDate?: string; label: string } | null {
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

function timelineFromMarkdown(
  body: string,
  defaults: Diagram['defaults'],
  previous: Diagram | undefined,
  warnings: string[],
): MarkdownImportResult {
  let title = previous?.title ?? '';
  const lanes: Diagram['lanes'] = [];
  const nodes: DiagramNode[] = [];
  const pending: string[] = [];
  let currentLane: string | undefined;
  let inPending = false;
  let sideToggle: 'above' | 'below' = 'above';

  const previousLanes = new Map((previous?.lanes ?? []).map((l) => [cleanLabel(l.label).toLowerCase(), l]));
  const previousByLabel = new Map<string, DiagramNode>();
  for (const n of previous?.nodes ?? []) previousByLabel.set(cleanLabel(n.label), n);
  const usedIds = new Set<string>();

  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('# ')) {
      title = line.slice(2).trim();
      continue;
    }
    if (line.startsWith('## ')) {
      const { text, comment: c } = splitComment(line.slice(3));
      if (sectionOf(text) === 'pending') {
        inPending = true;
        currentLane = undefined;
        continue;
      }
      inPending = false;
      const before = previousLanes.get(text.toLowerCase());
      const side: 'above' | 'below' = c['côté'] === 'dessous' || c.cote === 'dessous' ? 'below' : c['côté'] === 'dessus' || c.cote === 'dessus' ? 'above' : before?.side ?? sideToggle;
      if (!c['côté'] && !c.cote && !before) sideToggle = sideToggle === 'above' ? 'below' : 'above';
      const lane: NonNullable<Diagram['lanes']>[number] = { id: before?.id ?? newId('l'), label: text || 'Étage', side };
      const color = parseColor(c.couleur, FILL_BY_TEXT, warnings) ?? before?.color;
      if (color) lane.color = color;
      lanes.push(lane);
      currentLane = lane.id;
      continue;
    }
    if (!/^[-*]\s+/.test(line)) {
      warnings.push(`Ligne ignorée : « ${line} ».`);
      continue;
    }
    const { text, comment: c } = splitComment(line.replace(/^[-*]\s+/, ''));
    if (!text) continue;
    if (inPending) {
      pending.push(text);
      continue;
    }
    const ev = parseEventLine(text);
    if (!ev) {
      warnings.push(`Pas de date lisible : « ${text} » → à placer.`);
      pending.push(text);
      continue;
    }
    const before = previousByLabel.get(ev.label);
    const id = before && !usedIds.has(before.id) ? before.id : newId('n');
    usedIds.add(id);
    const color = parseColor(c.couleur, FILL_BY_TEXT, warnings) ?? before?.color;
    const node: DiagramNode = { id, label: ev.label, x: 0, y: 0, color: color ?? DEFAULT_NODE_COLOR, date: ev.date };
    if (ev.endDate) node.endDate = ev.endDate;
    if (currentLane) node.laneId = currentLane;
    const box = pairsToBox(c, warnings);
    if (box) node.box = box;
    nodes.push(node);
  }

  const diagram: Diagram = { type: 'timeline', title, nodes, edges: [], lanes };
  if (defaults) diagram.defaults = defaults;
  if (pending.length) diagram.pending = pending;
  return { diagram, warnings };
}

interface ParsedItem {
  level: number; // 1 = enfant direct de la racine
  text: string;
  comment: Comment;
}

function treeFromMarkdown(
  body: string,
  type: DiagramType,
  defaults: Diagram['defaults'],
  previous: Diagram | undefined,
  warnings: string[],
): MarkdownImportResult {
  let rootText: string | undefined;
  let rootComment: Comment = {};
  const items: ParsedItem[] = [];
  const pending: string[] = [];
  let inPending = false;

  for (const raw of body.split('\n')) {
    if (!raw.trim()) continue;
    const heading = raw.match(/^\s*#\s+(.*)$/);
    if (heading) {
      if (rootText === undefined) {
        const { text, comment: c } = splitComment(heading[1]);
        rootText = text;
        rootComment = c;
      } else {
        warnings.push(`Deuxième titre ignoré : « ${heading[1].trim()} » (un arbre n'a qu'une racine).`);
      }
      continue;
    }
    const section = raw.match(/^\s*##\s+(.*)$/);
    if (section) {
      inPending = sectionOf(section[1]) === 'pending';
      if (!inPending) warnings.push(`Section « ${section[1].trim()} » ignorée dans un arbre.`);
      continue;
    }
    const bullet = raw.match(/^([ \t]*)[-*]\s+(.*)$/);
    if (bullet) {
      const { text, comment: c } = splitComment(bullet[2]);
      if (!text) continue;
      if (inPending) {
        pending.push(text);
        continue;
      }
      const indent = bullet[1].replace(/\t/g, '  ').length;
      items.push({ level: Math.floor(indent / 2) + 1, text, comment: c });
      continue;
    }
    const numbered = raw.match(/^\s*(\d+(?:\.\d+)*)\.?\s+(.*)$/);
    if (numbered && !inPending) {
      const { text, comment: c } = splitComment(numbered[2]);
      if (text) items.push({ level: numbered[1].split('.').length, text, comment: c });
      continue;
    }
    warnings.push(`Ligne ignorée : « ${raw.trim()} ».`);
  }

  // Pas de titre : un seul élément de premier niveau devient la racine, sinon on en crée une.
  if (rootText === undefined) {
    const topLevel = items.filter((i) => i.level === 1);
    if (topLevel.length === 1 && items[0] === topLevel[0]) {
      rootText = topLevel[0].text;
      rootComment = topLevel[0].comment;
      items.shift();
      for (const i of items) i.level -= 1;
    } else {
      rootText = previous?.title || 'Sans titre';
      warnings.push(`Aucun titre « # » : racine « ${rootText} » créée.`);
    }
  }

  const previousByLabel = new Map<string, DiagramNode>();
  for (const n of previous?.nodes ?? []) previousByLabel.set(cleanLabel(n.label), n);
  const usedIds = new Set<string>();
  const savedLayout: Record<string, { x: number; y: number }> = { ...previous?.layouts?.conceptmap };

  const makeNode = (text: string, c: Comment, parentId?: string): DiagramNode => {
    const before = previousByLabel.get(text);
    const id = before && !usedIds.has(before.id) ? before.id : newId('n');
    usedIds.add(id);
    const color = parseColor(c.couleur, FILL_BY_TEXT, warnings) ?? before?.color;
    const node: DiagramNode = { id, label: text, x: 0, y: 0, color: color ?? DEFAULT_NODE_COLOR, parentId };
    const sx = numberOr(c.x, undefined);
    const sy = numberOr(c.y, undefined);
    if (sx !== undefined && sy !== undefined) savedLayout[id] = { x: sx, y: sy };
    const box = pairsToBox(c, warnings);
    if (box) node.box = box;
    if (parentId) {
      const branch = pairsToLine(c, 'trait-couleur', warnings);
      if (branch) node.branch = branch;
    }
    return node;
  };

  const root = makeNode(rootText, rootComment);
  const nodes: DiagramNode[] = [root];
  const stack: DiagramNode[] = [root]; // stack[level] = parent courant à ce niveau
  for (const item of items) {
    const level = Math.min(item.level, stack.length); // un saut de niveau trop grand est rabattu
    if (level < item.level) warnings.push(`Indentation trop profonde pour « ${item.text} » : rattachée au niveau ${level}.`);
    const parent = stack[level - 1];
    const node = makeNode(item.text, item.comment, parent.id);
    nodes.push(node);
    stack.length = level;
    stack.push(node);
  }

  const diagram: Diagram = { type, title: root.label, nodes, edges: [] };
  if (defaults) diagram.defaults = defaults;
  if (pending.length) diagram.pending = pending;
  if (Object.keys(savedLayout).length) diagram.layouts = { conceptmap: savedLayout };
  return { diagram, warnings };
}

function readFrontMatter(text: string, warnings: string[]): { type?: DiagramType; defaults?: Diagram['defaults']; body: string } {
  const m = text.match(/^\s*---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!m) return { body: text };
  const values: Comment = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^\s*([^:\s]+)\s*:\s*(.*?)\s*$/);
    if (kv) values[kv[1].toLowerCase()] = kv[2];
  }
  const known: DiagramType[] = ['timeline', 'mindmap', 'hierarchy', 'conceptmap'];
  const type = known.find((k) => k === values.type);
  if (values.type && !type) warnings.push(`Type inconnu : « ${values.type} ».`);
  const line = pairsToLine({ trait: values.trait, 'épaisseur': values['épaisseur'] ?? values.epaisseur, couleur: values['couleur-trait'] }, 'couleur', warnings);
  const box = pairsToBox({ bordure: values.bordure, coins: values.coins, contour: values.contour }, warnings);
  const defaults = line || box ? { ...(line ? { line } : {}), ...(box ? { box } : {}) } : undefined;
  return { type, defaults, body: text.slice(m[0].length) };
}

function splitComment(item: string): { text: string; comment: Comment } {
  const c: Comment = {};
  const text = item
    .replace(/<!--\s*(.*?)\s*-->/g, (_, inner: string) => {
      for (const pair of inner.split(/\s+/)) {
        const idx = pair.indexOf(':');
        if (idx > 0) c[pair.slice(0, idx).toLowerCase()] = pair.slice(idx + 1);
      }
      return '';
    })
    .trim();
  return { text, comment: c };
}

function numberOr(value: string | undefined, fallback: number | undefined): number | undefined {
  if (value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Place les nouveaux concepts en grille, sous ceux qui existent déjà. */
function autoPlacer(existing: DiagramNode[]) {
  const startY = existing.length ? Math.max(...existing.map((n) => n.y)) + 140 : 40;
  let i = 0;
  return {
    next() {
      const col = i % 4;
      const row = Math.floor(i / 4);
      i += 1;
      return { x: 40 + col * 220, y: startY + row * 120 };
    },
  };
}
