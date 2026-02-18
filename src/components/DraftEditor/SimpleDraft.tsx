'use client';

import { useCallback } from 'react';
import type { DraftContent } from '@/types/travail';
import styles from './SimpleDraft.module.css';

interface SimpleDraftProps {
  draft: DraftContent;
  onChange: (draft: DraftContent) => void;
  disabled?: boolean;
}

export default function SimpleDraft({ draft, onChange, disabled = false }: SimpleDraftProps) {
  const notes = draft.notes || '';

  const handleChange = useCallback((value: string) => {
    onChange({ ...draft, notes: value });
  }, [draft, onChange]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.headerIcon}>📝</span>
        <h3>Brouillon</h3>
        <span className={styles.headerHint}>
          Notez vos idées clés, réflexions et pistes de rédaction
        </span>
      </div>

      <textarea
        className={styles.editor}
        value={notes}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Notez vos idées, vos réflexions, vos pistes de rédaction..."
        disabled={disabled}
      />
    </div>
  );
}
