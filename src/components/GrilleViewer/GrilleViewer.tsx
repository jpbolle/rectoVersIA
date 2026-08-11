'use client';

import { useState } from 'react';
import { useDidactique } from '@/hooks/useDidactique';
import type { Grille } from '@/types/grille';
import { LEVEL_LABELS, LEVEL_PERCENTAGES, UAA_LIST } from '@/types/grille';
import styles from './GrilleViewer.module.css';

interface GrilleViewerProps {
  grille: Grille;
  onClose: () => void;
}

export default function GrilleViewer({ grille, onClose }: GrilleViewerProps) {
  const [expandedCriterionId, setExpandedCriterionId] = useState<string | null>(
    grille.criteria.length > 0 ? grille.criteria[0].id : null
  );
  const { config: didactique } = useDidactique();

  const totalWeight = grille.criteria.reduce((sum, c) => sum + c.weight, 0);
  const sortedCriteria = [...grille.criteria].sort((a, b) => a.order - b.order);

  return (
    <div className={styles.viewer}>
      <div className={styles.viewerHeader}>
        <div>
          <h3 className={styles.viewerTitle}>{grille.name}</h3>
          {grille.profName && (
            <p className={styles.viewerProf}>par {grille.profName}</p>
          )}
        </div>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      {grille.description && (
        <p className={styles.description}>{grille.description}</p>
      )}

      {grille.uaa && grille.uaa.length > 0 && (
        <div className={styles.uaaTags}>
          {grille.uaa.map((id) => {
            // Libellé : config didactique, repli sur la liste historique
            const label =
              didactique.uaa.find((u) => Number(u.id) === id)?.label ??
              UAA_LIST.find((u) => u.id === id)?.label ??
              '';
            return (
              <span key={id} className={styles.uaaTag}>
                UAA {id}{label ? ` — ${label}` : ''}
              </span>
            );
          })}
        </div>
      )}

      <div className={styles.totalBar}>
        <span>{sortedCriteria.length} critère{sortedCriteria.length > 1 ? 's' : ''}</span>
        <span>{totalWeight} pts</span>
      </div>

      <div className={styles.criteriaList}>
        {sortedCriteria.map((criterion, idx) => {
          const isExpanded = expandedCriterionId === criterion.id;
          const levels = [0, 1, 2, 3, 4, 5].map((lvl) => {
            const existing = criterion.levels.find((l) => l.level === lvl);
            return existing || { level: lvl, indicators: [] };
          });

          return (
            <div key={criterion.id} className={`${styles.criterionBlock} ${isExpanded ? styles.criterionExpanded : ''}`}>
              <button
                className={styles.criterionHeader}
                onClick={() => setExpandedCriterionId(isExpanded ? null : criterion.id)}
              >
                <span className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ''}`}>›</span>
                <span className={styles.criterionNumber}>C{idx + 1}</span>
                <span className={styles.criterionName}>{criterion.name || 'Sans nom'}</span>
                <span className={styles.criterionWeight}>{criterion.weight} pts</span>
              </button>

              {isExpanded && (
                <div className={styles.levelsGrid}>
                  {levels.map((level) => (
                    <div key={level.level} className={styles.levelColumn}>
                      <div className={`${styles.levelHeader} ${styles[`levelHeader${level.level}`]}`}>
                        <span className={styles.levelLabel}>{LEVEL_LABELS[level.level]}</span>
                        <span className={styles.levelPct}>{LEVEL_PERCENTAGES[level.level]}%</span>
                      </div>
                      <div className={styles.indicatorsList}>
                        {level.indicators.filter((i) => i.trim()).length === 0 ? (
                          <span className={styles.noIndicator}>—</span>
                        ) : (
                          level.indicators.filter((i) => i.trim()).map((indicator, i) => (
                            <div key={i} className={styles.indicatorCard}>
                              {indicator}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.viewerActions}>
        <button className={styles.closeAction} onClick={onClose}>Fermer</button>
      </div>
    </div>
  );
}
