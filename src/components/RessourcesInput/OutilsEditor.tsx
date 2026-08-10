'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { useCallback, useEffect, useState } from 'react';
import styles from './RessourcesInput.module.css';

interface OutilsEditorProps {
  content: string;
  onChange: (html: string) => void;
  disabled?: boolean;
}

// Liste à puces vide : structure de départ — chaque URL ajoutée est un bullet
const EMPTY_LIST = '<ul><li><p></p></li></ul>';

function isEmptyHtml(html: string): boolean {
  if (!html) return true;
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim() === '';
}

export default function OutilsEditor({
  content,
  onChange,
  disabled = false,
}: OutilsEditorProps) {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        // Link est ajouté séparément avec notre configuration (autolink) —
        // le désactiver ici évite le doublon (StarterKit l'inclut par défaut)
        link: false,
      }),
      Placeholder.configure({
        placeholder: 'Dictionnaire, Bescherelle, sites de référence...',
      }),
      Link.configure({
        openOnClick: false,
        // Une URL tapée ou collée devient automatiquement un lien cliquable
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          class: 'editor-link',
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
    ],
    content: isEmptyHtml(content) ? EMPTY_LIST : content,
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (content === current) return;
    // Les deux sont vides : garder la liste à puces vide sans l'écraser
    if (isEmptyHtml(content) && isEmptyHtml(current)) return;
    editor.commands.setContent(isEmptyHtml(content) ? EMPTY_LIST : content);
  }, [content, editor]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled);
    }
  }, [disabled, editor]);

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

  // Ctrl+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        if (editor?.isFocused) {
          e.preventDefault();
          handleLinkToggle();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleLinkToggle, editor]);

  if (!editor) {
    return <div className={styles.editorLoading}>Chargement...</div>;
  }

  return (
    <div className={`${styles.outilsEditorContainer} ${disabled ? styles.editorDisabled : ''}`}>
      <div className={styles.outilsToolbar}>
        <button
          type="button"
          onClick={handleLinkToggle}
          className={`${styles.toolbarBtn} ${editor.isActive('link') ? styles.toolbarBtnActive : ''}`}
          disabled={disabled}
          title="Insérer un lien (Ctrl+K)"
        >
          🔗
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={`${styles.toolbarBtn} ${editor.isActive('bold') ? styles.toolbarBtnActive : ''}`}
          disabled={disabled}
          title="Gras (Ctrl+B)"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          className={`${styles.toolbarBtn} ${editor.isActive('bulletList') ? styles.toolbarBtnActive : ''}`}
          disabled={disabled}
          title="Liste à puces"
        >
          •
        </button>
      </div>

      {showLinkInput && (
        <div className={styles.outilsLinkBar}>
          <input
            type="url"
            className={styles.outilsLinkInput}
            placeholder="https://exemple.com"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleLinkSubmit();
              if (e.key === 'Escape') handleLinkCancel();
            }}
            autoFocus
          />
          <button type="button" className={styles.outilsLinkOk} onClick={handleLinkSubmit}>✓</button>
          <button type="button" className={styles.outilsLinkCancel} onClick={handleLinkCancel}>✕</button>
        </div>
      )}

      <EditorContent editor={editor} className={styles.outilsEditorContent} />
    </div>
  );
}
