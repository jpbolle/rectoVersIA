import { Extension, type Editor } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PmNode } from '@tiptap/pm/model';
import { diffWords } from 'diff';
import type { AiSuggestion, AiSuggestionType, AiSuggestionItem } from '@/types/ai-suggestions';

export const profAiDecorationsKey = new PluginKey('profAiDecorations');

/* ── Constantes ── */

const BUBBLE_LETTERS: Record<AiSuggestionType, string> = {
  ortho: 'O',
  ponctu: 'P',
  synt: 'S',
  lex: 'L',
};

const BUBBLE_COLORS: Record<AiSuggestionType, string> = {
  ortho: '#e53935',
  ponctu: '#1e88e5',
  synt: '#ff9800',
  lex: '#5d4037',
};

const BUBBLE_COLORS_DISMISSED: Record<AiSuggestionType, string> = {
  ortho: '#ef9a9a',
  ponctu: '#90caf9',
  synt: '#ffcc80',
  lex: '#a1887f',
};

/* ── Utilitaires ── */

/**
 * Trouve la position ProseMirror d'un texte cible dans un paragraphe donné.
 */
function findTextInParagraph(
  doc: PmNode,
  targetText: string,
  paragraphIndex: number,
): { from: number; to: number } | null {
  let currentParagraph = 0;
  let result: { from: number; to: number } | null = null;

  doc.descendants((node, pos) => {
    if (result) return false;

    if (node.isBlock && node.type.name !== 'doc') {
      if (currentParagraph === paragraphIndex) {
        const blockText = node.textContent;
        const index = blockText.indexOf(targetText);
        if (index !== -1) {
          let textOffset = 0;
          let startPos = -1;

          node.descendants((child, childPos) => {
            if (startPos !== -1) return false;
            if (child.isText && child.text) {
              const childStart = textOffset;
              const childEnd = textOffset + child.text.length;
              if (index >= childStart && index < childEnd) {
                startPos = pos + 1 + childPos + (index - childStart);
              }
              textOffset = childEnd;
            }
          });

          if (startPos !== -1) {
            result = { from: startPos, to: startPos + targetText.length };
          }
        }
        return false;
      }
      currentParagraph++;
      return false;
    }
  });

  return result;
}

/**
 * Trouve la position de début d'un paragraphe par son index.
 */
function getParagraphStart(doc: PmNode, paragraphIndex: number): number | null {
  let currentParagraph = 0;
  let result: number | null = null;

  doc.descendants((node, pos) => {
    if (result !== null) return false;

    if (node.isBlock && node.type.name !== 'doc') {
      if (currentParagraph === paragraphIndex) {
        result = pos + 1;
        return false;
      }
      currentParagraph++;
      return false;
    }
  });

  return result;
}

/**
 * Extrait le texte brut d'un HTML.
 */
function stripHtml(html: string): string {
  if (typeof document === 'undefined') return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  // Remplacer les <br> et les blocs par des newlines
  const blocks = div.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, div');
  blocks.forEach((block) => {
    block.insertAdjacentText('afterend', '\n');
  });
  return (div.textContent || '').replace(/\n+$/, '');
}

/**
 * Extrait le texte brut du document ProseMirror avec un mapping position.
 * positions[charIndex] = ProseMirror position (ou null pour les séparateurs de bloc)
 */
function getDocTextWithPositions(doc: PmNode): {
  text: string;
  positions: (number | null)[];
} {
  const textParts: string[] = [];
  const positions: (number | null)[] = [];
  let isFirstBlock = true;

  doc.descendants((node, pos) => {
    if (node.isBlock && node.type.name !== 'doc') {
      if (!isFirstBlock) {
        textParts.push('\n');
        positions.push(null);
      }
      isFirstBlock = false;

      node.descendants((child, childPos) => {
        if (child.isText && child.text) {
          for (let i = 0; i < child.text.length; i++) {
            textParts.push(child.text[i]);
            positions.push(pos + 1 + childPos + i);
          }
        }
      });

      return false;
    }
  });

  return { text: textParts.join(''), positions };
}

/**
 * Découpe un range de caractères en ranges ProseMirror contigus (gérant les newlines).
 */
function getDecorationRanges(
  positions: (number | null)[],
  startChar: number,
  length: number,
): { from: number; to: number }[] {
  const ranges: { from: number; to: number }[] = [];
  let rangeStart: number | null = null;
  let rangeLast: number | null = null;

  for (let i = startChar; i < startChar + length && i < positions.length; i++) {
    const pos = positions[i];
    if (pos === null) {
      if (rangeStart !== null && rangeLast !== null) {
        ranges.push({ from: rangeStart, to: rangeLast + 1 });
        rangeStart = null;
        rangeLast = null;
      }
    } else {
      if (rangeStart === null) {
        rangeStart = pos;
      }
      rangeLast = pos;
    }
  }

  if (rangeStart !== null && rangeLast !== null) {
    ranges.push({ from: rangeStart, to: rangeLast + 1 });
  }

  return ranges;
}

/**
 * Trouve la position PM la plus proche (non-null) à partir d'un index de caractère.
 */
function findNearestValidPosition(
  positions: (number | null)[],
  charIdx: number,
): number | null {
  // Chercher en avant puis en arrière
  for (let i = charIdx; i < positions.length; i++) {
    if (positions[i] !== null) return positions[i]!;
  }
  for (let i = charIdx - 1; i >= 0; i--) {
    if (positions[i] !== null) return positions[i]! + 1;
  }
  return null;
}

/* ── Bulles ── */

/**
 * Crée un élément DOM pour une bulle IA prof.
 */
function createProfBubbleDOM(
  type: AiSuggestionType,
  item: AiSuggestionItem,
  offsetIndex: number,
): HTMLElement {
  const anchor = document.createElement('span');
  anchor.contentEditable = 'false';
  anchor.style.cssText = [
    'display:inline-block',
    'width:0',
    'height:0',
    'overflow:visible',
    'vertical-align:baseline',
    'position:relative',
    'pointer-events:none',
  ].join(';');

  const leftOffset = offsetIndex * 24;
  const color = item.dismissed ? BUBBLE_COLORS_DISMISSED[type] : BUBBLE_COLORS[type];
  const opacity = item.dismissed ? '0.5' : '1';

  const el = document.createElement('span');
  el.setAttribute('data-ai-bubble-type', type);
  el.setAttribute('data-ai-bubble-item', item.id);
  el.setAttribute('data-ai-dismissed', String(item.dismissed));
  el.setAttribute('data-ai-bubble-content', (item.content || '').slice(0, 500));
  el.textContent = BUBBLE_LETTERS[type];
  el.style.cssText = [
    'position:absolute',
    'bottom:20px',
    `left:${leftOffset}px`,
    `background:${color}`,
    `opacity:${opacity}`,
    'color:#fff',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'width:22px',
    'height:22px',
    'border-radius:50%',
    'border:2px solid #fff',
    'font-size:10px',
    'font-weight:800',
    'line-height:1',
    'text-indent:0',
    'letter-spacing:normal',
    'text-align:center',
    'white-space:nowrap',
    'cursor:pointer',
    'user-select:none',
    'box-shadow:0 1px 4px rgba(0,0,0,0.25)',
    'font-family:-apple-system,BlinkMacSystemFont,sans-serif',
    'pointer-events:auto',
    'z-index:10',
  ].join(';');

  anchor.appendChild(el);
  return anchor;
}

/**
 * Crée les décorations (bulles) pour toutes les suggestions IA côté prof.
 * Inclut les dismissed (couleur plus claire).
 */
function createProfBubbleDecorations(
  doc: PmNode,
  suggestions: Record<AiSuggestionType, AiSuggestion | null>,
): Decoration[] {
  const paragraphs: { start: number; length: number }[] = [];
  doc.descendants((node, pos) => {
    if (node.isBlock && node.type.name !== 'doc') {
      paragraphs.push({ start: pos + 1, length: node.textContent.length });
      return false;
    }
  });

  const allBubbles: { pos: number; type: AiSuggestionType; item: AiSuggestionItem }[] = [];

  for (const type of ['ortho', 'ponctu', 'synt', 'lex'] as const) {
    const suggestion = suggestions[type];
    if (!suggestion) continue;

    const byPara = new Map<number, AiSuggestionItem[]>();
    for (const item of suggestion.suggestions) {
      const list = byPara.get(item.paragraphIndex) || [];
      list.push(item);
      byPara.set(item.paragraphIndex, list);
    }

    for (const [paraIdx, items] of byPara) {
      const para = paragraphs[paraIdx];
      if (!para) continue;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        let widgetPos: number;

        if (item.targetText) {
          const textPos = findTextInParagraph(doc, item.targetText, item.paragraphIndex);
          if (textPos) {
            widgetPos = textPos.from;
          } else {
            // Fallback : début du paragraphe
            const paraStart = getParagraphStart(doc, item.paragraphIndex);
            widgetPos = paraStart ?? para.start;
          }
        } else {
          const fraction = (i + 1) / (items.length + 1);
          const offset = Math.min(
            Math.floor(para.length * fraction),
            Math.max(para.length - 1, 0),
          );
          widgetPos = para.start + offset;
        }

        allBubbles.push({ pos: widgetPos, type, item });
      }
    }
  }

  // Trier par position pour la détection de collisions
  allBubbles.sort((a, b) => a.pos - b.pos);

  const COLLISION_THRESHOLD = 2;
  const offsets: number[] = [];
  for (let i = 0; i < allBubbles.length; i++) {
    let offsetIdx = 0;
    for (let j = 0; j < i; j++) {
      if (Math.abs(allBubbles[i].pos - allBubbles[j].pos) <= COLLISION_THRESHOLD) {
        offsetIdx = offsets[j] + 1;
      }
    }
    offsets.push(offsetIdx);
  }

  const decorations: Decoration[] = [];
  for (let i = 0; i < allBubbles.length; i++) {
    const bubble = allBubbles[i];
    const offsetIdx = offsets[i];
    decorations.push(
      Decoration.widget(
        bubble.pos,
        () => createProfBubbleDOM(bubble.type, bubble.item, offsetIdx),
        {
          side: -1,
          key: `prof-bubble-${bubble.type}-${bubble.item.id}`,
        },
      ),
    );
  }

  return decorations;
}

/* ── Diff ── */

/**
 * Crée les décorations de diff (gras pour ajouté, barré pour supprimé).
 */
function createDiffDecorations(
  doc: PmNode,
  textSnapshot: string,
): Decoration[] {
  const oldText = stripHtml(textSnapshot);
  const { text: newText, positions } = getDocTextWithPositions(doc);

  if (!oldText || !newText) return [];

  const changes = diffWords(oldText, newText);
  const decorations: Decoration[] = [];
  let charIdx = 0;

  for (const change of changes) {
    if (change.added) {
      const ranges = getDecorationRanges(positions, charIdx, change.value.length);
      for (const { from, to } of ranges) {
        decorations.push(
          Decoration.inline(from, to, {
            style: 'font-weight:700; color:#2a4d73;',
            class: 'diff-added',
          }),
        );
      }
      charIdx += change.value.length;
    } else if (change.removed) {
      const insertPos = findNearestValidPosition(positions, charIdx);
      if (insertPos !== null) {
        const removedText = change.value.replace(/\n/g, ' ');
        decorations.push(
          Decoration.widget(
            insertPos,
            () => {
              const span = document.createElement('span');
              span.contentEditable = 'false';
              span.setAttribute('data-diff-removed', '');
              span.textContent = removedText;
              span.style.cssText = [
                'text-decoration:line-through',
                'color:#999',
                'font-style:italic',
                'opacity:0.7',
                'pointer-events:none',
                'margin:0 0.4em',
              ].join(';');
              return span;
            },
            { side: -1, key: `diff-removed-${insertPos}-${removedText.slice(0, 10)}` },
          ),
        );
      }
    } else {
      charIdx += change.value.length;
    }
  }

  return decorations;
}

/**
 * Récupère le textSnapshot le plus ancien parmi les suggestions.
 */
function getEarliestSnapshot(
  suggestions: Record<AiSuggestionType, AiSuggestion | null>,
): string | null {
  let earliest: AiSuggestion | null = null;

  for (const suggestion of Object.values(suggestions)) {
    if (!suggestion || !suggestion.textSnapshot) continue;
    if (!earliest || suggestion.createdAt < earliest.createdAt) {
      earliest = suggestion;
    }
  }

  return earliest?.textSnapshot || null;
}

/* ── Extension ProseMirror ── */

export const ProfAiDecorationsExtension = Extension.create({
  name: 'profAiDecorations',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: profAiDecorationsKey,
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(tr, old) {
            const meta = tr.getMeta(profAiDecorationsKey);
            if (meta !== undefined) return meta;
            return old.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state) ?? DecorationSet.empty;
          },
        },
      }),
    ];
  },
});

/**
 * Met à jour toutes les décorations IA côté prof (bulles + diff).
 */
export function updateProfAiDecorations(
  editor: Editor,
  suggestions: Record<AiSuggestionType, AiSuggestion | null>,
) {
  const { doc } = editor.state;

  // 1. Bulles
  const bubbleDecos = createProfBubbleDecorations(doc, suggestions);

  // 2. Diff (utilise le textSnapshot le plus ancien)
  const earliest = getEarliestSnapshot(suggestions);
  const diffDecos = earliest ? createDiffDecorations(doc, earliest) : [];

  // 3. Combiner
  const allDecos = [...bubbleDecos, ...diffDecos];
  const decoSet = DecorationSet.create(doc, allDecos);

  const tr = editor.state.tr.setMeta(profAiDecorationsKey, decoSet);
  editor.view.dispatch(tr);
}
