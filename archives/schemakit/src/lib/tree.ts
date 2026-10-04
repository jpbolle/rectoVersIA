/**
 * Outils pour les schémas en arbre (carte mentale, schéma hiérarchisé).
 * La structure vit dans `parentId` ; l'ordre des frères est l'ordre du tableau `nodes`.
 */
import type { Diagram, DiagramNode } from '@/types/diagram';

export const ROOT_KEY = '';

/** Enfants de chaque nœud, dans l'ordre du tableau. Clé `ROOT_KEY` = sans parent. */
export function childrenMap(nodes: DiagramNode[]): Map<string, DiagramNode[]> {
  const map = new Map<string, DiagramNode[]>();
  for (const n of nodes) {
    const key = n.parentId ?? ROOT_KEY;
    const list = map.get(key);
    if (list) list.push(n);
    else map.set(key, [n]);
  }
  return map;
}

/** La racine : le premier nœud sans parent. */
export function rootOf(nodes: DiagramNode[]): DiagramNode | undefined {
  return nodes.find((n) => !n.parentId);
}

/** Le nœud et toute sa descendance. */
export function subtreeIds(nodes: DiagramNode[], id: string): Set<string> {
  const children = childrenMap(nodes);
  const ids = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const current = stack.pop()!;
    if (ids.has(current)) continue;
    ids.add(current);
    for (const child of children.get(current) ?? []) stack.push(child.id);
  }
  return ids;
}

/** Profondeur de chaque nœud (racine = 0). */
export function depthMap(nodes: DiagramNode[]): Map<string, number> {
  const children = childrenMap(nodes);
  const depth = new Map<string, number>();
  const walk = (parentKey: string, d: number) => {
    for (const child of children.get(parentKey) ?? []) {
      depth.set(child.id, d);
      walk(child.id, d + 1);
    }
  };
  walk(ROOT_KEY, 0);
  return depth;
}

/**
 * Numérotation du schéma hiérarchisé, calculée à l'affichage : la racine porte le
 * titre sans numéro, ses enfants sont 1, 2, 3…, puis 1.1, 1.2, 1.2.1…
 */
export function numberMap(nodes: DiagramNode[]): Map<string, string> {
  const children = childrenMap(nodes);
  const numbers = new Map<string, string>();
  const walk = (parentId: string, prefix: string) => {
    (children.get(parentId) ?? []).forEach((child, i) => {
      const number = prefix ? `${prefix}.${i + 1}` : String(i + 1);
      numbers.set(child.id, number);
      walk(child.id, number);
    });
  };
  const root = rootOf(nodes);
  if (root) {
    numbers.set(root.id, '');
    walk(root.id, '');
  }
  return numbers;
}

/** Insère `node` juste après `afterId` dans le tableau (ou à la fin). */
export function insertAfter(nodes: DiagramNode[], node: DiagramNode, afterId?: string): DiagramNode[] {
  const index = afterId ? nodes.findIndex((n) => n.id === afterId) : -1;
  if (index < 0) return [...nodes, node];
  return [...nodes.slice(0, index + 1), node, ...nodes.slice(index + 1)];
}

/** Insère `node` après le dernier descendant de `parentId`, pour rester groupé. */
export function insertAsLastChild(nodes: DiagramNode[], node: DiagramNode): DiagramNode[] {
  const parentId = node.parentId;
  if (!parentId) return [...nodes, node];
  const ids = subtreeIds(nodes, parentId);
  let lastIndex = -1;
  nodes.forEach((n, i) => {
    if (ids.has(n.id)) lastIndex = i;
  });
  return insertAfter(nodes, node, lastIndex >= 0 ? nodes[lastIndex].id : undefined);
}

export function isTreeType(type: Diagram['type']): boolean {
  return type === 'mindmap' || type === 'hierarchy';
}
