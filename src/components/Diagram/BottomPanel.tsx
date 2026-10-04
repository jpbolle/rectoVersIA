'use client';

/**
 * Le volet du bas : une boîte à outils à onglets (Outils · Markdown · À placer) et, à
 * droite, ce qui concerne l'affichage et la sortie (fond quadrillé, PNG, PDF).
 * Repliable ; l'onglet « À placer » n'apparaît que s'il y a des tags.
 */
import type { ReactNode } from 'react';
import buttons from '@/components/Diagram/ui/buttons.module.css';
import styles from './BottomPanel.module.css';

export type BottomTab = 'style' | 'markdown' | 'pending';

interface Props {
  open: boolean;
  onToggle: () => void;
  tab: BottomTab;
  onTab: (tab: BottomTab) => void;
  pendingCount: number;
  message: string;
  grid: boolean;
  onGrid: (v: boolean) => void;
  onPng: () => void;
  onPdf: () => void;
  exporting: boolean;
  children: ReactNode;
}

export function BottomPanel({ open, onToggle, tab, onTab, pendingCount, message, grid, onGrid, onPng, onPdf, exporting, children }: Props) {
  const tabs: { id: BottomTab; label: string; hidden?: boolean }[] = [
    { id: 'style', label: 'Outils' },
    { id: 'markdown', label: 'Markdown' },
    { id: 'pending', label: `À placer (${pendingCount})`, hidden: pendingCount === 0 },
  ];
  return (
    <div className={styles.panel} data-open={open || undefined}>
      <div className={styles.bar}>
        <button type="button" className={styles.toggle} onClick={onToggle} aria-expanded={open} title={open ? 'Replier' : 'Déplier'}>
          {open ? '▾' : '▴'}
        </button>
        <div className={styles.tabs} role="tablist">
          {tabs
            .filter((t) => !t.hidden)
            .map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={open && tab === t.id}
                className={styles.tab}
                data-active={(open && tab === t.id) || undefined}
                data-attention={(t.id === 'pending' && pendingCount > 0) || undefined}
                onClick={() => {
                  onTab(t.id);
                  if (!open) onToggle();
                }}
              >
                {t.label}
              </button>
            ))}
        </div>
        <span className={styles.message} title={message}>
          {message}
        </span>
        <div className={styles.rail}>
          <label className={styles.check}>
            <input type="checkbox" checked={grid} onChange={(e) => onGrid(e.target.checked)} />
            Quadrillage
          </label>
          <button type="button" className={`${buttons.button} ${buttons.small}`} onClick={onPng} disabled={exporting} title="Télécharger une image PNG">
            PNG
          </button>
          <button type="button" className={`${buttons.button} ${buttons.small}`} onClick={onPdf} disabled={exporting} title="Imprimer ou enregistrer en PDF">
            PDF
          </button>
        </div>
      </div>
      {open && <div className={styles.body}>{children}</div>}
    </div>
  );
}
