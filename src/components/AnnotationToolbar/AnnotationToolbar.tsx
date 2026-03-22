'use client';

import styles from './AnnotationToolbar.module.css';

export type AnnotationTool = 'spelling' | 'syntax' | 'ponctu' | 'lexical' | 'voice' | null;

interface AnnotationToolbarProps {
  activeTool: AnnotationTool;
  onToolChange: (tool: AnnotationTool) => void;
  isRecording: boolean;
  recordingDuration: number;
  onStopRecording: () => void;
  profViewOnly?: boolean;
  onProfViewOnlyChange?: (value: boolean) => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function AnnotationToolbar({
  activeTool,
  onToolChange,
  isRecording,
  recordingDuration,
  onStopRecording,
  profViewOnly = false,
  onProfViewOnlyChange,
}: AnnotationToolbarProps) {
  const toggle = (tool: AnnotationTool) => {
    onToolChange(activeTool === tool ? null : tool);
  };

  return (
    <div className={styles.toolbar}>
      <span className={styles.label}>Annotations :</span>

      <button
        type="button"
        className={`${styles.btn} ${activeTool === 'spelling' ? styles.active : ''}`}
        onClick={() => toggle('spelling')}
        title="Orthographe (souligne rouge)"
      >
        <span className={styles.spellingIcon}>Orth</span>
      </button>

      <button
        type="button"
        className={`${styles.btn} ${activeTool === 'syntax' ? styles.active : ''}`}
        onClick={() => toggle('syntax')}
        title="Syntaxe (ondule orange)"
      >
        <span className={styles.syntaxIcon}>Synt</span>
      </button>

      <button
        type="button"
        className={`${styles.btn} ${activeTool === 'ponctu' ? styles.active : ''}`}
        onClick={() => toggle('ponctu')}
        title="Ponctuation (pointillé gris)"
      >
        <span className={styles.ponctuIcon}>Ponct</span>
      </button>

      <button
        type="button"
        className={`${styles.btn} ${activeTool === 'lexical' ? styles.active : ''}`}
        onClick={() => toggle('lexical')}
        title="Lexique (tampon Lex)"
      >
        <span className={styles.lexicalIcon}>Lex</span>
      </button>

      <button
        type="button"
        className={`${styles.btn} ${activeTool === 'voice' ? styles.active : ''}`}
        onClick={() => toggle('voice')}
        title="Commentaire vocal"
        disabled={isRecording}
      >
        <span className={styles.voiceIcon}>&#128172;</span>
      </button>

      {onProfViewOnlyChange && (
        <label className={`${styles.profViewOnlyToggle} ${profViewOnly ? styles.profViewOnlyActive : ''}`}>
          <input
            type="checkbox"
            checked={profViewOnly}
            onChange={(e) => onProfViewOnlyChange(e.target.checked)}
            className={styles.profViewOnlyCheckbox}
          />
          <span className={styles.profViewOnlyTrack} />
          <span className={styles.profViewOnlyLabel}>
            {profViewOnly ? 'Masquer remarques IA et réécritures' : 'Afficher remarques IA et réécritures'}
          </span>
        </label>
      )}

      {isRecording && (
        <div className={styles.recording}>
          <span className={styles.recordingDot} />
          <span className={styles.recordingTime}>{formatDuration(recordingDuration)}</span>
          <button
            type="button"
            className={styles.stopBtn}
            onClick={onStopRecording}
            title="Arreter l'enregistrement"
          >
            &#9632; Stop
          </button>
        </div>
      )}
    </div>
  );
}
