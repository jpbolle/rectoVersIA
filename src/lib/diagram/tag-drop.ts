/**
 * Glisser-déposer des tags « à placer » sur une boîte (HTML5 drag & drop).
 * Un tag est un texte ; s'il a la forme d'un lien « A → mot → B », déposé sur A ou sur B
 * il se réduit à ce qui manque (« mot B » ou « A (mot) »).
 */
import type { DragEvent } from 'react';

export const TAG_MIME = 'text/x-schemakit-tag';
const ARROW_SPLIT = /\s*(?:→|—>|-+>)\s*/;

export function setTagData(e: DragEvent, text: string) {
  e.dataTransfer.setData(TAG_MIME, text);
  e.dataTransfer.setData('text/plain', text);
  e.dataTransfer.effectAllowed = 'move';
}

export function hasTagData(e: DragEvent): boolean {
  return Array.from(e.dataTransfer.types).includes(TAG_MIME);
}

export function readTagData(e: DragEvent): string | null {
  const text = e.dataTransfer.getData(TAG_MIME);
  return text ? text : null;
}

/** Le texte de la nouvelle boîte quand `tag` est déposé sur une boîte nommée `targetLabel`. */
export function labelForDroppedTag(tag: string, targetLabel: string): string {
  const parts = tag.split(ARROW_SPLIT).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2 || parts.length > 3) return tag;
  const [a, ...rest] = parts;
  const b = rest[rest.length - 1];
  const word = rest.length === 2 ? rest[0] : '';
  const norm = (s: string) => s.trim().toLowerCase();
  if (norm(targetLabel) === norm(a)) return word ? `${word} ${b}` : b;
  if (norm(targetLabel) === norm(b)) return word ? `${a} (${word})` : a;
  return tag;
}
