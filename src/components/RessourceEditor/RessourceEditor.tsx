'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import { Extension } from '@tiptap/core';
import { ContentLock } from '@/lib/tiptap-annotations';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePreferences } from '@/hooks/usePreferences';
import { PAGE_THEMES } from '@/lib/editor-constants';

// Version lecture seule de Indent : parse/render uniquement, pas de commandes ni raccourcis
const IndentReadOnly = Extension.create({
  name: 'indent',
  addOptions() {
    return { types: ['paragraph', 'heading'], indentSize: 30 };
  },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        indent: {
          default: 0,
          parseHTML: (element: HTMLElement) => {
            const indent = element.style.textIndent;
            return indent ? parseInt(indent) / 30 : 0;
          },
          renderHTML: (attributes: Record<string, number>) => {
            if (!attributes.indent) return {};
            return { style: `text-indent: ${attributes.indent * 30}px` };
          },
        },
      },
    }];
  },
});
import styles from './RessourceEditor.module.css';

const HIGHLIGHT_COLORS = [
  { label: 'Jaune', color: '#fff176' },
  { label: 'Vert', color: '#a5d6a7' },
  { label: 'Bleu', color: '#90caf9' },
  { label: 'Rose', color: '#f48fb1' },
  { label: 'Orange', color: '#ffcc80' },
];

type ActiveTool =
  | { type: 'highlight'; color: string }
  | { type: 'underline' }
  | { type: 'strike' }
  | null;

interface RessourceEditorProps {
  initialContent: string;
  onChange: (html: string) => void;
  initialNotes: Record<string, string>;
  onNotesChange: (notes: Record<string, string>) => void;
}

export default function RessourceEditor({
  initialContent,
  onChange,
  initialNotes,
  onNotesChange,
}: RessourceEditorProps) {
  // ── Preferences accessibilite ──
  const { preferences } = usePreferences();
  const currentTheme = PAGE_THEMES.find(t => t.id === preferences.theme) || PAGE_THEMES[0];

  // ── Toolbar paint mode ──
  const [activeTool, setActiveTool] = useState<ActiveTool>(null);
  const activeToolRef = useRef<ActiveTool>(null);
  activeToolRef.current = activeTool;

  // ── Popup annotation ──
  const editorWrapperRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [selectionPopup, setSelectionPopup] = useState<{ top: number; left: number } | null>(null);
  const isMouseDownRef = useRef(false);

  // ── Dictionnaire ──
  const dictPopupRef = useRef<HTMLDivElement>(null);
  const dictClickTimer = useRef<NodeJS.Timeout | null>(null);
  const [dictPopup, setDictPopup] = useState<{
    top: number;
    left: number;
    word: string;
    phonetic: string;
    loading: boolean;
    definitions: Array<{ partOfSpeech: string; definition: string }>;
    error: string | null;
  } | null>(null);

  // ── Notes par paragraphe ──
  const [notes, setNotes] = useState<Record<string, string>>(initialNotes);
  const [editingPara, setEditingPara] = useState<number | null>(null);
  const [noteInput, setNoteInput] = useState('');
  const noteInputRef = useRef<HTMLTextAreaElement>(null);
  const notesGutterRef = useRef<HTMLDivElement>(null);
  const [paraPositions, setParaPositions] = useState<Array<{ top: number; height: number }>>([]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ strike: {} }),
      ContentLock,
      Highlight.configure({ multicolor: true }),
      Underline,
      IndentReadOnly,
    ],
    content: initialContent,
    editable: true,
    immediatelyRender: false,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  // ── Mesurer la position des paragraphes ──
  useEffect(() => {
    if (!editor) return;

    const measure = () => {
      const tiptapEl = editorWrapperRef.current?.querySelector('.tiptap');
      const gutter = notesGutterRef.current;
      if (!tiptapEl || !gutter) return;

      const paras = tiptapEl.querySelectorAll(':scope > p');
      const gutterRect = gutter.getBoundingClientRect();

      const positions = Array.from(paras).map(p => {
        const rect = p.getBoundingClientRect();
        return {
          top: rect.top - gutterRect.top,
          height: rect.height,
        };
      });

      setParaPositions(positions);
    };

    // Mesurer apres le premier rendu
    requestAnimationFrame(() => requestAnimationFrame(measure));

    // Re-mesurer quand le contenu change (marks appliques)
    const observer = new MutationObserver(() => requestAnimationFrame(measure));
    const tiptapEl = editorWrapperRef.current?.querySelector('.tiptap');
    if (tiptapEl) {
      observer.observe(tiptapEl, { childList: true, subtree: true, attributes: true });
    }

    window.addEventListener('resize', measure);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [editor]);

  // ── Focus le champ note ──
  useEffect(() => {
    if (editingPara !== null) {
      setTimeout(() => noteInputRef.current?.focus(), 0);
    }
  }, [editingPara]);

  // ── Popup au mouseup uniquement ──
  useEffect(() => {
    if (!editor) return;

    const showPopupIfSelection = () => {
      if (activeToolRef.current !== null) return;

      const { from, to } = editor.state.selection;
      if (from === to) {
        setSelectionPopup(null);
        return;
      }

      const domSelection = window.getSelection();
      if (!domSelection || domSelection.rangeCount === 0) {
        setSelectionPopup(null);
        return;
      }

      const range = domSelection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const wrapper = editorWrapperRef.current;
      if (!wrapper) return;
      const wrapperRect = wrapper.getBoundingClientRect();

      setSelectionPopup({
        top: rect.top - wrapperRect.top + wrapper.scrollTop - 50,
        left: rect.left - wrapperRect.left + rect.width / 2,
      });
    };

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      // Ne pas fermer les popups si on clique dedans
      if (popupRef.current?.contains(target) || dictPopupRef.current?.contains(target)) {
        e.preventDefault();
        return;
      }
      isMouseDownRef.current = true;
      setSelectionPopup(null);
      setDictPopup(null);
    };

    const handleMouseUp = (e: MouseEvent) => {
      const target = e.target as Node;
      // Ignorer si le clic est dans un popup
      if (popupRef.current?.contains(target) || dictPopupRef.current?.contains(target)) return;
      isMouseDownRef.current = false;
      requestAnimationFrame(showPopupIfSelection);
    };

    const handleDblClick = () => {
      if (activeToolRef.current !== null) return;
      requestAnimationFrame(() => requestAnimationFrame(showPopupIfSelection));
    };

    const handleSelectionUpdate = () => {
      const { from, to } = editor.state.selection;
      if (from === to) {
        setSelectionPopup(null);
      }
    };

    const wrapper = editorWrapperRef.current;
    wrapper?.addEventListener('mousedown', handleMouseDown);
    wrapper?.addEventListener('mouseup', handleMouseUp);
    wrapper?.addEventListener('dblclick', handleDblClick);
    editor.on('selectionUpdate', handleSelectionUpdate);

    if (activeTool !== null) {
      setSelectionPopup(null);
    }

    return () => {
      wrapper?.removeEventListener('mousedown', handleMouseDown);
      wrapper?.removeEventListener('mouseup', handleMouseUp);
      wrapper?.removeEventListener('dblclick', handleDblClick);
      editor.off('selectionUpdate', handleSelectionUpdate);
    };
  }, [editor, activeTool]);

  // ── Dictionnaire : extraction du mot au curseur ──
  const getWordAtCursor = useCallback((): string | null => {
    if (!editor) return null;
    const { from, to } = editor.state.selection;
    if (from !== to) return null;

    const $pos = editor.state.doc.resolve(from);
    const parent = $pos.parent;
    if (!parent.isTextblock) return null;

    const text = parent.textContent;
    const offset = Math.min($pos.parentOffset, text.length);
    const wordChars = /[\wàâäéèêëïîôùûüÿçœæÀÂÄÉÈÊËÏÎÔÙÛÜŸÇŒÆ'-]/;

    let start = offset;
    let end = offset;
    while (start > 0 && wordChars.test(text[start - 1])) start--;
    while (end < text.length && wordChars.test(text[end])) end++;

    const word = text.slice(start, end).replace(/^['-]+|['-]+$/g, '');
    return word.length >= 2 ? word : null;
  }, [editor]);

  // ── Dictionnaire : appel Wiktionnaire ──
  const lookupWord = useCallback(async (word: string, clientX: number, clientY: number) => {
    const wrapper = editorWrapperRef.current;
    if (!wrapper) return;
    const wrapperRect = wrapper.getBoundingClientRect();

    setDictPopup({
      top: clientY - wrapperRect.top + wrapper.scrollTop + 20,
      left: Math.max(10, clientX - wrapperRect.left - 140),
      word,
      phonetic: '',
      loading: true,
      definitions: [],
      error: null,
    });

    try {
      const url = `https://fr.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(word.toLowerCase())}&format=json&prop=text&origin=*`;
      const res = await fetch(url);
      if (!res.ok) {
        setDictPopup(prev => prev ? { ...prev, loading: false, error: 'Mot non trouvé.' } : null);
        return;
      }

      const json = await res.json();
      if (json.error) {
        setDictPopup(prev => prev ? { ...prev, loading: false, error: 'Mot non trouvé.' } : null);
        return;
      }

      const htmlText: string = json.parse?.text?.['*'] || '';
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, 'text/html');

      // Phonetique
      const ipaEl = doc.querySelector('.API');
      const phonetic = ipaEl?.textContent || '';

      // Partie du discours
      const posEl = doc.querySelector('.titredef');
      const partOfSpeech = posEl?.textContent || '';

      // Definitions : premier <ol> apres le titredef
      const definitions: Array<{ partOfSpeech: string; definition: string }> = [];
      const firstOl = doc.querySelector('ol');
      if (firstOl) {
        const topLis = firstOl.querySelectorAll(':scope > li');
        for (let i = 0; i < Math.min(topLis.length, 4); i++) {
          const li = topLis[i];
          // Cloner pour ne pas modifier le DOM, retirer les sous-listes
          const clone = li.cloneNode(true) as HTMLElement;
          clone.querySelectorAll('ul, dl, ol').forEach(el => el.remove());
          let text = clone.textContent?.trim() || '';
          text = text.replace(/\s+/g, ' ').replace(/\[\d+\]/g, '');
          if (text.length > 200) {
            const cut = text.lastIndexOf('.', 200);
            text = cut > 60 ? text.slice(0, cut + 1) : text.slice(0, 200) + '\u2026';
          }
          if (text.length > 5) {
            definitions.push({ partOfSpeech, definition: text });
          }
        }
      }

      if (definitions.length === 0) {
        setDictPopup(prev => prev ? { ...prev, loading: false, phonetic, error: 'Aucune définition trouvée.' } : null);
      } else {
        setDictPopup(prev => prev ? { ...prev, loading: false, phonetic, definitions } : null);
      }
    } catch {
      setDictPopup(prev => prev ? { ...prev, loading: false, error: 'Erreur de connexion.' } : null);
    }
  }, []);

  // ── Dictionnaire : clic simple (avec delai pour distinguer du double-clic) ──
  useEffect(() => {
    if (!editor) return;

    const handleClick = (e: MouseEvent) => {
      if (activeToolRef.current !== null) return;
      if (dictPopupRef.current?.contains(e.target as Node)) return;
      if (popupRef.current?.contains(e.target as Node)) return;

      setDictPopup(null);

      const cx = e.clientX;
      const cy = e.clientY;

      if (dictClickTimer.current) clearTimeout(dictClickTimer.current);
      dictClickTimer.current = setTimeout(() => {
        // Lire le mot apres que Tiptap ait mis a jour la position du curseur
        const word = getWordAtCursor();
        if (word) lookupWord(word, cx, cy);
      }, 350);
    };

    const handleDblClickDict = () => {
      if (dictClickTimer.current) {
        clearTimeout(dictClickTimer.current);
        dictClickTimer.current = null;
      }
      setDictPopup(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDictPopup(null);
    };

    const wrapper = editorWrapperRef.current;
    wrapper?.addEventListener('click', handleClick);
    wrapper?.addEventListener('dblclick', handleDblClickDict);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      wrapper?.removeEventListener('click', handleClick);
      wrapper?.removeEventListener('dblclick', handleDblClickDict);
      document.removeEventListener('keydown', handleKeyDown);
      if (dictClickTimer.current) clearTimeout(dictClickTimer.current);
    };
  }, [editor, getWordAtCursor, lookupWord]);

  // ── Mode pinceau : appliquer au mouseup ──
  useEffect(() => {
    if (!editor || !activeTool) return;

    const handleMouseUp = () => {
      requestAnimationFrame(() => {
        const tool = activeToolRef.current;
        if (!tool) return;
        const { from, to } = editor.state.selection;
        if (from === to) return;

        if (tool.type === 'highlight') {
          editor.chain().setHighlight({ color: tool.color }).run();
        } else if (tool.type === 'underline') {
          editor.chain().setMark('underline').run();
        } else if (tool.type === 'strike') {
          editor.chain().setMark('strike').run();
        }
      });
    };

    const wrapper = editorWrapperRef.current;
    wrapper?.addEventListener('mouseup', handleMouseUp);
    return () => {
      wrapper?.removeEventListener('mouseup', handleMouseUp);
    };
  }, [editor, activeTool]);

  // ── Actions popup ──
  const applyHighlight = useCallback((color: string) => {
    if (!editor) return;
    if (editor.isActive('highlight', { color })) {
      editor.chain().focus().unsetHighlight().run();
    } else {
      editor.chain().focus().setHighlight({ color }).run();
    }
  }, [editor]);

  const applyUnderline = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().toggleUnderline().run();
  }, [editor]);

  const applyStrike = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().toggleStrike().run();
  }, [editor]);

  const eraseMarks = useCallback(() => {
    if (!editor) return;
    editor.chain().focus()
      .unsetHighlight()
      .unsetMark('underline')
      .unsetMark('strike')
      .run();
  }, [editor]);

  // ── Toggle toolbar paint mode ──
  const toggleToolbarTool = useCallback((tool: ActiveTool) => {
    setActiveTool(prev => {
      if (!prev || !tool) return tool;
      if (prev.type === tool.type) {
        if (prev.type === 'highlight' && tool.type === 'highlight' && prev.color === tool.color) return null;
        if (prev.type !== 'highlight') return null;
      }
      return tool;
    });
  }, []);

  // ── Notes par paragraphe ──
  const startEditNote = useCallback((index: number) => {
    setEditingPara(index);
    setNoteInput(notes[String(index)] || '');
  }, [notes]);

  const saveNote = useCallback(() => {
    if (editingPara === null) return;
    const text = noteInput.trim();
    const key = String(editingPara);
    const updated = { ...notes };
    if (text) {
      updated[key] = text;
    } else {
      delete updated[key];
    }
    setNotes(updated);
    onNotesChange(updated);
    setEditingPara(null);
    setNoteInput('');
  }, [editingPara, noteInput, notes, onNotesChange]);

  const cancelEditNote = useCallback(() => {
    setEditingPara(null);
    setNoteInput('');
  }, []);

  const deleteNote = useCallback((index: number) => {
    const key = String(index);
    const updated = { ...notes };
    delete updated[key];
    setNotes(updated);
    onNotesChange(updated);
  }, [notes, onNotesChange]);

  if (!editor) return null;

  return (
    <div className={styles.wrapper}>
      {/* ── Toolbar ── */}
      <div className={styles.toolbar}>
        {HIGHLIGHT_COLORS.map(({ label, color }) => (
          <button
            key={color}
            type="button"
            title={`Pinceau ${label.toLowerCase()}`}
            className={`${styles.colorBtn} ${
              activeTool?.type === 'highlight' && activeTool.color === color ? styles.colorBtnActive : ''
            }`}
            style={{ backgroundColor: color }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => toggleToolbarTool({ type: 'highlight', color })}
          />
        ))}
        <span className={styles.separator} />
        <button
          type="button"
          title="Pinceau souligner"
          className={`${styles.toolBtn} ${activeTool?.type === 'underline' ? styles.toolBtnActive : ''}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => toggleToolbarTool({ type: 'underline' })}
        >
          <span className={styles.underlineIcon}>S</span>
        </button>
        <button
          type="button"
          title="Pinceau raturer"
          className={`${styles.toolBtn} ${activeTool?.type === 'strike' ? styles.toolBtnActive : ''}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => toggleToolbarTool({ type: 'strike' })}
        >
          <span className={styles.strikeIcon}>S</span>
        </button>
        <span className={styles.separator} />
        <button
          type="button"
          title="Gomme"
          className={styles.toolBtn}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { eraseMarks(); setActiveTool(null); }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="2" y="9.5" width="10" height="5.5" rx="1.2" transform="rotate(-30 2 9.5)" fill="#e8a0b4"/>
            <rect x="7" y="6" width="6.5" height="5.5" rx="1.2" transform="rotate(-30 7 6)" fill="#78909c"/>
            <line x1="2" y1="15.5" x2="16" y2="15.5" stroke="#b0bec5" strokeWidth="1.2"/>
          </svg>
        </button>
        {activeTool && (
          <span className={styles.paintModeIndicator}>Mode pinceau actif</span>
        )}
      </div>

      {/* ── Deux colonnes : gutter notes + editeur ── */}
      <div className={styles.columns}>
        {/* ── Gutter notes (aligne par paragraphe) ── */}
        <div className={styles.notesGutter} ref={notesGutterRef}>
          {paraPositions.map((pos, index) => (
            <div
              key={index}
              className={styles.noteSlot}
              style={{ top: pos.top, minHeight: pos.height }}
            >
              {editingPara === index ? (
                <div className={styles.noteInputWrapper}>
                  <textarea
                    ref={editingPara === index ? noteInputRef : undefined}
                    className={styles.noteInput}
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveNote(); }
                      if (e.key === 'Escape') cancelEditNote();
                    }}
                    placeholder="Mot-clé, résumé..."
                    rows={2}
                  />
                  <div className={styles.noteActions}>
                    <button type="button" className={styles.noteConfirmBtn} onClick={saveNote}>
                      &#10003;
                    </button>
                    <button type="button" className={styles.noteCancelBtn} onClick={cancelEditNote}>
                      &#10005;
                    </button>
                  </div>
                </div>
              ) : notes[String(index)] ? (
                <div className={styles.noteItem} onClick={() => startEditNote(index)}>
                  <span className={styles.noteText}>{notes[String(index)]}</span>
                  <button
                    type="button"
                    className={styles.deleteNoteBtn}
                    onClick={(e) => { e.stopPropagation(); deleteNote(index); }}
                    title="Supprimer"
                  >
                    &times;
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className={styles.addNoteBtn}
                  onClick={() => startEditNote(index)}
                  title="Ajouter une note"
                >
                  +
                </button>
              )}
            </div>
          ))}
        </div>

        {/* ── Colonne editeur ── */}
        <div className={styles.editorColumn} ref={editorWrapperRef}>
          <EditorContent
            editor={editor}
            className={styles.editor}
            style={{
              '--editor-bg': currentTheme.bg,
              '--editor-text': currentTheme.text,
              fontFamily: preferences.font || undefined,
              fontSize: preferences.fontSize ? `${preferences.fontSize}px` : undefined,
              lineHeight: preferences.lineHeight ? String(preferences.lineHeight) : undefined,
            } as React.CSSProperties}
          />

          {/* Popup de selection */}
          {selectionPopup && (
            <div
              ref={popupRef}
              className={styles.selectionPopup}
              style={{ top: selectionPopup.top, left: selectionPopup.left }}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
            >
              {HIGHLIGHT_COLORS.map(({ label, color }) => (
                <button
                  key={color}
                  type="button"
                  title={label}
                  className={styles.popupBtn}
                  onClick={() => applyHighlight(color)}
                >
                  <span className={styles.popupColorDot} style={{ backgroundColor: color }} />
                </button>
              ))}
              <span className={styles.popupSep} />
              <button type="button" className={styles.popupBtn} onClick={applyUnderline} title="Souligner">
                <span className={styles.popupUnderline}>S</span>
              </button>
              <button type="button" className={styles.popupBtn} onClick={applyStrike} title="Raturer">
                <span className={styles.popupStrike}>S</span>
              </button>
              <span className={styles.popupSep} />
              <button type="button" className={styles.popupBtn} onClick={eraseMarks} title="Gomme">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <rect x="2" y="9.5" width="10" height="5.5" rx="1.2" transform="rotate(-30 2 9.5)" fill="#e8a0b4"/>
                  <rect x="7" y="6" width="6.5" height="5.5" rx="1.2" transform="rotate(-30 7 6)" fill="#78909c"/>
                  <line x1="2" y1="15.5" x2="16" y2="15.5" stroke="#b0bec5" strokeWidth="1.2"/>
                </svg>
              </button>
            </div>
          )}

          {/* Popup dictionnaire */}
          {dictPopup && (
            <div
              ref={dictPopupRef}
              className={styles.dictPopup}
              style={{ top: dictPopup.top, left: dictPopup.left }}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
            >
              <div className={styles.dictHeader}>
                <div>
                  <span className={styles.dictWord}>{dictPopup.word}</span>
                  {dictPopup.phonetic && (
                    <span className={styles.dictPhonetic}>{dictPopup.phonetic}</span>
                  )}
                </div>
                <button
                  type="button"
                  className={styles.dictCloseBtn}
                  onClick={() => setDictPopup(null)}
                >
                  &times;
                </button>
              </div>
              <div className={styles.dictBody}>
                {dictPopup.loading && (
                  <div className={styles.dictLoading}>Recherche...</div>
                )}
                {dictPopup.error && (
                  <div className={styles.dictError}>{dictPopup.error}</div>
                )}
                {dictPopup.definitions.length > 0 && dictPopup.definitions[0].partOfSpeech && (
                  <div className={styles.dictPosLine}>
                    <span className={styles.dictPos}>{dictPopup.definitions[0].partOfSpeech}</span>
                  </div>
                )}
                {dictPopup.definitions.map((def, i) => (
                  <div key={i} className={styles.dictDefinition}>
                    <span className={styles.dictDefNum}>{i + 1}.</span>
                    <p className={styles.dictDefText}>{def.definition}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
