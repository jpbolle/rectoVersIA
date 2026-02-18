'use client';

import { useState, useCallback } from 'react';
import type { Grille, GrilleCriterion, GrilleLevel } from '@/types/grille';
import { LEVEL_LABELS, LEVEL_PERCENTAGES, UAA_LIST } from '@/types/grille';
import styles from './GrilleBuilder.module.css';

interface GrilleBuilderProps {
  grille?: Grille | null;           // null = creation, Grille = edition
  onSave: (data: { name: string; description: string; uaa: number[]; criteria: GrilleCriterion[] }) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

function createEmptyLevel(level: number): GrilleLevel {
  return { level, indicators: [] };
}

function createEmptyCriterion(order: number): GrilleCriterion {
  const id = `crit-new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    name: '',
    weight: 10,
    order,
    levels: [0, 1, 2, 3, 4, 5].map(createEmptyLevel),
  };
}

export default function GrilleBuilder({ grille, onSave, onCancel, isSaving }: GrilleBuilderProps) {
  const [name, setName] = useState(grille?.name || '');
  const [description, setDescription] = useState(grille?.description || '');
  const [selectedUaa, setSelectedUaa] = useState<number[]>(grille?.uaa || []);
  const [criteria, setCriteria] = useState<GrilleCriterion[]>(() => {
    if (grille && grille.criteria.length > 0) {
      // S'assurer que chaque critere a 6 niveaux
      return grille.criteria
        .sort((a, b) => a.order - b.order)
        .map((c) => ({
          ...c,
          levels: [0, 1, 2, 3, 4, 5].map((lvl) => {
            const existing = c.levels.find((l) => l.level === lvl);
            return existing || createEmptyLevel(lvl);
          }),
        }));
    }
    return [createEmptyCriterion(0)];
  });

  // Critere actuellement expande (pour voir les niveaux)
  const [expandedCriterionId, setExpandedCriterionId] = useState<string | null>(
    criteria.length > 0 ? criteria[0].id : null
  );

  // Indicateur en cours d'edition
  const [editingIndicator, setEditingIndicator] = useState<{
    criterionId: string;
    levelIndex: number;
    indicatorIndex: number;
  } | null>(null);

  // Nouvel indicateur en cours d'ajout
  const [addingIndicator, setAddingIndicator] = useState<{
    criterionId: string;
    levelIndex: number;
  } | null>(null);
  const [newIndicatorText, setNewIndicatorText] = useState('');

  const toggleUaa = useCallback((uaaId: number) => {
    setSelectedUaa((prev) =>
      prev.includes(uaaId) ? prev.filter((id) => id !== uaaId) : [...prev, uaaId].sort((a, b) => a - b)
    );
  }, []);

  const handleSave = useCallback(() => {
    if (!name.trim()) return;
    if (criteria.length === 0) return;
    // Verifier qu'au moins un critere a un nom
    if (!criteria.some((c) => c.name.trim())) return;

    onSave({
      name: name.trim(),
      description: description.trim(),
      uaa: selectedUaa,
      criteria: criteria.map((c, i) => ({
        ...c,
        order: i,
        // Ne garder que les niveaux avec des indicateurs
        levels: c.levels.map((l) => ({
          ...l,
          indicators: l.indicators.filter((ind) => ind.trim()),
        })),
      })),
    });
  }, [name, description, selectedUaa, criteria, onSave]);

  // --- CRITERES ---

  const addCriterion = useCallback(() => {
    const newCriterion = createEmptyCriterion(criteria.length);
    setCriteria((prev) => [...prev, newCriterion]);
    setExpandedCriterionId(newCriterion.id);
  }, [criteria.length]);

  const removeCriterion = useCallback((id: string) => {
    setCriteria((prev) => {
      const next = prev.filter((c) => c.id !== id);
      return next.map((c, i) => ({ ...c, order: i }));
    });
    setExpandedCriterionId((prev) => (prev === id ? null : prev));
  }, []);

  const updateCriterionName = useCallback((id: string, newName: string) => {
    setCriteria((prev) =>
      prev.map((c) => (c.id === id ? { ...c, name: newName } : c))
    );
  }, []);

  // État temporaire pour permettre un champ vide pendant l'édition
  const [editingWeights, setEditingWeights] = useState<Record<string, string>>({});

  const updateCriterionWeight = useCallback((id: string, weight: number) => {
    setCriteria((prev) =>
      prev.map((c) => (c.id === id ? { ...c, weight: Math.max(1, weight) } : c))
    );
  }, []);

  const moveCriterion = useCallback((id: string, direction: 'up' | 'down') => {
    setCriteria((prev) => {
      const index = prev.findIndex((c) => c.id === id);
      if (index === -1) return prev;
      if (direction === 'up' && index === 0) return prev;
      if (direction === 'down' && index === prev.length - 1) return prev;

      const next = [...prev];
      const swapIndex = direction === 'up' ? index - 1 : index + 1;
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
      return next.map((c, i) => ({ ...c, order: i }));
    });
  }, []);

  // --- INDICATEURS ---

  const addIndicator = useCallback((criterionId: string, levelIndex: number, text: string) => {
    if (!text.trim()) return;
    setCriteria((prev) =>
      prev.map((c) => {
        if (c.id !== criterionId) return c;
        return {
          ...c,
          levels: c.levels.map((l) => {
            if (l.level !== levelIndex) return l;
            return { ...l, indicators: [...l.indicators, text.trim()] };
          }),
        };
      })
    );
  }, []);

  const updateIndicator = useCallback(
    (criterionId: string, levelIndex: number, indicatorIndex: number, text: string) => {
      setCriteria((prev) =>
        prev.map((c) => {
          if (c.id !== criterionId) return c;
          return {
            ...c,
            levels: c.levels.map((l) => {
              if (l.level !== levelIndex) return l;
              const newIndicators = [...l.indicators];
              newIndicators[indicatorIndex] = text;
              return { ...l, indicators: newIndicators };
            }),
          };
        })
      );
    },
    []
  );

  const removeIndicator = useCallback(
    (criterionId: string, levelIndex: number, indicatorIndex: number) => {
      setCriteria((prev) =>
        prev.map((c) => {
          if (c.id !== criterionId) return c;
          return {
            ...c,
            levels: c.levels.map((l) => {
              if (l.level !== levelIndex) return l;
              return {
                ...l,
                indicators: l.indicators.filter((_, i) => i !== indicatorIndex),
              };
            }),
          };
        })
      );
    },
    []
  );

  const handleStartAdd = (criterionId: string, levelIndex: number) => {
    setAddingIndicator({ criterionId, levelIndex });
    setNewIndicatorText('');
  };

  const handleConfirmAdd = () => {
    if (addingIndicator && newIndicatorText.trim()) {
      addIndicator(addingIndicator.criterionId, addingIndicator.levelIndex, newIndicatorText);
    }
    setAddingIndicator(null);
    setNewIndicatorText('');
  };

  const handleCancelAdd = () => {
    setAddingIndicator(null);
    setNewIndicatorText('');
  };

  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
  const isEditing = !!grille;

  return (
    <div className={styles.builder}>
      <div className={styles.builderHeader}>
        <h3 className={styles.builderTitle}>
          {isEditing ? 'Modifier la grille' : 'Nouvelle grille d\'évaluation'}
        </h3>
      </div>

      {/* Nom et description */}
      <div className={styles.metaFields}>
        <div className={styles.field}>
          <label className={styles.label}>Nom de la grille *</label>
          <input
            type="text"
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Expression écrite 4e"
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Description (optionnelle)</label>
          <input
            type="text"
            className={styles.input}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Grille pour les rédactions argumentatives"
          />
        </div>

        {/* Sélection UAA */}
        <div className={styles.field}>
          <label className={styles.label}>UAA ciblées</label>
          <div className={styles.uaaGrid}>
            {UAA_LIST.map((uaa) => (
              <button
                key={uaa.id}
                type="button"
                className={`${styles.uaaChip} ${selectedUaa.includes(uaa.id) ? styles.uaaChipActive : ''}`}
                onClick={() => toggleUaa(uaa.id)}
                title={uaa.label}
              >
                <span className={styles.uaaChipId}>UAA {uaa.id}</span>
              </button>
            ))}
          </div>
          {selectedUaa.length > 0 && (
            <div className={styles.uaaDetails}>
              {selectedUaa.map((id) => {
                const uaa = UAA_LIST.find((u) => u.id === id);
                return uaa ? (
                  <span key={id} className={styles.uaaDetailItem}>
                    UAA {id} — {uaa.label}
                  </span>
                ) : null;
              })}
            </div>
          )}
        </div>
      </div>

      {/* Total ponderation */}
      <div className={styles.totalBar}>
        <span className={styles.totalLabel}>Total pondération</span>
        <span className={styles.totalValue}>{totalWeight} pts</span>
      </div>

      {/* Liste des criteres */}
      <div className={styles.criteriaList}>
        {criteria.map((criterion, criterionIndex) => {
          const isExpanded = expandedCriterionId === criterion.id;

          return (
            <div key={criterion.id} className={`${styles.criterionBlock} ${isExpanded ? styles.criterionExpanded : ''}`}>
              {/* En-tete du critere */}
              <div className={styles.criterionHeader}>
                <button
                  className={styles.expandBtn}
                  onClick={() => setExpandedCriterionId(isExpanded ? null : criterion.id)}
                  title={isExpanded ? 'Réduire' : 'Développer'}
                >
                  <span className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ''}`}>›</span>
                </button>

                <span className={styles.criterionNumber}>C{criterionIndex + 1}</span>

                <input
                  type="text"
                  className={styles.criterionNameInput}
                  value={criterion.name}
                  onChange={(e) => updateCriterionName(criterion.id, e.target.value)}
                  placeholder="Nom du critère"
                  onClick={(e) => e.stopPropagation()}
                />

                {/* Cercle ponderation */}
                <div className={styles.weightCircle} title="Pondération (pts max)">
                  <input
                    type="number"
                    className={styles.weightInput}
                    value={editingWeights[criterion.id] ?? criterion.weight}
                    onChange={(e) => {
                      setEditingWeights((prev) => ({ ...prev, [criterion.id]: e.target.value }));
                    }}
                    onBlur={(e) => {
                      const val = parseInt(e.target.value);
                      updateCriterionWeight(criterion.id, isNaN(val) || val < 1 ? 1 : val);
                      setEditingWeights((prev) => {
                        const next = { ...prev };
                        delete next[criterion.id];
                        return next;
                      });
                    }}
                    onFocus={(e) => e.target.select()}
                    min={1}
                    max={100}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                <div className={styles.criterionActions}>
                  <button
                    className={styles.moveBtn}
                    onClick={() => moveCriterion(criterion.id, 'up')}
                    disabled={criterionIndex === 0}
                    title="Monter"
                  >
                    ↑
                  </button>
                  <button
                    className={styles.moveBtn}
                    onClick={() => moveCriterion(criterion.id, 'down')}
                    disabled={criterionIndex === criteria.length - 1}
                    title="Descendre"
                  >
                    ↓
                  </button>
                  <button
                    className={styles.removeCriterionBtn}
                    onClick={() => removeCriterion(criterion.id)}
                    title="Supprimer ce critère"
                    disabled={criteria.length <= 1}
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {/* Grille des niveaux (expandable) */}
              {isExpanded && (
                <div className={styles.levelsGrid}>
                  {criterion.levels.map((level) => (
                    <div key={level.level} className={styles.levelColumn}>
                      {/* En-tete du niveau */}
                      <div className={`${styles.levelHeader} ${styles[`levelHeader${level.level}`]}`}>
                        <span className={styles.levelLabel}>{LEVEL_LABELS[level.level]}</span>
                        <span className={styles.levelPct}>{LEVEL_PERCENTAGES[level.level]}%</span>
                      </div>

                      {/* Indicateurs */}
                      <div className={styles.indicatorsList}>
                        {level.indicators.map((indicator, indIdx) => {
                          const isEditingThis =
                            editingIndicator?.criterionId === criterion.id &&
                            editingIndicator?.levelIndex === level.level &&
                            editingIndicator?.indicatorIndex === indIdx;

                          return (
                            <div key={indIdx} className={styles.indicatorCard}>
                              {isEditingThis ? (
                                <textarea
                                  className={styles.indicatorTextarea}
                                  value={indicator}
                                  onChange={(e) =>
                                    updateIndicator(criterion.id, level.level, indIdx, e.target.value)
                                  }
                                  onBlur={() => setEditingIndicator(null)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      setEditingIndicator(null);
                                    }
                                  }}
                                  autoFocus
                                  rows={2}
                                />
                              ) : (
                                <span className={styles.indicatorText}>{indicator}</span>
                              )}
                              <div className={styles.indicatorActions}>
                                <button
                                  className={styles.indicatorEditBtn}
                                  onClick={() =>
                                    setEditingIndicator({
                                      criterionId: criterion.id,
                                      levelIndex: level.level,
                                      indicatorIndex: indIdx,
                                    })
                                  }
                                  title="Modifier"
                                >
                                  ✏️
                                </button>
                                <button
                                  className={styles.indicatorDeleteBtn}
                                  onClick={() => removeIndicator(criterion.id, level.level, indIdx)}
                                  title="Supprimer"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        {/* Zone ajout indicateur */}
                        {addingIndicator?.criterionId === criterion.id &&
                        addingIndicator?.levelIndex === level.level ? (
                          <div className={styles.addIndicatorForm}>
                            <textarea
                              className={styles.indicatorTextarea}
                              value={newIndicatorText}
                              onChange={(e) => setNewIndicatorText(e.target.value)}
                              placeholder="Nouvel indicateur..."
                              autoFocus
                              rows={2}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  handleConfirmAdd();
                                }
                                if (e.key === 'Escape') {
                                  handleCancelAdd();
                                }
                              }}
                            />
                            <div className={styles.addIndicatorActions}>
                              <button
                                className={styles.confirmAddBtn}
                                onClick={handleConfirmAdd}
                              >
                                ✓
                              </button>
                              <button
                                className={styles.cancelAddBtn}
                                onClick={handleCancelAdd}
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            className={styles.addIndicatorBtn}
                            onClick={() => handleStartAdd(criterion.id, level.level)}
                          >
                            + Indicateur
                          </button>
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

      {/* Bouton ajouter critere */}
      <button className={styles.addCriterionBtn} onClick={addCriterion}>
        + Ajouter un critère
      </button>

      {/* Actions */}
      <div className={styles.builderActions}>
        <button className={styles.cancelBtn} onClick={onCancel} disabled={isSaving}>
          Annuler
        </button>
        <button
          className={styles.saveBtn}
          onClick={handleSave}
          disabled={isSaving || !name.trim() || criteria.length === 0}
        >
          {isSaving ? 'Enregistrement...' : isEditing ? 'Enregistrer les modifications' : 'Créer la grille'}
        </button>
      </div>
    </div>
  );
}
