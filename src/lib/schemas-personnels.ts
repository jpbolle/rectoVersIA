// Schémas personnels (collection `schemasPersonnels`) — ce que partagent les
// routes `/api/schemas/personnel` et l'onglet « Mes schémas » de Mes ressources.
// Un fichier de route Next.js n'a pas le droit d'exporter autre chose que ses
// handlers : les constantes et les aides vivent ici.
import { DIAGRAM_TYPES, type Diagram, type DiagramType } from '@/types/diagram';

export const SCHEMAS_PERSONNELS = 'schemasPersonnels';

// Une vignette est un confort, pas une donnée : au-delà, on la laisse tomber
// plutôt que de gonfler le document (plafond Firestore : 1 Mo).
export const VIGNETTE_MAX = 200_000;
// Un schéma ne contient ni image ni audio : quelques dizaines de Ko au plus.
// Au-delà, c'est une erreur (ou un abus), pas un gros schéma.
export const DIAGRAM_JSON_MAX = 600_000;

export interface SchemaPersonnelMeta {
  id: string;
  titre: string;
  type: DiagramType;
  thumbnail: string | null;
  createdAt: string;
  updatedAt: string;
  // Bibliothèque du prof (Mes Ressources › Conceptualisations, 2026-10-11)
  archive?: boolean;
  // Corrigé privé : absent du bloc « des professeurs » des collègues (absent =
  // partagé). Plan 2026-10-13-ressources-privees.
  prive?: boolean;
}

export function estTypeSchema(t: unknown): t is DiagramType {
  return typeof t === 'string' && (DIAGRAM_TYPES as string[]).includes(t);
}

/** Un `Diagram` reçu du client est-il plausible ? (forme, pas contenu) */
export function estDiagramPlausible(d: unknown): d is Diagram {
  if (!d || typeof d !== 'object') return false;
  const o = d as Record<string, unknown>;
  return estTypeSchema(o.type) && typeof o.title === 'string' && Array.isArray(o.nodes) && Array.isArray(o.edges);
}

/** Le schéma de départ d'un type : un arbre naît avec sa racine, les autres vides. */
export function diagramVide(type: DiagramType, titre: string): Diagram {
  const base: Diagram = { type, title: titre, nodes: [], edges: [] };
  if (type === 'mindmap' || type === 'hierarchy') {
    base.nodes = [{ id: 'n1', label: titre, x: 0, y: 0 }];
  }
  if (type === 'timeline') {
    base.lanes = [];
  }
  return base;
}

/**
 * Le schéma de départ d'une activité (2026-10-11) : le CONCEPT CENTRAL posé
 * dans le canevas — boîte au centre (carte conceptuelle, schéma libre),
 * racine (carte mentale, hiérarchie), titre (ligne du temps) — et les autres
 * concepts en étiquettes « À placer ».
 */
export function diagramDeDepart(
  type: DiagramType,
  titre: string,
  depart: { conceptCentral?: string; concepts?: string[] }
): Diagram {
  const central = depart.conceptCentral?.trim() || '';
  const base = diagramVide(type, type === 'timeline' && central ? central : titre);
  if (central && (type === 'mindmap' || type === 'hierarchy')) {
    base.nodes = [{ id: 'n1', label: central, x: 0, y: 0 }];
  }
  if (central && (type === 'conceptmap' || type === 'libre')) {
    base.nodes = [{ id: 'n1', label: central, x: 0, y: 0 }];
  }
  if (depart.concepts?.length) base.pending = [...depart.concepts];
  return base;
}
