'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './WorkspaceRail.module.css';

export interface RailTab {
  id: string;
  label: string;
  icon: ReactNode;
  hasBadge?: boolean;
  highlight?: boolean;
}

interface WorkspaceRailProps {
  tabs: RailTab[];
  activeTab: string;
  onActiveTabChange: (tabId: string) => void;
  isOpen: boolean;
  onIsOpenChange: (open: boolean) => void;
  panelTitle?: string;
  panelHeaderExtra?: ReactNode;
  children: ReactNode;
  storageKey?: string;
  defaultWidthPercent?: number;
  minWidth?: number;
  maxWidthPercent?: number;
}

export default function WorkspaceRail({
  tabs,
  activeTab,
  onActiveTabChange,
  isOpen,
  onIsOpenChange,
  panelTitle,
  panelHeaderExtra,
  children,
  storageKey = 'workspaceRail-width',
  defaultWidthPercent = 25,
  minWidth = 280,
  maxWidthPercent = 66.66,
}: WorkspaceRailProps) {
  const panelRef = useRef<HTMLElement>(null);
  const isResizingRef = useRef(false);
  const resizeStartRef = useRef({ x: 0, w: 0 });

  // Largeur du panneau (en px). Initialisée a une valeur safe pour SSR,
  // recalculee depuis localStorage / viewport apres mount.
  const [width, setWidth] = useState<number>(400);

  function clamp(w: number): number {
    if (typeof window === 'undefined') return w;
    const max = Math.floor(window.innerWidth * (maxWidthPercent / 100));
    return Math.max(minWidth, Math.min(max, w));
  }

  // Initialisation post-mount : localStorage > 1/4 viewport
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = parseInt(localStorage.getItem(storageKey) ?? '', 10);
    let target: number;
    if (!isNaN(stored)) {
      target = stored;
    } else {
      target = Math.floor(window.innerWidth * (defaultWidthPercent / 100));
    }
    setWidth(clamp(target));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-clamp si la fenetre est redimensionnee (panneau ne doit jamais depasser 2/3)
  useEffect(() => {
    function onResize() {
      setWidth((w) => clamp(w));
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onResizerPointerDown(e: React.PointerEvent) {
    if (!panelRef.current) return;
    isResizingRef.current = true;
    resizeStartRef.current = { x: e.clientX, w: panelRef.current.offsetWidth };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    panelRef.current.classList.add(styles.resizing);
    e.preventDefault();
  }

  function onResizerPointerMove(e: React.PointerEvent) {
    if (!isResizingRef.current) return;
    // Le panneau est a gauche du rail : tirer vers la GAUCHE elargit
    const delta = resizeStartRef.current.x - e.clientX;
    setWidth(clamp(resizeStartRef.current.w + delta));
  }

  function onResizerPointerUp(e: React.PointerEvent) {
    if (!isResizingRef.current) return;
    isResizingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch { /* ignore */ }
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    panelRef.current?.classList.remove(styles.resizing);
    try {
      localStorage.setItem(storageKey, String(width));
    } catch { /* ignore quota / private mode */ }
  }

  function handleIconClick(tabId: string) {
    if (isOpen && tabId === activeTab) {
      onIsOpenChange(false);
      return;
    }
    if (!isOpen) onIsOpenChange(true);
    onActiveTabChange(tabId);
  }

  return (
    <div className={`${styles.wrapper} ${isOpen ? styles.wrapperOpen : ''}`}>
      <aside
        ref={panelRef}
        className={`${styles.panel} ${isOpen ? styles.panelOpen : ''}`}
        style={isOpen ? { width: `${width}px` } : undefined}
        aria-hidden={!isOpen}
      >
        <div
          className={styles.resizer}
          onPointerDown={onResizerPointerDown}
          onPointerMove={onResizerPointerMove}
          onPointerUp={onResizerPointerUp}
          aria-label="Redimensionner le panneau"
          role="separator"
        />
        <header className={styles.panelHeader}>
          <h3 className={styles.panelTitle}>{panelTitle ?? ''}</h3>
          <div className={styles.panelHeaderRight}>
            {panelHeaderExtra}
            <button
              type="button"
              className={styles.panelClose}
              onClick={() => onIsOpenChange(false)}
              aria-label="Fermer le panneau"
            >
              ×
            </button>
          </div>
        </header>
        <div className={styles.panelBody}>{children}</div>
      </aside>

      <nav className={styles.rail} aria-label="Outils d'assistance">
        {tabs.map((tab) => {
          const isActive = isOpen && activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`${styles.railBtn} ${isActive ? styles.railBtnActive : ''} ${tab.highlight ? styles.railBtnHighlight : ''}`}
              onClick={() => handleIconClick(tab.id)}
              aria-label={tab.label}
              aria-pressed={isActive}
            >
              <span className={styles.railIcon}>{tab.icon}</span>
              {tab.hasBadge && <span className={styles.railBadge} aria-hidden="true" />}
              <span className={styles.tooltip}>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
