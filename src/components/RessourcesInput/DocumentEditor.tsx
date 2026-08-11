'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Indent } from '@/lib/tiptap-extensions';
import { useCallback, useEffect } from 'react';
import styles from './RessourcesInput.module.css';

interface DocumentEditorProps {
  content: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function DocumentEditor({
  content,
  onChange,
  disabled = false,
  placeholder = 'Rédigez votre document ici...',
}: DocumentEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      Indent,
    ],
    content,
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Update content if changed externally
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled);
    }
  }, [disabled, editor]);

  const handleHeading2 = useCallback(() => {
    editor?.chain().focus().toggleHeading({ level: 2 }).run();
  }, [editor]);

  const handleHeading3 = useCallback(() => {
    editor?.chain().focus().toggleHeading({ level: 3 }).run();
  }, [editor]);

  const handleParagraph = useCallback(() => {
    editor?.chain().focus().setParagraph().run();
  }, [editor]);

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

  const handleIndent = useCallback(() => {
    editor?.chain().focus().indent().run();
  }, [editor]);

  const handleOutdent = useCallback(() => {
    editor?.chain().focus().outdent().run();
  }, [editor]);

  if (!editor) {
    return <div className={styles.editorLoading}>Chargement...</div>;
  }

  return (
    <div className={`${styles.editorContainer} ${disabled ? styles.editorDisabled : ''}`}>
      <div className={styles.editorToolbar}>
        <button
          type="button"
          onClick={handleParagraph}
          className={`${styles.toolbarBtn} ${editor.isActive('paragraph') && !editor.isActive('heading') ? styles.toolbarBtnActive : ''}`}
          disabled={disabled}
          title="Paragraphe"
        >
          ¶
        </button>
        <button
          type="button"
          onClick={handleHeading2}
          className={`${styles.toolbarBtn} ${editor.isActive('heading', { level: 2 }) ? styles.toolbarBtnActive : ''}`}
          disabled={disabled}
          title="Titre"
        >
          H2
        </button>
        <button
          type="button"
          onClick={handleHeading3}
          className={`${styles.toolbarBtn} ${editor.isActive('heading', { level: 3 }) ? styles.toolbarBtnActive : ''}`}
          disabled={disabled}
          title="Sous-titre"
        >
          H3
        </button>

        <span className={styles.toolbarSep} />

        <button
          type="button"
          onClick={handleBold}
          className={`${styles.toolbarBtn} ${editor.isActive('bold') ? styles.toolbarBtnActive : ''}`}
          disabled={disabled}
          title="Gras (Ctrl+B)"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          onClick={handleItalic}
          className={`${styles.toolbarBtn} ${editor.isActive('italic') ? styles.toolbarBtnActive : ''}`}
          disabled={disabled}
          title="Italique (Ctrl+I)"
        >
          <em>I</em>
        </button>

        <span className={styles.toolbarSep} />

        <button
          type="button"
          onClick={handleBulletList}
          className={`${styles.toolbarBtn} ${editor.isActive('bulletList') ? styles.toolbarBtnActive : ''}`}
          disabled={disabled}
          title="Liste à puces"
        >
          •
        </button>
        <button
          type="button"
          onClick={handleOrderedList}
          className={`${styles.toolbarBtn} ${editor.isActive('orderedList') ? styles.toolbarBtnActive : ''}`}
          disabled={disabled}
          title="Liste numérotée"
        >
          1.
        </button>

        <span className={styles.toolbarSep} />

        <button
          type="button"
          onClick={handleOutdent}
          className={styles.toolbarBtn}
          disabled={disabled}
          title="Diminuer l'alinéa (Shift+Tab)"
        >
          ←
        </button>
        <button
          type="button"
          onClick={handleIndent}
          className={styles.toolbarBtn}
          disabled={disabled}
          title="Augmenter l'alinéa (Tab)"
        >
          →
        </button>
      </div>

      <EditorContent editor={editor} className={styles.editorContent} />
    </div>
  );
}
