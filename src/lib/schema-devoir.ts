// Atelier de conceptualisation : les réglages portés par l'activité
// (`Devoir.schema`) et ce qu'on en écrit en base. Partagé par les routes
// /api/devoirs et les formulaires.
import type { SchemaConfig } from '@/types/devoir';
import { DIAGRAM_TYPES, type DiagramType } from '@/types/diagram';

export const SCHEMA_PAR_DEFAUT: SchemaConfig = { typeDepart: 'conceptmap', typeLibre: true };

/** Normalise ce qu'envoie le client : type connu, booléen franc. */
export function schemaPourFirestore(raw: unknown): SchemaConfig {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const typeDepart = (DIAGRAM_TYPES as string[]).includes(o.typeDepart as string)
    ? (o.typeDepart as DiagramType)
    : SCHEMA_PAR_DEFAUT.typeDepart;
  return { typeDepart, typeLibre: o.typeLibre !== false };
}

/** Lecture tolérante d'une activité (absent = défauts). */
export function schemaDuDevoir(devoir: { schema?: SchemaConfig | null } | null | undefined): SchemaConfig {
  return devoir?.schema ? schemaPourFirestore(devoir.schema) : SCHEMA_PAR_DEFAUT;
}
