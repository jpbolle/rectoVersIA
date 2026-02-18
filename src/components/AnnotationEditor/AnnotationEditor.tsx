'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { FontFamily } from '@tiptap/extension-font-family';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LineHeight, Indent, FontSize } from '@/lib/tiptap-extensions';
import {
  ContentLock,
  SpellingMark,
  SyntaxMark,
  LexicalMark,
  VoiceAnnotationMark,
} from '@/lib/tiptap-annotations';
import { blobToDataUrl } from '@/lib/firebase/audio-storage';
import {
  ProfAiDecorationsExtension,
  updateProfAiDecorations,
} from '@/lib/tiptap-ai-decorations-prof';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import AnnotationToolbar from '@/components/AnnotationToolbar';
import type { AnnotationTool } from '@/components/AnnotationToolbar';
import type { AudioAnnotation } from '@/types/correction';
import type { AiSuggestion, AiSuggestionType } from '@/types/ai-suggestions';
import styles from './AnnotationEditor.module.css';

const BUBBLE_LETTERS: Record<AiSuggestionType, string> = {
  ortho: 'O', ponctu: 'P', synt: 'S', lex: 'L',
};
const SECTION_LABELS: Record<AiSuggestionType, string> = {
  ortho: 'Orthographe', ponctu: 'Ponctuation', synt: 'Syntaxe', lex: 'Lexique',
};

interface AnnotationEditorProps {
  studentContent: string;
  annotatedContent?: string;
  audioAnnotations?: AudioAnnotation[];
  correctionId: string;
  onAnnotatedContentChange: (html: string) => void;
  onAudioAnnotationsChange: (annotations: AudioAnnotation[]) => void;
  aiSuggestions?: Record<AiSuggestionType, AiSuggestion | null>;
}

export default function AnnotationEditor({
  studentContent,
  annotatedContent,
  audioAnnotations = [],
  correctionId,
  onAnnotatedContentChange,
  onAudioAnnotationsChange,
  aiSuggestions,
}: AnnotationEditorProps) {
  const [activeTool, setActiveTool] = useState<AnnotationTool>(null);
  const [audioBubbles, setAudioBubbles] = useState<
    { id: string; url: string; top: number; left: number }[]
  >([]);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [selectionPopup, setSelectionPopup] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const editorWrapperRef = useRef<HTMLDivElement>(null);
  const voiceSelectionRef = useRef<{ from: number; to: number } | null>(null);
  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;

  // IA suggestion popup
  const [aiPopup, setAiPopup] = useState<{
    content: string;
    type: AiSuggestionType;
    dismissed: boolean;
    top: number;
    left: number;
  } | null>(null);
  const aiPopupCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentBubbleId = useRef<string | null>(null);

  const { isRecording, recordingDuration, startRecording, stopRecording, error: recorderError } =
    useAudioRecorder();

  const audioAnnotationsRef = useRef(audioAnnotations);
  audioAnnotationsRef.current = audioAnnotations;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      TextStyle,
      FontFamily.configure({ types: ['textStyle'] }),
      FontSize,
      LineHeight,
      Indent,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false }),
      ContentLock,
      SpellingMark,
      SyntaxMark,
      LexicalMark,
      VoiceAnnotationMark,
      ProfAiDecorationsExtension,
    ],
    content: annotatedContent || studentContent,
    editable: true,
    immediatelyRender: false,
    onUpdate: ({ editor: ed }) => {
      onAnnotatedContentChange(ed.getHTML());
    },
  });

  // ─── Selection popup: show on non-empty selection ───
  useEffect(() => {
    if (!editor) return;

    const handleSelectionUpdate = () => {
      // Don't show popup during recording or when a tool is active
      if (isRecording || activeToolRef.current !== null) {
        setSelectionPopup(null);
        return;
      }

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

    editor.on('selectionUpdate', handleSelectionUpdate);

    // Hide popup immediately when a tool is activated
    if (activeTool !== null) {
      setSelectionPopup(null);
    }

    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate);
    };
  }, [editor, isRecording, activeTool]);

  // ─── Apply a text mark from popup (or toolbar click-to-annotate) ───
  const applyMarkFromPopup = useCallback(
    (markName: 'spelling' | 'syntax' | 'lexical') => {
      if (!editor) return;

      const { from, to } = editor.state.selection;
      if (from === to) return;

      if (editor.isActive(markName)) {
        editor.chain().focus().unsetMark(markName).run();
      } else {
        editor.chain().focus().setMark(markName).run();
      }

      // Keep popup open — user might want to apply another mark
    },
    [editor],
  );

  // ─── Eraser: remove all annotation marks from selection ───
  const eraseAnnotations = useCallback(() => {
    if (!editor) return;

    const { from, to } = editor.state.selection;
    if (from === to) return;

    editor
      .chain()
      .focus()
      .unsetMark('spelling')
      .unsetMark('syntax')
      .unsetMark('lexical')
      .unsetMark('voiceAnnotation')
      .run();
  }, [editor]);

  // ─── Voice: save selection, start recording ───
  const startVoiceFromPopup = useCallback(async () => {
    if (!editor) return;

    const { from, to } = editor.state.selection;
    if (from === to) return;

    // Save selection before recording (it will be lost on stop-click)
    voiceSelectionRef.current = { from, to };
    setSelectionPopup(null);

    await startRecording();
  }, [editor, startRecording]);

  // ─── Voice: stop recording, restore selection, apply mark ───
  const handleStopRecording = useCallback(async () => {
    if (!editor) return;

    const blob = await stopRecording();
    if (!blob) return;

    try {
      const id = `${Date.now()}`;
      const dataUrl = await blobToDataUrl(blob);

      // Restore saved selection
      const sel = voiceSelectionRef.current;
      if (sel) {
        editor.commands.setTextSelection(sel);
      }

      // Apply highlight mark
      editor.chain().focus().setMark('voiceAnnotation', { audioId: id }).run();

      const newAnnotation: AudioAnnotation = {
        id,
        audioData: dataUrl,
        createdAt: new Date().toISOString(),
      };

      const updated = [...audioAnnotationsRef.current, newAnnotation];
      onAudioAnnotationsChange(updated);
      onAnnotatedContentChange(editor.getHTML());

      voiceSelectionRef.current = null;
    } catch (err) {
      console.error('Erreur enregistrement audio:', err);
    }
  }, [editor, stopRecording, correctionId, onAnnotatedContentChange, onAudioAnnotationsChange]);

  // ─── Toolbar click-to-annotate (legacy: expand word on click) ───
  const handleEditorClick = useCallback(() => {
    if (!editor || !activeTool || activeTool === 'voice') return;

    const { state } = editor;
    const { from, to } = state.selection;

    // If there's already a selection, the popup handles it
    if (from !== to) return;

    // Expand to word
    const doc = state.doc;
    const $pos = doc.resolve(from);
    const textContent = $pos.parent.textContent;
    const offset = $pos.parentOffset;

    if (!textContent || offset > textContent.length) return;

    const wordRegex = /[\p{L}\p{N}'\-]+/gu;
    let match;

    while ((match = wordRegex.exec(textContent)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (offset >= start && offset <= end) {
        const nodeStart = $pos.start();
        editor.commands.setTextSelection({
          from: nodeStart + start,
          to: nodeStart + end,
        });

        const markName = activeTool as 'spelling' | 'syntax' | 'lexical';
        if (editor.isActive(markName)) {
          editor.chain().unsetMark(markName).run();
        } else {
          editor.chain().setMark(markName).run();
        }
        return;
      }
    }
  }, [editor, activeTool]);

  // ─── Position audio play bubbles ───
  const updateAudioBubbles = useCallback(() => {
    if (!editorWrapperRef.current || !audioAnnotations.length) {
      setAudioBubbles([]);
      return;
    }

    const wrapper = editorWrapperRef.current;
    const wrapperRect = wrapper.getBoundingClientRect();
    const voiceSpans = wrapper.querySelectorAll('[data-annotation="voice"]');

    const bubbles: { id: string; url: string; top: number; left: number }[] = [];
    const seen = new Set<string>();

    voiceSpans.forEach((span) => {
      const audioId = span.getAttribute('data-audio-id');
      if (!audioId || seen.has(audioId)) return;
      seen.add(audioId);

      const annotation = audioAnnotations.find((a) => a.id === audioId);
      if (!annotation) return;

      const rect = span.getBoundingClientRect();
      // Position au-dessus du passage surligné (dans l'interligne)
      bubbles.push({
        id: audioId,
        url: annotation.audioData,
        top: rect.top - wrapperRect.top + wrapper.scrollTop - 38,
        left: rect.left - wrapperRect.left + wrapper.scrollLeft,
      });
    });

    setAudioBubbles(bubbles);
  }, [audioAnnotations]);

  // Recalculate bubbles after editor updates
  useEffect(() => {
    if (!editor) return;
    const handler = () => requestAnimationFrame(updateAudioBubbles);
    editor.on('update', handler);
    requestAnimationFrame(updateAudioBubbles);
    return () => {
      editor.off('update', handler);
    };
  }, [editor, updateAudioBubbles]);

  // Also recalculate on scroll
  useEffect(() => {
    const wrapper = editorWrapperRef.current;
    if (!wrapper) return;
    const handler = () => requestAnimationFrame(updateAudioBubbles);
    wrapper.addEventListener('scroll', handler, { passive: true });
    return () => wrapper.removeEventListener('scroll', handler);
  }, [updateAudioBubbles]);

  // ─── AI suggestion decorations (prof side) ───
  useEffect(() => {
    if (!editor || !aiSuggestions) return;
    const hasSuggestions = Object.values(aiSuggestions).some(s => s !== null);
    if (hasSuggestions) {
      // Petit délai pour laisser l'éditeur se stabiliser
      const timer = setTimeout(() => {
        updateProfAiDecorations(editor, aiSuggestions);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [editor, aiSuggestions]);

  // ─── AI bubble hover popup ───
  const handleAiBubbleMouseOver = useCallback((e: React.MouseEvent) => {
    const bubble = (e.target as HTMLElement).closest('[data-ai-bubble-item]');
    if (!bubble) return;

    const itemId = bubble.getAttribute('data-ai-bubble-item');
    if (!itemId || itemId === currentBubbleId.current) return;

    // Cancel pending close
    if (aiPopupCloseTimer.current) {
      clearTimeout(aiPopupCloseTimer.current);
      aiPopupCloseTimer.current = null;
    }

    currentBubbleId.current = itemId;

    const type = bubble.getAttribute('data-ai-bubble-type') as AiSuggestionType;
    const dismissed = bubble.getAttribute('data-ai-dismissed') === 'true';
    const content = bubble.getAttribute('data-ai-bubble-content') || '';

    const rect = bubble.getBoundingClientRect();

    // Position fixed (viewport coords) — passe devant header, bandeau, etc.
    setAiPopup({
      content,
      type,
      dismissed,
      top: rect.top - 8,
      left: rect.left + 12,
    });
  }, []);

  const scheduleAiPopupClose = useCallback(() => {
    if (aiPopupCloseTimer.current) clearTimeout(aiPopupCloseTimer.current);
    aiPopupCloseTimer.current = setTimeout(() => {
      setAiPopup(null);
      currentBubbleId.current = null;
      aiPopupCloseTimer.current = null;
    }, 150);
  }, []);

  const handleAiBubbleMouseOut = useCallback((e: React.MouseEvent) => {
    const related = e.relatedTarget as HTMLElement | null;
    if (related?.closest('[data-ai-bubble-item]') || related?.closest(`.${styles.aiPopup}`)) return;
    scheduleAiPopupClose();
  }, [scheduleAiPopupClose]);

  const toggleAudio = useCallback((audioId: string, url: string) => {
    // Si on clique sur l'audio en cours de lecture, mettre en pause
    if (playingAudioId === audioId && audioRef.current) {
      audioRef.current.pause();
      setPlayingAudioId(null);
      audioRef.current = null;
      return;
    }

    // Arrêter l'audio précédent s'il y en a un
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // Créer et jouer le nouvel audio
    const audio = new Audio(url);
    audioRef.current = audio;
    setPlayingAudioId(audioId);

    audio.play().catch((err) => {
      console.error('Erreur lecture audio:', err);
      setPlayingAudioId(null);
      audioRef.current = null;
    });

    // Quand l'audio se termine
    audio.onended = () => {
      setPlayingAudioId(null);
      audioRef.current = null;
    };
  }, [playingAudioId]);

  // ─── Delete audio annotation ───
  const deleteAudioAnnotation = useCallback((audioId: string) => {
    if (!editor) return;

    // Remove from annotations array
    const updatedAnnotations = audioAnnotationsRef.current.filter((a) => a.id !== audioId);
    onAudioAnnotationsChange(updatedAnnotations);

    // Remove the mark from editor content
    const { doc } = editor.state;
    const tr = editor.state.tr;
    let modified = false;

    doc.descendants((node, pos) => {
      if (!node.isText) return;
      node.marks.forEach((mark) => {
        if (mark.type.name === 'voiceAnnotation' && mark.attrs.audioId === audioId) {
          tr.removeMark(pos, pos + node.nodeSize, mark.type);
          modified = true;
        }
      });
    });

    if (modified) {
      editor.view.dispatch(tr);
      onAnnotatedContentChange(editor.getHTML());
    }
  }, [editor, onAudioAnnotationsChange, onAnnotatedContentChange]);

  if (!editor) {
    return <div className={styles.loading}>Chargement de l&apos;editeur...</div>;
  }

  return (
    <div className={styles.container}>
      <AnnotationToolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        isRecording={isRecording}
        recordingDuration={recordingDuration}
        onStopRecording={handleStopRecording}
      />

      {recorderError && <div className={styles.errorBar}>{recorderError}</div>}

      <div
        className={styles.editorWrapper}
        ref={editorWrapperRef}
        onMouseOver={handleAiBubbleMouseOver}
        onMouseOut={handleAiBubbleMouseOut}
      >
        <EditorContent
          editor={editor}
          className={styles.editor}
          onClick={handleEditorClick}
        />

        {/* ── Selection popup ── */}
        {selectionPopup && !isRecording && (
          <div
            className={styles.selectionPopup}
            style={{ top: selectionPopup.top, left: selectionPopup.left }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <button
              type="button"
              className={styles.popupBtn}
              onClick={() => applyMarkFromPopup('spelling')}
              title="Orthographe"
            >
              <span className={styles.popupOrth}>Orth</span>
            </button>
            <button
              type="button"
              className={styles.popupBtn}
              onClick={() => applyMarkFromPopup('syntax')}
              title="Syntaxe"
            >
              <span className={styles.popupSynt}>Synt</span>
            </button>
            <button
              type="button"
              className={styles.popupBtn}
              onClick={() => applyMarkFromPopup('lexical')}
              title="Lexique"
            >
              <span className={styles.popupLex}>Lex</span>
            </button>
            <button
              type="button"
              className={styles.popupBtn}
              onClick={startVoiceFromPopup}
              title="Commentaire vocal"
            >
              <span className={styles.popupVoice}>&#128172;</span>
            </button>
            <span className={styles.popupSep} />
            <button
              type="button"
              className={styles.popupBtn}
              onClick={eraseAnnotations}
              title="Effacer les annotations"
            >
              <svg className={styles.popupEraser} width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="2" y="9.5" width="10" height="5.5" rx="1.2" transform="rotate(-30 2 9.5)" fill="#e8a0b4"/>
                <rect x="7" y="6" width="6.5" height="5.5" rx="1.2" transform="rotate(-30 7 6)" fill="#78909c"/>
                <line x1="2" y1="15.5" x2="16" y2="15.5" stroke="#b0bec5" strokeWidth="1.2"/>
              </svg>
            </button>
          </div>
        )}

        {/* ── Audio play bubbles ── */}
        {audioBubbles.map((bubble) => {
          const isPlaying = playingAudioId === bubble.id;
          return (
            <div
              key={bubble.id}
              className={styles.audioBubble}
              style={{ top: bubble.top, left: bubble.left }}
            >
              <button
                className={styles.audioBubbleInner}
                onClick={() => toggleAudio(bubble.id, bubble.url)}
                type="button"
                title={isPlaying ? "Mettre en pause" : "Écouter le commentaire vocal"}
              >
                {isPlaying ? (
                  <span className={styles.audioBubblePause}>&#10074;&#10074;</span>
                ) : (
                  <span className={styles.audioBubblePlay}>&#9654;</span>
                )}
              </button>
              <button
                className={styles.audioBubbleDeleteBtn}
                onClick={() => deleteAudioAnnotation(bubble.id)}
                type="button"
                title="Supprimer le commentaire"
              >
                ×
              </button>
            </div>
          );
        })}

      </div>

      {/* ── AI suggestion popup (fixed, au-dessus de tout) ── */}
      {aiPopup && (
        <div
          className={styles.aiPopup}
          style={{ top: aiPopup.top, left: aiPopup.left }}
          onMouseEnter={() => {
            if (aiPopupCloseTimer.current) {
              clearTimeout(aiPopupCloseTimer.current);
              aiPopupCloseTimer.current = null;
            }
          }}
          onMouseLeave={scheduleAiPopupClose}
        >
          <div className={styles.aiPopupHeader}>
            <span className={`${styles.aiPopupBadge} ${styles[`aiPopupBadge_${aiPopup.type}`]}`}>
              {BUBBLE_LETTERS[aiPopup.type]}
            </span>
            <span className={styles.aiPopupLabel}>
              {SECTION_LABELS[aiPopup.type]}
            </span>
            {aiPopup.dismissed && (
              <span className={styles.aiPopupDismissed}>Corrigé</span>
            )}
          </div>
          <p className={styles.aiPopupContent}>{aiPopup.content}</p>
        </div>
      )}
    </div>
  );
}
