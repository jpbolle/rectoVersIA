'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { expandWordInText } from '@/lib/tiptap-dictionary';
import { useDictionaryLookup } from '@/hooks/useDictionaryLookup';
import DictionaryPopup from '@/components/DictionaryPopup';
import styles from './DictionaryClickLayer.module.css';

// Rend cliquables les mots du contenu enfant (panneau latéral : consignes,
// remarques du prof, commentaires…) quand le dictionnaire est actif.
// Le surlignage fluo passe par l'API CSS Custom Highlight (aucune modification du DOM).

interface DictionaryClickLayerProps {
  enabled: boolean;
  children: React.ReactNode;
}

interface PopupState {
  word: string;
  x: number;
  y: number;
  loading: boolean;
  items: string[];
  error: string | null;
}

// Éléments dont le clic garde son comportement normal
const INTERACTIVE_SELECTOR =
  'button, input, textarea, select, a, [contenteditable="true"], [data-dict-popup], [role="button"]';

/** caretRangeFromPoint avec repli Firefox (caretPositionFromPoint) */
function caretFromPoint(x: number, y: number): { node: Node; offset: number } | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  if (typeof doc.caretRangeFromPoint === 'function') {
    const range = doc.caretRangeFromPoint(x, y);
    if (range) return { node: range.startContainer, offset: range.startOffset };
  }
  if (typeof doc.caretPositionFromPoint === 'function') {
    const pos = doc.caretPositionFromPoint(x, y);
    if (pos) return { node: pos.offsetNode, offset: pos.offset };
  }
  return null;
}

export default function DictionaryClickLayer({ enabled, children }: DictionaryClickLayerProps) {
  const { lookup } = useDictionaryLookup();
  const [popup, setPopup] = useState<PopupState | null>(null);
  const highlightRef = useRef<Highlight | null>(null);

  // Registre du surlignage fluo (API CSS Custom Highlight, supportée par Chrome)
  const ensureHighlight = useCallback((): Highlight | null => {
    if (typeof Highlight === 'undefined' || !CSS.highlights) return null;
    if (!highlightRef.current) {
      highlightRef.current = new Highlight();
      CSS.highlights.set('dict-word', highlightRef.current);
      // Style du surlignage injecté ici : le parseur CSS du bundler
      // ne reconnaît pas le pseudo-élément ::highlight()
      if (!document.getElementById('dict-word-highlight-style')) {
        const style = document.createElement('style');
        style.id = 'dict-word-highlight-style';
        style.textContent = '::highlight(dict-word) { background-color: #ffe066; color: #3d3832; }';
        document.head.appendChild(style);
      }
    }
    return highlightRef.current;
  }, []);

  // Nettoyage : retirer les surlignages quand le dictionnaire est désactivé
  useEffect(() => {
    if (!enabled) {
      setPopup(null);
      highlightRef.current?.clear();
    }
  }, [enabled]);

  useEffect(() => {
    return () => {
      if (typeof Highlight !== 'undefined' && CSS.highlights && highlightRef.current) {
        highlightRef.current.clear();
      }
    };
  }, []);

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      if (!enabled) return;
      const target = e.target as HTMLElement;
      if (target.closest(INTERACTIVE_SELECTOR)) return;

      const caret = caretFromPoint(e.clientX, e.clientY);
      if (!caret || caret.node.nodeType !== Node.TEXT_NODE) return;

      const textNode = caret.node as Text;
      const text = textNode.textContent || '';
      const found = expandWordInText(text, caret.offset);
      if (!found) return;

      // Surlignage fluo du mot cliqué
      const highlight = ensureHighlight();
      if (highlight) {
        const range = document.createRange();
        range.setStart(textNode, found.start);
        range.setEnd(textNode, found.end);
        highlight.add(range);
      }

      const word = found.word;
      setPopup({ word, x: e.clientX, y: e.clientY, loading: true, items: [], error: null });
      try {
        const items = await lookup(word, 'definition');
        setPopup((prev) =>
          prev && prev.word === word ? { ...prev, loading: false, items } : prev
        );
      } catch {
        setPopup((prev) =>
          prev && prev.word === word
            ? { ...prev, loading: false, error: 'Impossible de consulter le dictionnaire.' }
            : prev
        );
      }
    },
    [enabled, ensureHighlight, lookup]
  );

  return (
    <div
      className={`${styles.layer}${enabled ? ` ${styles.enabled}` : ''}`}
      onClick={handleClick}
    >
      {children}
      {popup && (
        <DictionaryPopup
          word={popup.word}
          x={popup.x}
          y={popup.y}
          loading={popup.loading}
          items={popup.items}
          error={popup.error}
          onClose={() => setPopup(null)}
        />
      )}
    </div>
  );
}
