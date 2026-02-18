'use client';

import { useState, useEffect } from 'react';
import { FONTS, FONT_SIZES, PAGE_THEMES, LINE_HEIGHT_MIN, LINE_HEIGHT_MAX, LINE_HEIGHT_STEP } from '@/lib/editor-constants';
import type { EditorPreferences } from '@/types/preferences';
import styles from './PreferencesModal.module.css';

interface PreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: EditorPreferences;
  onSave: (prefs: EditorPreferences) => Promise<void>;
}

export default function PreferencesModal({
  isOpen,
  onClose,
  preferences,
  onSave,
}: PreferencesModalProps) {
  const [font, setFont] = useState(preferences.font);
  const [fontSize, setFontSize] = useState(preferences.fontSize);
  const [lineHeight, setLineHeight] = useState(preferences.lineHeight);
  const [theme, setTheme] = useState(preferences.theme);
  const [isSaving, setIsSaving] = useState(false);

  // Sync quand les props changent (ex: modal reouvert)
  useEffect(() => {
    if (isOpen) {
      setFont(preferences.font);
      setFontSize(preferences.fontSize);
      setLineHeight(preferences.lineHeight);
      setTheme(preferences.theme);
    }
  }, [isOpen, preferences]);

  const handleLineHeightChange = (delta: number) => {
    const newValue = Math.round((lineHeight + delta) * 100) / 100;
    setLineHeight(Math.min(LINE_HEIGHT_MAX, Math.max(LINE_HEIGHT_MIN, newValue)));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({ font, fontSize, lineHeight, theme });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const currentTheme = PAGE_THEMES.find(t => t.id === theme) || PAGE_THEMES[0];

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Mes préférences</h2>
          <button className={styles.closeButton} onClick={onClose}>
            &times;
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.columns}>
            {/* Gauche : controles */}
            <div className={styles.controls}>
              {/* Police */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Police</label>
                <select
                  className={styles.select}
                  value={font}
                  onChange={(e) => setFont(e.target.value)}
                >
                  {FONTS.map((f) => (
                    <option key={f.value} value={f.value}>{f.name}</option>
                  ))}
                </select>
              </div>

              {/* Taille */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Taille de police</label>
                <select
                  className={styles.select}
                  value={fontSize}
                  onChange={(e) => setFontSize(e.target.value)}
                >
                  {FONT_SIZES.map((s) => (
                    <option key={s.value} value={s.value}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Interligne */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Interligne</label>
                <div className={styles.lineHeightControl}>
                  <button
                    type="button"
                    className={styles.stepButton}
                    onClick={() => handleLineHeightChange(-LINE_HEIGHT_STEP)}
                    disabled={lineHeight <= LINE_HEIGHT_MIN}
                  >
                    -
                  </button>
                  <input
                    type="range"
                    className={styles.slider}
                    min={LINE_HEIGHT_MIN}
                    max={LINE_HEIGHT_MAX}
                    step={LINE_HEIGHT_STEP}
                    value={lineHeight}
                    onChange={(e) => setLineHeight(parseFloat(e.target.value))}
                  />
                  <button
                    type="button"
                    className={styles.stepButton}
                    onClick={() => handleLineHeightChange(LINE_HEIGHT_STEP)}
                    disabled={lineHeight >= LINE_HEIGHT_MAX}
                  >
                    +
                  </button>
                  <span className={styles.lineHeightValue}>{lineHeight.toFixed(2)}</span>
                </div>
              </div>

              {/* Theme */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Theme de page</label>
                <div className={styles.themeGrid}>
                  {PAGE_THEMES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`${styles.themeOption} ${theme === t.id ? styles.themeOptionActive : ''}`}
                      onClick={() => setTheme(t.id)}
                    >
                      <span
                        className={styles.themeSwatch}
                        style={{ background: t.bg }}
                      >
                        <span style={{ color: t.text }}>A</span>
                      </span>
                      <span className={styles.themeLabel}>{t.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Droite : apercu */}
            <div className={styles.previewWrapper}>
              <div className={styles.previewLabel}>Apercu</div>
              <div
                className={styles.preview}
                style={{
                  background: currentTheme.bg,
                  color: currentTheme.text,
                  fontFamily: font || 'inherit',
                  fontSize: fontSize ? `${fontSize}px` : '15px',
                  lineHeight: lineHeight,
                }}
              >
                <p>
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                  Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                </p>
                <p>
                  Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris
                  nisi ut aliquip ex ea commodo consequat.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button
            className={styles.cancelButton}
            onClick={onClose}
            disabled={isSaving}
          >
            Annuler
          </button>
          <button
            className={styles.saveButton}
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
