// Atelier de conceptualisation : les réglages portés par l'activité
// (`Devoir.schema`) et ce qu'on en écrit en base. Partagé par les routes
// /api/devoirs et les formulaires.
import type { SchemaConfig, SchemaCorrige } from '@/types/devoir';
import { DIAGRAM_TYPES, type DiagramType } from '@/types/diagram';
import { DIAGRAM_JSON_MAX, estDiagramPlausible } from '@/lib/schemas-personnels';

export const SCHEMA_PAR_DEFAUT: SchemaConfig = { typeDepart: 'conceptmap', typeLibre: true };

/** Normalise ce qu'envoie le client : type connu, booléen franc. */
export function schemaPourFirestore(raw: unknown): SchemaConfig {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const typeDepart = (DIAGRAM_TYPES as string[]).includes(o.typeDepart as string)
    ? (o.typeDepart as DiagramType)
    : SCHEMA_PAR_DEFAUT.typeDepart;
  const config: SchemaConfig = { typeDepart, typeLibre: o.typeLibre !== false };
  // Point de départ : n'écrire que ce qui existe (Firestore refuse `undefined`)
  const central = typeof o.conceptCentral === 'string' ? o.conceptCentral.trim().slice(0, CONCEPT_MAX) : '';
  if (central) config.conceptCentral = central;
  const concepts = nettoyerConcepts(o.concepts);
  if (concepts.length) {
    config.concepts = concepts;
    if (o.melanger === true) config.melanger = true;
  }
  const corrige = corrigePourFirestore(o.corrige);
  if (corrige) config.corrige = corrige;
  return config;
}

/** Le corrigé copié dans l'activité : un schéma lisible, de taille raisonnable. */
export function corrigePourFirestore(raw: unknown): SchemaCorrige | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (!estDiagramPlausible(o.diagram)) return null;
  if (JSON.stringify(o.diagram).length > DIAGRAM_JSON_MAX) return null;
  return {
    sourceId: typeof o.sourceId === 'string' ? o.sourceId : '',
    titre: (typeof o.titre === 'string' ? o.titre.trim() : '').slice(0, 120) || o.diagram.title || 'Corrigé',
    diagram: o.diagram,
  };
}

/** Les réglages d'une activité SANS le corrigé — ce que reçoit l'élève. */
export function schemaSansCorrige(config: SchemaConfig | null): SchemaConfig | null {
  if (!config?.corrige) return config;
  const { corrige: _corrige, ...reste } = config;
  void _corrige;
  return reste;
}

const CONCEPT_MAX = 120;
const CONCEPTS_MAX = 40;

/** Les concepts donnés par le prof : textes non vides, sans doublon, bornés. */
export function nettoyerConcepts(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const vus = new Set<string>();
  const out: string[] = [];
  for (const c of raw) {
    if (typeof c !== 'string') continue;
    const t = c.trim().slice(0, CONCEPT_MAX);
    if (!t || vus.has(t.toLowerCase())) continue;
    vus.add(t.toLowerCase());
    out.push(t);
    if (out.length >= CONCEPTS_MAX) break;
  }
  return out;
}

/**
 * Mélange STABLE : le même ordre à chaque ouverture tant que l'élève n'a rien
 * enregistré (le schéma de départ est recalculé à chaque chargement d'une copie
 * vierge). Graine = les concepts eux-mêmes.
 */
export function melangerConcepts(concepts: string[]): string[] {
  let graine = 0;
  for (const ch of concepts.join('|')) graine = (Math.imul(graine, 31) + ch.charCodeAt(0)) | 0;
  const alea = () => {
    // mulberry32
    graine = (graine + 0x6d2b79f5) | 0;
    let t = graine;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...concepts];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(alea() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Lecture tolérante d'une activité (absent = défauts). */
export function schemaDuDevoir(devoir: { schema?: SchemaConfig | null } | null | undefined): SchemaConfig {
  return devoir?.schema ? schemaPourFirestore(devoir.schema) : SCHEMA_PAR_DEFAUT;
}
