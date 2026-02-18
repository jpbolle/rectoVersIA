'use client';

import { useEffect } from 'react';
import styles from './MessageBox.module.css';

interface MessageBoxProps {
  message: string | null;
  type: 'success' | 'error';
  onDismiss?: () => void;
}

export default function MessageBox({ message, type, onDismiss }: MessageBoxProps) {
  useEffect(() => {
    if (message && onDismiss) {
      const timer = setTimeout(() => onDismiss(), 5000);
      return () => clearTimeout(timer);
    }
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div className={`${styles.message} ${type === 'success' ? styles.success : styles.error}`}>
      {message}
    </div>
  );
}
