import { Extension, type Editor } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PmNode } from '@tiptap/pm/model';
import type { AiSuggestion, AiSuggestionType, AiSuggestionItem } from '@/types/ai-suggestions';

export const aiDecorationsKey = new PluginKey('aiDecorations');

/**
 * Trouve la position ProseMirror d'un texte cible dans un paragraphe donné.
 * Retourne { from, to } ou null si non trouvé.
 */
function findTextInParagraph(
  doc: PmNode,
  targetText: string,
  paragraphIndex: number,
): { from: number; to: number } | null {
  let currentParagraph = 0;
  let result: { from: number; to: number } | null = null;

  doc.descendants((node, pos) => {
    if (result) return false; // déjà trouvé

    // On ne compte que les noeuds de bloc de premier niveau
    if (node.isBlock && node.type.name !== 'doc') {
      if (currentParagraph === paragraphIndex) {
        // Chercher le targetText dans ce bloc
        const blockText = node.textContent;
        const index = blockText.indexOf(targetText);
        if (index !== -1) {
          // Calculer la position absolue dans le document
          // pos est la position du noeud bloc, +1 pour entrer dans le contenu
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
        return false; // ne pas descendre plus loin
      }
      currentParagraph++;
      return false; // passer au bloc suivant
    }
  });

  return result;
}

/**
 * Crée un DecorationSet à partir des suggestions IA de type synt/lex.
 */
export function createAiDecorations(
  doc: PmNode,
  items: AiSuggestionItem[],
  type: 'synt' | 'lex',
): DecorationSet {
  const decorations: Decoration[] = [];

  for (const item of items) {
    if (item.dismissed || !item.targetText) continue;

    const pos = findTextInParagraph(doc, item.targetText, item.paragraphIndex);
    if (!pos) continue;

    const className = type === 'synt' ? 'ai-deco-syntax' : 'ai-deco-lexical';

    decorations.push(
      Decoration.inline(pos.from, pos.to, {
        class: className,
        'data-ai-suggestion-id': item.id,
        'data-ai-type': type,
      })
    );
  }

  return DecorationSet.create(doc, decorations);
}

/**
 * Extension Tiptap qui gère les décorations IA (synt/lex).
 * Les décorations sont purement visuelles et ne modifient pas le contenu du document.
 */
export const AiDecorationsExtension = Extension.create({
  name: 'aiDecorations',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: aiDecorationsKey,
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(tr, old) {
            // Vérifier si on a reçu de nouvelles décorations via metadata
            const meta = tr.getMeta(aiDecorationsKey);
            if (meta !== undefined) return meta;
            // Mapper les décorations existantes aux nouvelles positions (si le doc change)
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
 * Met à jour les décorations IA dans l'éditeur.
 * Appeler cette fonction après avoir reçu des suggestions ou au chargement.
 */
export function updateAiDecorations(
  editor: Editor,
  items: AiSuggestionItem[],
  type: 'synt' | 'lex',
) {
  const { doc } = editor.state;
  const decoSet = createAiDecorations(doc, items, type);
  const tr = editor.state.tr.setMeta(aiDecorationsKey, decoSet);
  editor.view.dispatch(tr);
}

/**
 * Efface toutes les décorations IA.
 */
export function clearAiDecorations(editor: Editor) {
  const tr = editor.state.tr.setMeta(aiDecorationsKey, DecorationSet.empty);
  editor.view.dispatch(tr);
}

/* ── Bulles inline + décorations combinées ── */

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

/**
 * Crée un élément DOM pour une bulle IA individuelle.
 * Les styles critiques (couleur, dimensions) sont en inline pour garantir la visibilité.
 */
function createBubbleDOM(
  type: AiSuggestionType,
  itemId: string,
  offsetIndex: number,
  focused = false,
): HTMLElement {
  // Ancre zero-size positionnée dans le flux texte.
  // Tous les styles sont inline car CSS Modules ne ciblent pas le DOM ProseMirror.
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

  // Décalage horizontal quand plusieurs bulles sont proches (évite la superposition)
  const leftOffset = offsetIndex * 24;

  // Bulle en position absolue — complètement isolée du flux texte et des styles hérités
  const el = document.createElement('span');
  el.setAttribute('data-ai-bubble-type', type);
  el.setAttribute('data-ai-bubble-item', itemId);
  // Bulle liée au conseil affiché dans le panneau : mise en avant (pulse CSS)
  if (focused) el.setAttribute('data-ai-bubble-focus', 'true');
  el.textContent = BUBBLE_LETTERS[type];
  el.style.cssText = [
    'position:absolute',
    'bottom:20px',
    `left:${leftOffset}px`,
    `background:${BUBBLE_COLORS[type]}`,
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
 * Crée un DecorationSet avec des bulles au-dessus du texte (4 types).
 *
 * Positionnement des bulles :
 * - synt/lex : au-dessus du passage problématique (targetText)
 * - ortho/ponctu : réparties dans le paragraphe concerné
 */
export function createAllAiDecorations(
  doc: PmNode,
  suggestions: Record<AiSuggestionType, AiSuggestion | null>,
  // Si fourni : seules les bulles dont l'id composite `type:itemId` est dans le
  // Set sont créées (synchro avec le conseil affiché dans le panneau Aide IA)
  onlyIds: Set<string> | null = null,
): DecorationSet {
  const decorations: Decoration[] = [];

  // 1. Collecter les infos de chaque paragraphe
  const paragraphs: { start: number; length: number }[] = [];
  doc.descendants((node, pos) => {
    if (node.isBlock && node.type.name !== 'doc') {
      paragraphs.push({ start: pos + 1, length: node.textContent.length });
      return false;
    }
  });

  // 2. Bulles — une par suggestion, réparties dans le texte
  //    Collecter toutes les bulles à placer, triées par position
  const allBubbles: { pos: number; type: AiSuggestionType; itemId: string }[] = [];

  for (const type of ['ortho', 'ponctu', 'synt', 'lex'] as const) {
    const suggestion = suggestions[type];
    if (!suggestion) continue;

    // Regrouper par paragraphe pour distribuer les items sans targetText
    const byPara = new Map<number, AiSuggestionItem[]>();
    for (const item of suggestion.suggestions) {
      if (item.dismissed) continue;
      if (onlyIds && !onlyIds.has(`${type}:${item.id}`)) continue;
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
          // Position exacte du texte cible
          const textPos = findTextInParagraph(doc, item.targetText, item.paragraphIndex);
          widgetPos = textPos ? textPos.from : para.start;
        } else {
          // Répartir uniformément dans le paragraphe
          const fraction = (i + 1) / (items.length + 1);
          const offset = Math.min(
            Math.floor(para.length * fraction),
            Math.max(para.length - 1, 0),
          );
          widgetPos = para.start + offset;
        }

        allBubbles.push({ pos: widgetPos, type, itemId: item.id });
      }
    }
  }

  // Trier par position pour détecter les collisions
  allBubbles.sort((a, b) => a.pos - b.pos);

  // Détecter les bulles proches (même position ±2) et assigner un offset
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

  // Créer un widget decoration par bulle
  for (let i = 0; i < allBubbles.length; i++) {
    const bubble = allBubbles[i];
    const offsetIdx = offsets[i];
    decorations.push(
      Decoration.widget(
        bubble.pos,
        () => createBubbleDOM(bubble.type, bubble.itemId, offsetIdx, onlyIds !== null),
        {
          side: -1,
          key: `bubble-${bubble.type}-${bubble.itemId}-${onlyIds !== null ? 'focus' : 'std'}`,
        }
      )
    );
  }

  return DecorationSet.create(doc, decorations);
}

/**
 * Met à jour toutes les décorations IA (inline + bulles) en un seul dispatch.
 */
export function updateAllAiDecorations(
  editor: Editor,
  suggestions: Record<AiSuggestionType, AiSuggestion | null>,
  onlyIds: Set<string> | null = null,
) {
  const { doc } = editor.state;
  const decoSet = createAllAiDecorations(doc, suggestions, onlyIds);
  const tr = editor.state.tr.setMeta(aiDecorationsKey, decoSet);
  editor.view.dispatch(tr);
}
