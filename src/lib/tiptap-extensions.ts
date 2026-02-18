import { Extension } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    lineHeight: {
      setLineHeight: (lineHeight: string) => ReturnType;
      unsetLineHeight: () => ReturnType;
    };
    indent: {
      indent: () => ReturnType;
      outdent: () => ReturnType;
    };
    fontSize: {
      setFontSize: (fontSize: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

// Extension pour l'interligne
export const LineHeight = Extension.create({
  name: 'lineHeight',

  addOptions() {
    return {
      types: ['paragraph', 'heading'],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.lineHeight || null,
            renderHTML: (attributes: Record<string, string | null>) => {
              if (!attributes.lineHeight) {
                return {};
              }
              return {
                style: `line-height: ${attributes.lineHeight}`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setLineHeight:
        (lineHeight: string) =>
        ({ commands }) => {
          return this.options.types.every((type: string) =>
            commands.updateAttributes(type, { lineHeight })
          );
        },
      unsetLineHeight:
        () =>
        ({ commands }) => {
          return this.options.types.every((type: string) =>
            commands.resetAttributes(type, 'lineHeight')
          );
        },
    };
  },
});

// Extension pour l'alinea (retrait premiere ligne uniquement via text-indent)
export const Indent = Extension.create({
  name: 'indent',

  addOptions() {
    return {
      types: ['paragraph', 'heading'],
      minLevel: 0,
      maxLevel: 8,
      indentSize: 30,
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element: HTMLElement) => {
              const indent = element.style.textIndent;
              return indent ? parseInt(indent) / 30 : 0;
            },
            renderHTML: (attributes: Record<string, number>) => {
              if (!attributes.indent) {
                return {};
              }
              return {
                style: `text-indent: ${attributes.indent * 30}px`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      indent:
        () =>
        ({ commands, state }) => {
          const { selection } = state;
          const { $from } = selection;
          const node = $from.node();
          const currentIndent = (node.attrs.indent as number) || 0;

          if (currentIndent < this.options.maxLevel) {
            return this.options.types.every((type: string) =>
              commands.updateAttributes(type, { indent: currentIndent + 1 })
            );
          }
          return false;
        },
      outdent:
        () =>
        ({ commands, state }) => {
          const { selection } = state;
          const { $from } = selection;
          const node = $from.node();
          const currentIndent = (node.attrs.indent as number) || 0;

          if (currentIndent > this.options.minLevel) {
            return this.options.types.every((type: string) =>
              commands.updateAttributes(type, { indent: currentIndent - 1 })
            );
          }
          return false;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => this.editor.commands.indent(),
      'Shift-Tab': () => this.editor.commands.outdent(),
    };
  },
});

// Extension pour la taille de police
export const FontSize = Extension.create({
  name: 'fontSize',

  addOptions() {
    return {
      types: ['textStyle'],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontSize?.replace('px', '') || null,
            renderHTML: (attributes: Record<string, string | null>) => {
              if (!attributes.fontSize) {
                return {};
              }
              return {
                style: `font-size: ${attributes.fontSize}px`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }) => {
          return chain().setMark('textStyle', { fontSize }).run();
        },
      unsetFontSize:
        () =>
        ({ chain }) => {
          return chain().setMark('textStyle', { fontSize: null }).run();
        },
    };
  },
});
