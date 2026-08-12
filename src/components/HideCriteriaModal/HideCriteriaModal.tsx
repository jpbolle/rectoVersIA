'use client';

// Popup « Masquer certains critères ? » — proposée quand le prof choisit une
// grille dans le formulaire de création/édition d'activité. Les critères
// décochés sont enregistrés dans devoir.hiddenCriteria : ils ne seront ni
// affichés ni évalués pour CETTE activité (la grille elle-même ne change pas).
// D'une activité à l'autre, le prof peut ainsi faire progresser l'évaluation
// d'un même objet.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GrilleCriterion } from '@/types/grille';
import styles from './HideCriteriaModal.module.css';

interface HideCriteriaModalProps {
  grilleName: string;
  initialHidden: string[];
  getAuthHeaders?: () => Promise<Record<string, string> | null>;
  // Valide la sélection ([] = tout évaluer)
  onConfirm: (hidden: string[]) => void;
  // Ferme sans rien changer
  onClose: () => void;
}

export default function HideCriteriaModal({
  grilleName,
  initialHidden,
  getAuthHeaders,
  onConfirm,
  onClose,
}: HideCriteriaModalProps) {
  const [criteria, setCriteria] = useState<GrilleCriterion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set(initialHidden));

  useEffect(() => {
    (async () => {
      try {
        const headers = (await getAuthHeaders?.()) || undefined;
        const res = await fetch(`/api/grilles/${encodeURIComponent(grilleName)}`, { headers });
        const json = await res.json();
        if (json.success && json.data?.criteria) {
          const sorted = [...(json.data.criteria as GrilleCriterion[])].sort(
            (a, b) => a.order - b.order
          );
          setCriteria(sorted);
        } else {
          setError('Impossible de charger les critères de la grille.');
        }
      } catch {
        setError('Impossible de charger les critères de la grille.');
      }
    })();
  }, [grilleName, getAuthHeaders]);

  const toggle = (id: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const evaluatedCount = criteria ? criteria.length - hidden.size : 0;

  const modal = (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.box} onClick={(e) => e.stopPropagation()}>
        <div className={styles.head}>
          <h3 className={styles.title}>Masquer certains critères ?</h3>
          <button type="button" className={styles.closeBtn} onClick={onClose} title="Fermer">
            ✕
          </button>
        </div>
        <p className={styles.hint}>
          Grille « {grilleName} » — les critères décochés ne seront ni affichés
          ni évalués pour cette activité. La grille elle-même n&apos;est pas modifiée.
        </p>

        {error && <p className={styles.error}>{error}</p>}
        {!criteria && !error && <p className={styles.loading}>En cours de chargement...</p>}

        {criteria && (
          <div className={styles.list}>
            {criteria.map((c) => (
              <label key={c.id} className={`${styles.row} ${hidden.has(c.id) ? styles.rowHidden : ''}`}>
                <input
                  type="checkbox"
                  checked={!hidden.has(c.id)}
                  onChange={() => toggle(c.id)}
                />
                <span className={styles.rowName}>{c.name}</span>
                <span className={styles.rowWeight}>{c.weight} pts</span>
              </label>
            ))}
          </div>
        )}

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => onConfirm([])}
          >
            Tout évaluer
          </button>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => onConfirm([...hidden])}
            disabled={!criteria || evaluatedCount === 0}
            title={evaluatedCount === 0 ? 'Au moins un critère doit rester évalué' : undefined}
          >
            Valider ({evaluatedCount} critère{evaluatedCount > 1 ? 's' : ''} évalué{evaluatedCount > 1 ? 's' : ''})
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
}
