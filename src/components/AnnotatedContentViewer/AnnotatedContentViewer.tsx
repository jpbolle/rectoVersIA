'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AudioAnnotation } from '@/types/correction';
import styles from './AnnotatedContentViewer.module.css';

interface AnnotatedContentViewerProps {
  annotatedContent: string;
  audioAnnotations?: AudioAnnotation[];
}

export default function AnnotatedContentViewer({
  annotatedContent,
  audioAnnotations = [],
}: AnnotatedContentViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [audioBubbles, setAudioBubbles] = useState<
    { id: string; url: string; top: number; left: number }[]
  >([]);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const updateBubbles = useCallback(() => {
    if (!containerRef.current || !audioAnnotations.length) {
      setAudioBubbles([]);
      return;
    }

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const voiceSpans = container.querySelectorAll('[data-annotation="voice"]');

    const bubbles: typeof audioBubbles = [];
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
        top: rect.top - containerRect.top - 38,
        left: rect.left - containerRect.left,
      });
    });

    setAudioBubbles(bubbles);
  }, [audioAnnotations]);

  useEffect(() => {
    requestAnimationFrame(updateBubbles);
  }, [updateBubbles, annotatedContent]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = () => requestAnimationFrame(updateBubbles);
    el.addEventListener('scroll', handler, { passive: true });
    return () => el.removeEventListener('scroll', handler);
  }, [updateBubbles]);

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

  return (
    <div className={styles.container} ref={containerRef}>
      <div
        className={styles.content}
        dangerouslySetInnerHTML={{ __html: annotatedContent }}
      />

      {audioBubbles.map((bubble) => {
        const isPlaying = playingAudioId === bubble.id;
        return (
          <button
            key={bubble.id}
            className={styles.audioBubble}
            style={{ top: bubble.top, left: bubble.left }}
            onClick={() => toggleAudio(bubble.id, bubble.url)}
            title={isPlaying ? "Mettre en pause" : "Écouter le commentaire vocal"}
            type="button"
          >
            {isPlaying ? (
              <span className={styles.audioBubblePause}>&#10074;&#10074;</span>
            ) : (
              <span className={styles.audioBubblePlay}>&#9654;</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
