'use client';

/**
 * Sélecteur de couleur : une palette fermée (pastilles) et un bouton « + » qui ouvre le
 * sélecteur libre du navigateur. Décision JP du 2026-09-13.
 */
import { useRef } from 'react';
import {
  NODE_COLORS,
  NODE_COLOR_NAMES,
  STROKE_COLORS,
  STROKE_COLOR_NAMES,
  isHexColor,
  resolveFill,
  resolveStroke,
  type ColorRef,
} from '@/types/diagram';
import styles from './ColorPicker.module.css';

interface Props {
  value: ColorRef | undefined;
  palette: 'fill' | 'stroke';
  onChange: (ref: ColorRef) => void;
  /** Pastilles plus petites (barre flottante au-dessus d'une boîte). */
  compact?: boolean;
  label?: string;
}

export function ColorPicker({ value, palette, onChange, compact = false, label }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const colors = palette === 'fill' ? NODE_COLORS : STROKE_COLORS;
  const names: Record<string, string> = palette === 'fill' ? NODE_COLOR_NAMES : STROKE_COLOR_NAMES;
  const resolve = palette === 'fill' ? resolveFill : resolveStroke;
  const custom = isHexColor(value) ? value : undefined;

  return (
    <div className={styles.picker} data-compact={compact || undefined} role="group" aria-label={label}>
      {(Object.keys(colors) as string[]).map((key) => (
        <button
          key={key}
          type="button"
          className={styles.swatch}
          data-active={key === value || undefined}
          style={{ background: colors[key as keyof typeof colors] }}
          title={names[key]}
          aria-label={`${label ? `${label} : ` : ''}${names[key]}`}
          onClick={() => onChange(key)}
        />
      ))}
      <button
        type="button"
        className={`${styles.swatch} ${styles.custom}`}
        data-active={custom || undefined}
        style={custom ? { background: custom } : undefined}
        title="Autre couleur…"
        aria-label="Autre couleur"
        onClick={() => inputRef.current?.click()}
      >
        {custom ? '' : '+'}
      </button>
      <input
        ref={inputRef}
        type="color"
        className={styles.hidden}
        value={resolve(value)}
        onChange={(e) => onChange(e.target.value.toLowerCase())}
        tabIndex={-1}
        aria-hidden
      />
    </div>
  );
}
