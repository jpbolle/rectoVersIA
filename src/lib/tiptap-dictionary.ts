// Surlignage « dictionnaire » : mots cliqués par l'élève quand l'aide dictionnaire
// est active. Décorations ProseMirror de session — jamais enregistrées dans le
// contenu remis au prof.

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorView } from '@tiptap/pm/view';
import type { Editor } from '@tiptap/react';

const dictHighlightKey = new PluginKey<DecorationSet>('dictHighlight');

interface DictHighlightMeta {
  type: 'add' | 'clear';
  from?: number;
  to?: number;
  word?: string;
}

export const DictHighlightExtension = Extension.create({
  name: 'dictHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: dictHighlightKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            // Suivre les modifications du document (insertion/suppression de texte)
            let mapped = set.map(tr.mapping, tr.doc);
            const meta = tr.getMeta(dictHighlightKey) as DictHighlightMeta | undefined;
            if (meta?.type === 'add' && meta.from !== undefined && meta.to !== undefined) {
              const deco = Decoration.inline(meta.from, meta.to, {
                class: 'dict-highlight',
                'data-dict-word': meta.word || '',
              });
              mapped = mapped.add(tr.doc, [deco]);
            }
            if (meta?.type === 'clear') {
              mapped = DecorationSet.empty;
            }
            return mapped;
          },
        },
        props: {
          decorations(state) {
            return dictHighlightKey.getState(state);
          },
        },
      }),
    ];
  },
});

export function addDictHighlight(editor: Editor, from: number, to: number, word: string) {
  const meta: DictHighlightMeta = { type: 'add', from, to, word };
  editor.view.dispatch(editor.state.tr.setMeta(dictHighlightKey, meta));
}

export function clearDictHighlights(editor: Editor) {
  const meta: DictHighlightMeta = { type: 'clear' };
  editor.view.dispatch(editor.state.tr.setMeta(dictHighlightKey, meta));
}

// Lettres (accents compris) et trait d'union — l'apostrophe sépare (l'école → école)
const WORD_CHAR = /[\p{L}\p{M}-]/u;

/**
 * Étend une position dans un texte jusqu'aux frontières du mot.
 * Retourne les bornes et le mot, ou null si trop court.
 */
export function expandWordInText(
  text: string,
  offset: number
): { start: number; end: number; word: string } | null {
  if (offset < 0 || offset > text.length) return null;

  let start = offset;
  let end = offset;
  while (start > 0 && WORD_CHAR.test(text[start - 1])) start--;
  while (end < text.length && WORD_CHAR.test(text[end])) end++;

  const word = text.slice(start, end).replace(/^-+|-+$/g, '');
  if (word.length < 2) return null;

  return { start, end, word };
}

/**
 * Trouve le mot situé sous le clic (coordonnées écran).
 * Retourne la plage de positions ProseMirror et le mot, ou null.
 */
export function findWordAtCoords(
  view: EditorView,
  coords: { left: number; top: number }
): { from: number; to: number; word: string } | null {
  const posInfo = view.posAtCoords(coords);
  if (!posInfo) return null;

  const $pos = view.state.doc.resolve(posInfo.pos);
  const parent = $pos.parent;
  if (!parent.isTextblock) return null;

  const blockStart = $pos.start();
  const blockEnd = $pos.end();
  // ￼ pour les nœuds non-texte : 1 caractère = 1 position, les offsets restent alignés
  const text = view.state.doc.textBetween(blockStart, blockEnd, undefined, '￼');
  const found = expandWordInText(text, posInfo.pos - blockStart);
  if (!found) return null;

  return { from: blockStart + found.start, to: blockStart + found.end, word: found.word };
}
