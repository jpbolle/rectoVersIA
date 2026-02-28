'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import styles from './ResizableSplit.module.css';

interface ResizableSplitProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultLeftPercent?: number;
  minLeftPercent?: number;
  maxLeftPercent?: number;
  storageKey?: string;
}

export default function ResizableSplit({
  left,
  right,
  defaultLeftPercent = 60,
  minLeftPercent = 30,
  maxLeftPercent = 80,
  storageKey,
}: ResizableSplitProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  // Initialiser depuis localStorage si disponible
  const [leftPercent, setLeftPercent] = useState<number>(() => {
    if (storageKey && typeof window !== 'undefined') {
      const saved = localStorage.getItem(`split-${storageKey}`);
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val >= minLeftPercent && val <= maxLeftPercent) {
          return val;
        }
      }
    }
    return defaultLeftPercent;
  });

  // Persister dans localStorage
  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(`split-${storageKey}`, String(leftPercent));
    }
  }, [leftPercent, storageKey]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      isDragging.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      document.body.classList.add(styles.dragging);
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percent = (x / rect.width) * 100;
      const clamped = Math.min(maxLeftPercent, Math.max(minLeftPercent, percent));
      setLeftPercent(clamped);
    },
    [minLeftPercent, maxLeftPercent]
  );

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
    document.body.classList.remove(styles.dragging);
  }, []);

  // Double-clic → reset
  const handleDoubleClick = useCallback(() => {
    setLeftPercent(defaultLeftPercent);
  }, [defaultLeftPercent]);

  return (
    <div ref={containerRef} className={styles.container}>
      <div className={styles.left} style={{ flex: `0 0 ${leftPercent}%` }}>
        {left}
      </div>

      <div
        className={`${styles.divider} ${isDragging.current ? styles.dividerActive : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      >
        <div className={styles.handle}>
          <span />
          <span />
          <span />
        </div>
      </div>

      <div className={styles.right}>
        {right}
      </div>
    </div>
  );
}
