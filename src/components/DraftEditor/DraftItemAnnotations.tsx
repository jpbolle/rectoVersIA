'use client';

import { useRef, useCallback, useEffect } from 'react';
import type { DraftItemAnnotation } from '@/types/correction';
import styles from './DraftItemAnnotations.module.css';

interface DraftItemAnnotationsProps {
  itemId: string;
  annotation?: DraftItemAnnotation;
  onChange: (itemId: string, annotation: DraftItemAnnotation) => void;
  isRecording: boolean;
  recordingItemId: string | null;
  recordingDuration: number;
  onStartRecording: (itemId: string) => void;
  onStopRecording: () => void;
  readOnly?: boolean;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function DraftItemAnnotations({
  itemId,
  annotation,
  onChange,
  isRecording,
  recordingItemId,
  recordingDuration,
  onStartRecording,
  onStopRecording,
  readOnly = false,
}: DraftItemAnnotationsProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isThisRecording = !readOnly && isRecording && recordingItemId === itemId;
  const hasAudio = !!annotation?.audio;
  const hasStatus = !!annotation?.status;

  const toggleStatus = useCallback((status: 'correct' | 'incorrect') => {
    if (readOnly) return;
    const current = annotation?.status;
    onChange(itemId, {
      ...annotation,
      status: current === status ? undefined : status,
    });
  }, [itemId, annotation, onChange, readOnly]);

  const handlePlay = useCallback(() => {
    if (!annotation?.audio) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      return;
    }
    const audio = new Audio(annotation.audio);
    audioRef.current = audio;
    audio.onended = () => { audioRef.current = null; };
    audio.play();
  }, [annotation?.audio]);

  const handleDeleteAudio = useCallback(() => {
    if (readOnly) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    onChange(itemId, {
      ...annotation,
      audio: undefined,
    });
  }, [itemId, annotation, onChange, readOnly]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Mode lecture seule : n'afficher que les annotations qui existent
  if (readOnly) {
    return (
      <div className={styles.container}>
        {annotation?.status === 'correct' && (
          <span className={`${styles.statusBtn} ${styles.correctBtn} ${styles.correctActive} ${styles.statusBtnReadOnly}`}>
            ✓
          </span>
        )}
        {annotation?.status === 'incorrect' && (
          <span className={`${styles.statusBtn} ${styles.incorrectBtn} ${styles.incorrectActive} ${styles.statusBtnReadOnly}`}>
            ✗
          </span>
        )}
        {hasAudio && (
          <button
            type="button"
            className={styles.playBtn}
            onClick={handlePlay}
            title="Écouter le commentaire"
          >
            &#9654;
          </button>
        )}
      </div>
    );
  }

  // Mode interactif (prof)
  return (
    <div className={styles.container}>
      {/* Bouton ✓ */}
      <button
        type="button"
        className={`${styles.statusBtn} ${styles.correctBtn} ${annotation?.status === 'correct' ? styles.correctActive : ''}`}
        onClick={() => toggleStatus('correct')}
        title="Correct"
      >
        ✓
      </button>

      {/* Bouton ✗ */}
      <button
        type="button"
        className={`${styles.statusBtn} ${styles.incorrectBtn} ${annotation?.status === 'incorrect' ? styles.incorrectActive : ''}`}
        onClick={() => toggleStatus('incorrect')}
        title="Incorrect"
      >
        ✗
      </button>

      {/* Enregistrement en cours pour cet item */}
      {isThisRecording ? (
        <div className={styles.recordingUI}>
          <span className={styles.recordingDot} />
          <span className={styles.recordingTime}>{formatDuration(recordingDuration)}</span>
          <button
            type="button"
            className={styles.stopBtn}
            onClick={onStopRecording}
            title="Arrêter"
          >
            &#9632;
          </button>
        </div>
      ) : hasAudio ? (
        /* Audio enregistré : play + delete */
        <div className={styles.audioPlayback}>
          <button
            type="button"
            className={styles.playBtn}
            onClick={handlePlay}
            title="Écouter"
          >
            &#9654;
          </button>
          <button
            type="button"
            className={styles.deleteAudioBtn}
            onClick={handleDeleteAudio}
            title="Supprimer l'audio"
          >
            ×
          </button>
        </div>
      ) : (
        /* Bouton micro */
        <button
          type="button"
          className={styles.voiceBtn}
          onClick={() => onStartRecording(itemId)}
          disabled={isRecording}
          title="Commentaire vocal"
        >
          🎤
        </button>
      )}
    </div>
  );
}
