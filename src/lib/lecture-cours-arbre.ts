// L'arbre d'une phrase (section « Des phrases à la loupe ») : de la forme
// emboîtée produite par Claude au format `Diagram` du moteur de schémas
// (type hierarchy — les positions sont calculées par l'éditeur, x/y = 0).

import type { Diagram, DiagramNode } from '@/types/diagram';
import type { NoeudArbre } from '@/types/lecture-cours';

const NOEUDS_MAX = 24;
const LABEL_MAX = 80;

export function arbreVersDiagram(racine: unknown, titre: string): Diagram | null {
  if (!racine || typeof racine !== 'object') return null;
  const nodes: DiagramNode[] = [];
  let compteur = 0;

  const visiter = (n: NoeudArbre, parentId?: string) => {
    if (compteur >= NOEUDS_MAX) return;
    const label = typeof n.label === 'string' ? n.label.trim().slice(0, LABEL_MAX) : '';
    if (!label) return;
    const id = `n${++compteur}`;
    nodes.push(parentId ? { id, label, x: 0, y: 0, parentId } : { id, label, x: 0, y: 0 });
    if (Array.isArray(n.enfants)) n.enfants.forEach((e) => e && typeof e === 'object' && visiter(e, id));
  };
  visiter(racine as NoeudArbre);

  if (nodes.length === 0) return null;
  return { type: 'hierarchy', title: titre.slice(0, 60), nodes, edges: [] };
}
