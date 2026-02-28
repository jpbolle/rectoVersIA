import { Mark, Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { AddMarkStep, RemoveMarkStep } from '@tiptap/pm/transform';

// ────────────────────────────────────────────────────────
// ContentLock — ProseMirror plugin that blocks text edits
// but allows adding/removing marks (annotations)
// ────────────────────────────────────────────────────────

const contentLockKey = new PluginKey('contentLock');

export const ContentLock = Extension.create({
  name: 'contentLock',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: contentLockKey,

        filterTransaction(tr) {
          // Always allow selection-only transactions
          if (!tr.docChanged) return true;

          // Check each step: only allow AddMarkStep and RemoveMarkStep
          // Use instanceof (not constructor.name) to survive minification
          for (const step of tr.steps) {
            if (!(step instanceof AddMarkStep) && !(step instanceof RemoveMarkStep)) {
              return false;
            }
          }
          return true;
        },

        props: {
          handleKeyDown(_view, event) {
            // Allow navigation & selection keys
            const allowed = [
              'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
              'Home', 'End', 'PageUp', 'PageDown',
              'Shift', 'Control', 'Alt', 'Meta',
              'Escape', 'Tab',
            ];
            if (allowed.includes(event.key)) return false;

            // Allow Ctrl/Cmd shortcuts for copy & select-all
            if (event.ctrlKey || event.metaKey) {
              if (['c', 'a', 'C', 'A'].includes(event.key)) return false;
            }

            // Block everything else (typing, delete, backspace, enter…)
            return true;
          },

          handlePaste() {
            return true; // block
          },

          handleDrop() {
            return true; // block
          },
        },
      }),
    ];
  },
});

// ────────────────────────────────────────────────────────
// SpellingMark — red underline for spelling errors
// ────────────────────────────────────────────────────────

export const SpellingMark = Mark.create({
  name: 'spelling',

  parseHTML() {
    return [
      {
        tag: 'span[data-annotation="spelling"]',
      },
    ];
  },

  renderHTML() {
    return [
      'span',
      {
        'data-annotation': 'spelling',
        style: 'text-decoration: underline solid #e53935 2px !important; text-underline-offset: 3px;',
      },
      0,
    ];
  },
});

// ────────────────────────────────────────────────────────
// SyntaxMark — wavy orange underline for syntax errors
// ────────────────────────────────────────────────────────

export const SyntaxMark = Mark.create({
  name: 'syntax',

  parseHTML() {
    return [
      {
        tag: 'span[data-annotation="syntax"]',
      },
    ];
  },

  renderHTML() {
    return [
      'span',
      {
        'data-annotation': 'syntax',
        style: 'text-decoration: underline wavy #ff9800 !important; text-underline-offset: 3px;',
      },
      0,
    ];
  },
});

// ────────────────────────────────────────────────────────
// LexicalMark — "Lex" stamp with orange bubble via CSS
// ────────────────────────────────────────────────────────

export const LexicalMark = Mark.create({
  name: 'lexical',

  parseHTML() {
    return [
      {
        tag: 'span[data-annotation="lexical"]',
      },
    ];
  },

  renderHTML() {
    return [
      'span',
      {
        'data-annotation': 'lexical',
        class: 'annotation-lexical',
      },
      0,
    ];
  },
});

// ────────────────────────────────────────────────────────
// StudentCommentMark — dotted underline with tooltip
// (used by students in resource annotation editor)
// ────────────────────────────────────────────────────────

export const StudentCommentMark = Mark.create({
  name: 'studentComment',

  addAttributes() {
    return {
      comment: {
        default: '',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-student-comment'),
        renderHTML: (attributes: Record<string, string>) => {
          if (!attributes.comment) return {};
          return { 'data-student-comment': attributes.comment };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-student-comment]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      {
        ...HTMLAttributes,
        class: 'student-comment-mark',
      },
      0,
    ];
  },
});

// ────────────────────────────────────────────────────────
// VoiceAnnotationMark — yellow highlight with audio link
// ────────────────────────────────────────────────────────

export const VoiceAnnotationMark = Mark.create({
  name: 'voiceAnnotation',

  addAttributes() {
    return {
      audioId: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-audio-id'),
        renderHTML: (attributes: Record<string, string | null>) => {
          if (!attributes.audioId) return {};
          return { 'data-audio-id': attributes.audioId };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-annotation="voice"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      {
        ...HTMLAttributes,
        'data-annotation': 'voice',
        style: 'background: rgba(66, 133, 244, 0.15);',
      },
      0,
    ];
  },
});
