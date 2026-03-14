'use client';

import { useState, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import styles from './JoinClasseModal.module.css';

interface JoinClasseModalProps {
  onClose: () => void;
  onJoin: (code: string, nom: string, prenom: string) => Promise<{ message: string }>;
  remainingAttempts?: number;
}

export default function JoinClasseModal({ onClose, onJoin, remainingAttempts }: JoinClasseModalProps) {
  const { user } = useAuth();
  const [chars, setChars] = useState<string[]>(Array(9).fill(''));
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Pré-remplir nom/prénom depuis le profil Google
  useState(() => {
    if (user?.displayName) {
      const parts = user.displayName.trim().split(/\s+/);
      if (parts.length >= 2) {
        setPrenom(parts[0]);
        setNom(parts.slice(1).join(' '));
      } else if (parts.length === 1) {
        setPrenom(parts[0]);
      }
    }
  });

  const handleCharChange = useCallback((index: number, value: string) => {
    const char = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(-1);
    setChars((prev) => {
      const next = [...prev];
      next[index] = char;
      return next;
    });
    setError('');

    // Auto-focus au suivant
    if (char && index < 8) {
      inputRefs.current[index + 1]?.focus();
    }
  }, []);

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !chars[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, [chars]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (text.length >= 9) {
      const newChars = text.slice(0, 9).split('');
      setChars(newChars);
      inputRefs.current[8]?.focus();
    }
  }, []);

  const getCode = () => {
    const raw = chars.join('');
    if (raw.length !== 9) return '';
    return `${raw.slice(0, 3)}-${raw.slice(3, 6)}-${raw.slice(6, 9)}`;
  };

  const handleSubmit = async () => {
    const code = getCode();
    if (!code) {
      setError('Complète les 9 cases du code');
      return;
    }
    if (!nom.trim() || !prenom.trim()) {
      setError('Nom et prénom requis');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await onJoin(code, nom.trim(), prenom.trim());
      setSuccess(result.message);
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Rejoindre une classe</h2>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div className={styles.body}>
          <label className={styles.codeLabel}>Code de la classe</label>

          <div className={styles.codeGrid} onPaste={handlePaste}>
            {chars.map((char, i) => (
              <span key={i} style={{ display: 'contents' }}>
                {i === 3 && <span className={styles.codeDash}>–</span>}
                {i === 6 && <span className={styles.codeDash}>–</span>}
                <input
                  ref={(el) => { inputRefs.current[i] = el; }}
                  className={styles.codeInput}
                  type="text"
                  maxLength={1}
                  value={char}
                  onChange={(e) => handleCharChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  autoFocus={i === 0}
                />
              </span>
            ))}
          </div>

          <div className={styles.nameRow}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Prénom</label>
              <input
                className={styles.nameInput}
                type="text"
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
                placeholder="Ton prénom"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Nom</label>
              <input
                className={styles.nameInput}
                type="text"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Ton nom"
              />
            </div>
          </div>

          {error && <p className={styles.error}>{error}</p>}
          {success && <p className={styles.success}>{success}</p>}
          {remainingAttempts !== undefined && remainingAttempts <= 2 && !success && (
            <p className={styles.warning}>
              {remainingAttempts} tentative{remainingAttempts > 1 ? 's' : ''} restante{remainingAttempts > 1 ? 's' : ''}
            </p>
          )}

          <div className={styles.actions}>
            <button className={styles.cancelBtn} onClick={onClose} disabled={loading}>
              Annuler
            </button>
            <button className={styles.submitBtn} onClick={handleSubmit} disabled={loading || !!success}>
              {loading ? 'Envoi...' : 'Valider'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
