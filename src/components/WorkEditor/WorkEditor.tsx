'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { TextStyle } from '@tiptap/extension-text-style';
import { FontFamily } from '@tiptap/extension-font-family';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { LineHeight, Indent, FontSize } from '@/lib/tiptap-extensions';
import { AiDecorationsExtension, updateAllAiDecorations } from '@/lib/tiptap-ai-decorations';
import {
  DictHighlightExtension,
  addDictHighlight,
  findWordAtCoords,
} from '@/lib/tiptap-dictionary';
import { FONTS, FONT_SIZES, PAGE_THEMES, LINE_HEIGHT_MIN, LINE_HEIGHT_MAX, LINE_HEIGHT_STEP } from '@/lib/editor-constants';
import { usePreferences } from '@/hooks/usePreferences';
import { setInternalClip, getInternalClip, normalizeClipText } from '@/lib/internal-clipboard';
import { useDictionaryLookup } from '@/hooks/useDictionaryLookup';
import Toggle from '@/components/Toggle/Toggle';
import DictionaryPopup from '@/components/DictionaryPopup';
import type { AiSuggestion, AiSuggestionType } from '@/types/ai-suggestions';
import styles from './WorkEditor.module.css';

interface WorkEditorProps {
  content: string;
  onChange: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
  accesIA?: boolean;
  // Props IA (décorations inline uniquement)
  aiSuggestions?: Record<AiSuggestionType, AiSuggestion | null>;
  onDecorationClick?: (type: AiSuggestionType, itemId: string) => void;
  // Aide dictionnaire : clic sur un mot → surlignage + popup définition
  dictionaryEnabled?: boolean;
}

interface DictPopupState {
  word: string;
  x: number;
  y: number;
  loading: boolean;
  items: string[];
  error: string | null;
}

const DEFAULT_SUGGESTIONS: Record<AiSuggestionType, AiSuggestion | null> = {
  ortho: null,
  ponctu: null,
  synt: null,
  lex: null,
};


export default function WorkEditor({
  content,
  onChange,
  disabled = false,
  placeholder: placeholderText = 'Commencez à rédiger votre travail...',
  accesIA = false,
  aiSuggestions = DEFAULT_SUGGESTIONS,
  onDecorationClick,
  dictionaryEnabled = false,
}: WorkEditorProps) {
  const { preferences } = usePreferences();
  const { lookup: dictLookup } = useDictionaryLookup();
  const [currentFont, setCurrentFont] = useState(preferences.font);
  const [currentFontSize, setCurrentFontSize] = useState(preferences.fontSize);
  const [lineSpacing, setLineSpacing] = useState(preferences.lineHeight);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [pageTheme, setPageTheme] = useState(preferences.theme);
  const [showThemePicker, setShowThemePicker] = useState(false);
  // Afficher/masquer les bulles d'aide IA (cercles O/P/S/L) dans le texte
  const [showAiBubbles, setShowAiBubbles] = useState(true);

  // Dictionnaire : popup de définition
  const [dictPopup, setDictPopup] = useState<DictPopupState | null>(null);
  const dictionaryEnabledRef = useRef(dictionaryEnabled);
  dictionaryEnabledRef.current = dictionaryEnabled;

  // Anti-triche : seul le texte copié/coupé dans l'espace de travail
  // (rédaction ou planification, via internal-clipboard) peut être recollé ici
  const [pasteBlocked, setPasteBlocked] = useState(false);
  const pasteBlockedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (pasteBlockedTimerRef.current) clearTimeout(pasteBlockedTimerRef.current);
  }, []);
  const themePickerRef = useRef<HTMLDivElement>(null);
  const editorAreaRef = useRef<HTMLDivElement>(null);

  // Synchroniser l'etat local quand les preferences changent
  useEffect(() => {
    setCurrentFont(preferences.font);
    setCurrentFontSize(preferences.fontSize);
    setLineSpacing(preferences.lineHeight);
    setPageTheme(preferences.theme);
  }, [preferences]);

  // Fermer le picker au clic exterieur
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (themePickerRef.current && !themePickerRef.current.contains(e.target as Node)) {
        setShowThemePicker(false);
      }
    };
    if (showThemePicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showThemePicker]);

  const handleThemeChange = useCallback((themeId: string) => {
    setPageTheme(themeId);
    setShowThemePicker(false);
  }, []);

  // Extensions Tiptap (incluant les décorations IA si accesIA)
  const editorExtensions = useMemo(() => {
    const base = [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Placeholder.configure({ placeholder: placeholderText }),
      TextStyle,
      FontFamily.configure({ types: ['textStyle'] }),
      FontSize,
      LineHeight,
      Indent,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'editor-link',
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
    ];

    if (accesIA) {
      base.push(AiDecorationsExtension);
    }

    // Surlignage dictionnaire : toujours chargé, activé par la prop dictionaryEnabled
    base.push(DictHighlightExtension);

    return base;
  }, [accesIA, placeholderText]);

  const editor = useEditor({
    extensions: editorExtensions,
    content,
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      handleDOMEvents: {
        // Mémoriser ce que l'élève copie/coupe dans sa rédaction
        copy: (view) => {
          const { from, to } = view.state.selection;
          setInternalClip(view.state.doc.textBetween(from, to, '\n', ' '));
          return false;
        },
        cut: (view) => {
          const { from, to } = view.state.selection;
          setInternalClip(view.state.doc.textBetween(from, to, '\n', ' '));
          return false;
        },
      },
      // Collage autorisé uniquement si le texte vient de l'espace de travail
      handlePaste: (view, event) => {
        const pasted = normalizeClipText(event.clipboardData?.getData('text/plain') || '');
        if (pasted && pasted === getInternalClip()) {
          return false; // texte copié dans la rédaction ou la planification : collage normal
        }
        event.preventDefault();
        setPasteBlocked(true);
        if (pasteBlockedTimerRef.current) clearTimeout(pasteBlockedTimerRef.current);
        pasteBlockedTimerRef.current = setTimeout(() => setPasteBlocked(false), 3500);
        return true;
      },
      // Même règle pour le glisser-déposer : seul le déplacement interne passe
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        event.preventDefault();
        setPasteBlocked(true);
        if (pasteBlockedTimerRef.current) clearTimeout(pasteBlockedTimerRef.current);
        pasteBlockedTimerRef.current = setTimeout(() => setPasteBlocked(false), 3500);
        return true;
      },
    },
  });

  // Mettre a jour le contenu si change de l'exterieur
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  // Mettre a jour l'etat editable
  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled);
    }
  }, [disabled, editor]);

  // ── Mettre à jour toutes les décorations IA (inline synt/lex + bulles marginales) ──
  useEffect(() => {
    if (!editor || !accesIA) return;

    const hasSuggestions = Object.values(aiSuggestions).some(s => s !== null);
    if (hasSuggestions) {
      updateAllAiDecorations(editor, aiSuggestions);
    }
  }, [editor, accesIA, aiSuggestions.ortho, aiSuggestions.ponctu, aiSuggestions.synt, aiSuggestions.lex]);

  // ── Handlers de formatage ──

  const handleBold = useCallback(() => {
    editor?.chain().focus().toggleBold().run();
  }, [editor]);

  const handleItalic = useCallback(() => {
    editor?.chain().focus().toggleItalic().run();
  }, [editor]);

  const handleBulletList = useCallback(() => {
    editor?.chain().focus().toggleBulletList().run();
  }, [editor]);

  const handleOrderedList = useCallback(() => {
    editor?.chain().focus().toggleOrderedList().run();
  }, [editor]);

  const handleHeading2 = useCallback(() => {
    editor?.chain().focus().toggleHeading({ level: 2 }).run();
  }, [editor]);

  const handleHeading3 = useCallback(() => {
    editor?.chain().focus().toggleHeading({ level: 3 }).run();
  }, [editor]);

  const handleFontChange = useCallback((fontFamily: string) => {
    if (!editor) return;
    if (fontFamily) {
      editor.chain().focus().setFontFamily(fontFamily).run();
    } else {
      editor.chain().focus().unsetFontFamily().run();
    }
    setCurrentFont(fontFamily);
  }, [editor]);

  const handleFontSizeChange = useCallback((fontSize: string) => {
    if (!editor) return;
    if (fontSize) {
      editor.chain().focus().setMark('textStyle', { fontSize }).run();
    } else {
      editor.chain().focus().setMark('textStyle', { fontSize: null }).run();
    }
    setCurrentFontSize(fontSize);
  }, [editor]);

  const handleLineHeightChange = useCallback((delta: number) => {
    if (!editor) return;
    const newValue = Math.round((lineSpacing + delta) * 100) / 100;
    const clamped = Math.min(LINE_HEIGHT_MAX, Math.max(LINE_HEIGHT_MIN, newValue));
    setLineSpacing(clamped);
    editor.chain().focus().setLineHeight(String(clamped)).run();
  }, [editor, lineSpacing]);

  const handleIndent = useCallback(() => {
    editor?.chain().focus().indent().run();
  }, [editor]);

  const handleOutdent = useCallback(() => {
    editor?.chain().focus().outdent().run();
  }, [editor]);

  const handleAlign = useCallback((alignment: string) => {
    editor?.chain().focus().setTextAlign(alignment).run();
  }, [editor]);

  const handleLinkToggle = useCallback(() => {
    if (!editor) return;
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const previousUrl = editor.getAttributes('link').href || '';
    setLinkUrl(previousUrl);
    setShowLinkInput(true);
  }, [editor]);

  const handleLinkSubmit = useCallback(() => {
    if (!editor) return;
    if (!linkUrl) {
      editor.chain().focus().unsetLink().run();
    } else {
      let url = linkUrl;
      if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
      }
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
    setShowLinkInput(false);
    setLinkUrl('');
  }, [editor, linkUrl]);

  const handleLinkCancel = useCallback(() => {
    setShowLinkInput(false);
    setLinkUrl('');
    editor?.chain().focus().run();
  }, [editor]);

  // Raccourci Ctrl+K pour lien
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        handleLinkToggle();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleLinkToggle]);

  // ── Dictionnaire : ouvrir la popup et chercher la définition ──
  const openDictPopup = useCallback(async (word: string, clientX: number, clientY: number) => {
    setDictPopup({ word, x: clientX, y: clientY, loading: true, items: [], error: null });
    try {
      const items = await dictLookup(word, 'definition');
      setDictPopup((prev) =>
        prev && prev.word === word ? { ...prev, loading: false, items } : prev
      );
    } catch {
      setDictPopup((prev) =>
        prev && prev.word === word
          ? { ...prev, loading: false, error: 'Impossible de consulter le dictionnaire.' }
          : prev
      );
    }
  }, [dictLookup]);

  // Clic sur une bulle IA → déléguer au parent ; clic sur un mot → dictionnaire
  const handleEditorClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    const bubble = target.closest('[data-ai-bubble-item]') as HTMLElement | null;
    if (bubble) {
      e.stopPropagation();
      e.preventDefault();
      const bubbleType = bubble.getAttribute('data-ai-bubble-type') as AiSuggestionType | null;
      const itemId = bubble.getAttribute('data-ai-bubble-item');
      if (bubbleType && itemId) {
        onDecorationClick?.(bubbleType, itemId);
      }
      return;
    }

    if (!dictionaryEnabledRef.current || !editor) return;

    // Clic sur un mot déjà surligné → rouvrir la popup
    const highlighted = target.closest('[data-dict-word]') as HTMLElement | null;
    if (highlighted) {
      const word = highlighted.getAttribute('data-dict-word');
      if (word) openDictPopup(word, e.clientX, e.clientY);
      return;
    }

    // Clic dans le texte → identifier le mot, le surligner, ouvrir la popup
    if (!target.closest('.tiptap')) return;
    const found = findWordAtCoords(editor.view, { left: e.clientX, top: e.clientY });
    if (!found) {
      setDictPopup(null);
      return;
    }
    addDictHighlight(editor, found.from, found.to, found.word);
    openDictPopup(found.word, e.clientX, e.clientY);
  }, [editor, onDecorationClick, openDictPopup]);

  // Fermer la popup quand le dictionnaire est désactivé
  useEffect(() => {
    if (!dictionaryEnabled) setDictPopup(null);
  }, [dictionaryEnabled]);

  if (!editor) {
    return <div className={styles.loading}>Chargement de l&apos;editeur...</div>;
  }

  return (
    <div className={`${styles.container} ${disabled ? styles.disabled : ''}`}>
      <div className={styles.toolbar}>
        {/* Selecteur de police */}
        <select
          className={styles.fontSelect}
          value={currentFont}
          onChange={(e) => handleFontChange(e.target.value)}
          disabled={disabled}
          title="Police de caracteres"
        >
          {FONTS.map((font) => (
            <option key={font.value} value={font.value}>
              {font.name}
            </option>
          ))}
        </select>

        {/* Selecteur de taille */}
        <select
          className={styles.sizeSelect}
          value={currentFontSize}
          onChange={(e) => handleFontSizeChange(e.target.value)}
          disabled={disabled}
          title="Taille de police"
        >
          {FONT_SIZES.map((size) => (
            <option key={size.value} value={size.value}>
              {size.name}
            </option>
          ))}
        </select>

        <span className={styles.separator} />

        {/* Formatage texte */}
        <button
          type="button"
          onClick={handleBold}
          className={`${styles.toolbarButton} ${editor.isActive('bold') ? styles.active : ''}`}
          disabled={disabled}
          title="Gras (Ctrl+B)"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          onClick={handleItalic}
          className={`${styles.toolbarButton} ${editor.isActive('italic') ? styles.active : ''}`}
          disabled={disabled}
          title="Italique (Ctrl+I)"
        >
          <em>I</em>
        </button>

        <span className={styles.separator} />

        {/* Titres */}
        <button
          type="button"
          onClick={handleHeading2}
          className={`${styles.toolbarButton} ${editor.isActive('heading', { level: 2 }) ? styles.active : ''}`}
          disabled={disabled}
          title="Titre 2"
        >
          H2
        </button>
        <button
          type="button"
          onClick={handleHeading3}
          className={`${styles.toolbarButton} ${editor.isActive('heading', { level: 3 }) ? styles.active : ''}`}
          disabled={disabled}
          title="Titre 3"
        >
          H3
        </button>

        <span className={styles.separator} />

        {/* Listes */}
        <button
          type="button"
          onClick={handleBulletList}
          className={`${styles.toolbarButton} ${editor.isActive('bulletList') ? styles.active : ''}`}
          disabled={disabled}
          title="Liste a puces"
        >
          •
        </button>
        <button
          type="button"
          onClick={handleOrderedList}
          className={`${styles.toolbarButton} ${editor.isActive('orderedList') ? styles.active : ''}`}
          disabled={disabled}
          title="Liste numerotee"
        >
          1.
        </button>

        <span className={styles.separator} />

        {/* Alignement */}
        <button
          type="button"
          onClick={() => handleAlign('left')}
          className={`${styles.toolbarButton} ${editor.isActive({ textAlign: 'left' }) ? styles.active : ''}`}
          disabled={disabled}
          title="Aligner a gauche"
        >
          <span className={styles.alignIcon}>☰</span>
        </button>
        <button
          type="button"
          onClick={() => handleAlign('center')}
          className={`${styles.toolbarButton} ${editor.isActive({ textAlign: 'center' }) ? styles.active : ''}`}
          disabled={disabled}
          title="Centrer"
        >
          <span className={styles.alignIconCenter}>☰</span>
        </button>
        <button
          type="button"
          onClick={() => handleAlign('right')}
          className={`${styles.toolbarButton} ${editor.isActive({ textAlign: 'right' }) ? styles.active : ''}`}
          disabled={disabled}
          title="Aligner a droite"
        >
          <span className={styles.alignIconRight}>☰</span>
        </button>
        <button
          type="button"
          onClick={() => handleAlign('justify')}
          className={`${styles.toolbarButton} ${editor.isActive({ textAlign: 'justify' }) ? styles.active : ''}`}
          disabled={disabled}
          title="Justifier"
        >
          <span className={styles.alignIconJustify}>☰</span>
        </button>

        <span className={styles.separator} />

        {/* Alinea */}
        <button
          type="button"
          onClick={handleOutdent}
          className={styles.toolbarButton}
          disabled={disabled}
          title="Diminuer l'alinea (Shift+Tab)"
        >
          ←
        </button>
        <button
          type="button"
          onClick={handleIndent}
          className={styles.toolbarButton}
          disabled={disabled}
          title="Augmenter l'alinea (Tab)"
        >
          →
        </button>

        <span className={styles.separator} />

        {/* Interligne */}
        <button
          type="button"
          onClick={() => handleLineHeightChange(-LINE_HEIGHT_STEP)}
          className={styles.toolbarButton}
          disabled={disabled || lineSpacing <= LINE_HEIGHT_MIN}
          title="Reduire l'interligne"
        >
          <span className={styles.lineHeightIcon}>−</span>
        </button>
        <span className={styles.lineHeightValue} title={`Interligne : ${lineSpacing}`}>
          {lineSpacing.toFixed(2)}
        </span>
        <button
          type="button"
          onClick={() => handleLineHeightChange(LINE_HEIGHT_STEP)}
          className={styles.toolbarButton}
          disabled={disabled || lineSpacing >= LINE_HEIGHT_MAX}
          title="Augmenter l'interligne"
        >
          <span className={styles.lineHeightIcon}>+</span>
        </button>

        {/* Hyperlien */}
        <button
          type="button"
          onClick={handleLinkToggle}
          className={`${styles.toolbarButton} ${editor.isActive('link') ? styles.active : ''}`}
          disabled={disabled}
          title="Inserer un lien (Ctrl+K)"
        >
          🔗
        </button>

        <span className={styles.separator} />

        {/* Theme de page */}
        <div className={styles.themePickerWrapper} ref={themePickerRef}>
          <button
            type="button"
            onClick={() => setShowThemePicker(!showThemePicker)}
            className={`${styles.toolbarButton} ${showThemePicker ? styles.active : ''}`}
            disabled={disabled}
            title="Couleur de la page"
          >
            <span
              className={styles.themeButtonSwatch}
              style={{
                background: PAGE_THEMES.find(t => t.id === pageTheme)?.bg,
                borderColor: pageTheme === 'classic' ? '#dadce0' : PAGE_THEMES.find(t => t.id === pageTheme)?.bg,
              }}
            />
          </button>
          {showThemePicker && (
            <div className={styles.themePicker}>
              <div className={styles.themePickerTitle}>Couleur de page</div>
              <div className={styles.themePickerGrid}>
                {PAGE_THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    className={`${styles.themeOption} ${pageTheme === theme.id ? styles.themeOptionActive : ''}`}
                    onClick={() => handleThemeChange(theme.id)}
                    title={theme.name}
                  >
                    <span
                      className={styles.themeSwatch}
                      style={{ background: theme.bg }}
                    >
                      <span style={{ color: theme.text }}>A</span>
                    </span>
                    <span className={styles.themeLabel}>{theme.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Affichage des bulles d'aide IA */}
        {accesIA && (
          <>
            <span className={styles.separator} />
            <div
              className={styles.aiBubblesToggle}
              title={showAiBubbles ? 'Masquer les aides' : 'Afficher les aides'}
            >
              <span className={styles.aiBubblesToggleLabel}>Aide IA</span>
              <Toggle checked={showAiBubbles} onChange={setShowAiBubbles} />
            </div>
          </>
        )}

      </div>

      {/* Barre d'input pour lien */}
      {showLinkInput && (
        <div className={styles.linkBar}>
          <input
            type="url"
            className={styles.linkInput}
            placeholder="https://exemple.com"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleLinkSubmit();
              if (e.key === 'Escape') handleLinkCancel();
            }}
            autoFocus
          />
          <button type="button" className={styles.linkButton} onClick={handleLinkSubmit}>
            ✓
          </button>
          <button type="button" className={styles.linkButtonCancel} onClick={handleLinkCancel}>
            ✕
          </button>
        </div>
      )}

      {/* Zone éditeur */}
      <div
        className={`${styles.editorArea}${showAiBubbles ? '' : ` ${styles.hideAiBubbles}`}${dictionaryEnabled ? ` ${styles.dictMode}` : ''}`}
        ref={editorAreaRef}
        onClick={handleEditorClick}
      >
        <EditorContent
          editor={editor}
          className={`${styles.editor} ${accesIA && Object.values(aiSuggestions).some(s => s !== null) ? styles.editorWithBubbles : ''}`}
          style={{
            '--editor-bg': PAGE_THEMES.find(t => t.id === pageTheme)?.bg ?? '#FFFFFF',
            '--editor-text': PAGE_THEMES.find(t => t.id === pageTheme)?.text ?? '#202124',
          } as React.CSSProperties}
        />

        {/* Avertissement collage externe bloqué */}
        {pasteBlocked && (
          <div className={styles.pasteBlockedNotice}>
            ✋ Le collage de texte extérieur n&apos;est pas autorisé. Tu peux uniquement recoller
            du texte copié dans ta rédaction ou ta planification.
          </div>
        )}

        {/* Popup de définition (dictionnaire) */}
        {dictPopup && (
          <DictionaryPopup
            word={dictPopup.word}
            x={dictPopup.x}
            y={dictPopup.y}
            loading={dictPopup.loading}
            items={dictPopup.items}
            error={dictPopup.error}
            onClose={() => setDictPopup(null)}
          />
        )}
      </div>
    </div>
  );
}
