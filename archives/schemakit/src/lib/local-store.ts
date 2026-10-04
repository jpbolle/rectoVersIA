/**
 * « Mes schémas » dans le navigateur (localStorage) — le stockage de la MAQUETTE.
 * Décision du 2026-09-13 : Recto-versIA fournira la vraie base ; ici on valide
 * l'expérience « je retrouve mes schémas et j'en ouvre un ».
 * Tout est protégé par try/catch : le stockage peut être vide, plein ou bloqué.
 */
import { createEmptyDiagram, newId, type Diagram, type DiagramType } from '@/types/diagram';

const INDEX_KEY = 'schemakit.diagrams';
const DIAGRAM_KEY = (id: string) => `schemakit.diagram.${id}`;
const THUMB_KEY = (id: string) => `schemakit.thumb.${id}`;

export interface SavedDiagramMeta {
  id: string;
  title: string;
  type: DiagramType;
  updatedAt: number; // ms depuis 1970
}

function readIndex(): SavedDiagramMeta[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    const list = raw ? (JSON.parse(raw) as SavedDiagramMeta[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeIndex(list: SavedDiagramMeta[]) {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(list));
  } catch {
    /* stockage plein ou bloqué : la liste en mémoire reste valable pour la session */
  }
}

export function listDiagrams(): SavedDiagramMeta[] {
  return readIndex().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function loadDiagram(id: string): Diagram | null {
  try {
    const raw = localStorage.getItem(DIAGRAM_KEY(id));
    return raw ? (JSON.parse(raw) as Diagram) : null;
  } catch {
    return null;
  }
}

export function loadThumbnail(id: string): string | null {
  try {
    return localStorage.getItem(THUMB_KEY(id));
  } catch {
    return null;
  }
}

/** Enregistre le schéma et met l'index à jour. Renvoie false si le stockage refuse. */
export function saveDiagram(id: string, diagram: Diagram): boolean {
  try {
    localStorage.setItem(DIAGRAM_KEY(id), JSON.stringify(diagram));
  } catch {
    return false;
  }
  const meta: SavedDiagramMeta = { id, title: diagram.title || 'Sans titre', type: diagram.type, updatedAt: Date.now() };
  const list = readIndex().filter((m) => m.id !== id);
  writeIndex([meta, ...list]);
  return true;
}

export function saveThumbnail(id: string, dataUrl: string) {
  try {
    localStorage.setItem(THUMB_KEY(id), dataUrl);
  } catch {
    /* une vignette en moins n'est pas grave */
  }
}

export function createDiagram(type: DiagramType, title: string): SavedDiagramMeta {
  const id = newId('d');
  const diagram = createEmptyDiagram(type, title);
  if (type === 'mindmap' || type === 'hierarchy') {
    diagram.nodes.push({ id: newId('n'), label: title, x: 0, y: 0 });
  }
  saveDiagram(id, diagram);
  return { id, title, type, updatedAt: Date.now() };
}

export function duplicateDiagram(id: string): SavedDiagramMeta | null {
  const diagram = loadDiagram(id);
  if (!diagram) return null;
  const copy: Diagram = { ...diagram, title: `${diagram.title || 'Sans titre'} (copie)` };
  const newMetaId = newId('d');
  saveDiagram(newMetaId, copy);
  const thumb = loadThumbnail(id);
  if (thumb) saveThumbnail(newMetaId, thumb);
  return { id: newMetaId, title: copy.title, type: copy.type, updatedAt: Date.now() };
}

export function deleteDiagram(id: string) {
  try {
    localStorage.removeItem(DIAGRAM_KEY(id));
    localStorage.removeItem(THUMB_KEY(id));
  } catch {
    /* ignoré */
  }
  writeIndex(readIndex().filter((m) => m.id !== id));
}

/** Préférences d'affichage (pas des données du schéma). */
export function readPreference(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(`schemakit.pref.${key}`);
    return raw === null ? fallback : raw === '1';
  } catch {
    return fallback;
  }
}

const PREF_EVENT = 'schemakit:pref';

export function writePreference(key: string, value: boolean) {
  try {
    localStorage.setItem(`schemakit.pref.${key}`, value ? '1' : '0');
  } catch {
    /* ignoré */
  }
  window.dispatchEvent(new Event(PREF_EVENT));
}

/** Pour `useSyncExternalStore` : prévient quand une préférence change (ici ou dans un autre onglet). */
export function subscribePreferences(callback: () => void): () => void {
  window.addEventListener(PREF_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(PREF_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}
