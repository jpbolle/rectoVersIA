'use client';

import { useState } from 'react';
import type { NavigKidQuestion } from '@/types/navigkid';
import styles from './QuestionnaireBuilder.module.css';

interface QuestionnaireBuilderProps {
  questions: NavigKidQuestion[];
  onQuestionsChange: (questions: NavigKidQuestion[]) => void;
  themes: string[];
  onThemesChange: (themes: string[]) => void;
  titre: string;
  disabled?: boolean;
  getAuthHeaders?: () => Promise<Record<string, string> | null>;
}

export default function QuestionnaireBuilder({
  questions,
  onQuestionsChange,
  themes,
  onThemesChange,
  titre,
  disabled = false,
  getAuthHeaders,
}: QuestionnaireBuilderProps) {
  const [themeInput, setThemeInput] = useState('');
  const [generating, setGenerating] = useState(false);

  // ─── Thèmes ───

  function ajouterTheme() {
    const t = themeInput.trim();
    if (t && !themes.includes(t)) {
      onThemesChange([...themes, t]);
    }
    setThemeInput('');
  }

  function supprimerTheme(index: number) {
    onThemesChange(themes.filter((_, i) => i !== index));
  }

  // ─── Questions CRUD ───

  function ajouterQuestion(type: 'texte' | 'qcm') {
    const q: NavigKidQuestion =
      type === 'qcm'
        ? { texte: '', type: 'qcm', options: ['', ''], correctes: [], nbSources: 1 }
        : { texte: '', type: 'texte', nbSources: 1 };
    onQuestionsChange([...questions, q]);
  }

  function updateQuestion(index: number, field: Partial<NavigKidQuestion>) {
    const copy = [...questions];
    copy[index] = { ...copy[index], ...field };
    onQuestionsChange(copy);
  }

  function supprimerQuestion(index: number) {
    onQuestionsChange(questions.filter((_, i) => i !== index));
  }

  function deplacerQuestion(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= questions.length) return;
    const copy = [...questions];
    [copy[index], copy[target]] = [copy[target], copy[index]];
    onQuestionsChange(copy);
  }

  // ─── Options QCM ───

  function updateOption(qIndex: number, oIndex: number, value: string) {
    const copy = [...questions];
    const opts = [...(copy[qIndex].options || [])];
    opts[oIndex] = value;
    copy[qIndex] = { ...copy[qIndex], options: opts };
    onQuestionsChange(copy);
  }

  function ajouterOption(qIndex: number) {
    const copy = [...questions];
    copy[qIndex] = { ...copy[qIndex], options: [...(copy[qIndex].options || []), ''] };
    onQuestionsChange(copy);
  }

  function supprimerOption(qIndex: number, oIndex: number) {
    const copy = [...questions];
    const opts = (copy[qIndex].options || []).filter((_, i) => i !== oIndex);
    if (opts.length >= 2) {
      const correctes = (copy[qIndex].correctes || [])
        .filter((c) => c !== oIndex)
        .map((c) => (c > oIndex ? c - 1 : c));
      copy[qIndex] = { ...copy[qIndex], options: opts, correctes };
      onQuestionsChange(copy);
    }
  }

  function toggleCorrecte(qIndex: number, oIndex: number) {
    const copy = [...questions];
    const correctes = [...(copy[qIndex].correctes || [])];
    const idx = correctes.indexOf(oIndex);
    if (idx >= 0) {
      correctes.splice(idx, 1);
    } else {
      correctes.push(oIndex);
    }
    copy[qIndex] = { ...copy[qIndex], correctes };
    onQuestionsChange(copy);
  }

  // ─── Génération IA ───

  async function genererSuggestionsIA() {
    if (themes.length === 0) {
      alert('Ajoutez au moins un thème pour générer des suggestions.');
      return;
    }
    setGenerating(true);
    try {
      const authHeaders = getAuthHeaders ? await getAuthHeaders() : {};
      const res = await fetch('/api/navigkid/generer-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ themes, titre }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Erreur lors de la génération.');
        return;
      }
      onQuestionsChange([...questions, ...data.questions]);
    } catch {
      alert('Erreur réseau lors de la génération.');
    } finally {
      setGenerating(false);
    }
  }

  // ─── Rendu ───

  return (
    <div className={styles.builder}>
      <h3 className={styles.builderTitle}>Questionnaire de recherche</h3>

      {/* Thèmes */}
      <div className={styles.infoSection}>
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Thèmes</label>
          <div className={styles.themesRow}>
            <input
              type="text"
              value={themeInput}
              onChange={(e) => setThemeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  ajouterTheme();
                }
              }}
              placeholder="Ex : Sciences, Environnement... (Entrée pour ajouter)"
              className={styles.input}
              disabled={disabled}
            />
            <button
              type="button"
              onClick={ajouterTheme}
              className={styles.btnAddTheme}
              disabled={disabled}
            >
              +
            </button>
          </div>
          {themes.length > 0 && (
            <div className={styles.tagList}>
              {themes.map((t, i) => (
                <span key={i} className={styles.tag}>
                  {t}
                  <button
                    type="button"
                    onClick={() => supprimerTheme(i)}
                    className={styles.tagRemove}
                    disabled={disabled}
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Questions */}
      <div className={styles.questionsSection}>
        <h4 className={styles.questionsTitle}>Questions</h4>

        {questions.length === 0 ? (
          <p className={styles.emptyMessage}>
            Aucune question ajoutée. Chaque question demande à l&apos;élève de
            collecter des sources web puis de répondre.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className={styles.table}>
              <thead>
                <tr className={styles.tableHeader}>
                  <th style={{ width: 50 }}>#</th>
                  <th>Énoncé de la question</th>
                  <th style={{ width: 70 }}>Type</th>
                  <th style={{ width: 85 }}>Sources</th>
                  <th style={{ width: 55 }}>Points</th>
                  <th style={{ width: 30 }}></th>
                </tr>
              </thead>
              <tbody>
                {questions.map((q, i) => (
                  <tr key={i} className={styles.questionRow}>
                    {/* # + flèches */}
                    <td className={styles.cellCenter}>
                      <span className={styles.questionNumber}>{i + 1}</span>
                      <div className={styles.moveButtons}>
                        <button
                          type="button"
                          onClick={() => deplacerQuestion(i, -1)}
                          disabled={i === 0 || disabled}
                          className={styles.btnMove}
                          title="Monter"
                        >
                          &#9650;
                        </button>
                        <button
                          type="button"
                          onClick={() => deplacerQuestion(i, 1)}
                          disabled={i === questions.length - 1 || disabled}
                          className={styles.btnMove}
                          title="Descendre"
                        >
                          &#9660;
                        </button>
                      </div>
                    </td>

                    {/* Énoncé + options QCM + corrigé */}
                    <td className={styles.cellLeft}>
                      <textarea
                        value={q.texte}
                        onChange={(e) => updateQuestion(i, { texte: e.target.value })}
                        placeholder="Ex : Trouvez un article sur... puis expliquez..."
                        rows={3}
                        className={styles.questionTextarea}
                        disabled={disabled}
                      />

                      {/* Options QCM */}
                      {q.type === 'qcm' && q.options && (
                        <div className={styles.qcmOptions}>
                          <p className={styles.qcmHint}>
                            Cliquez sur une option pour la marquer comme bonne réponse
                          </p>
                          {q.options.map((opt, j) => {
                            const estCorrecte = (q.correctes || []).includes(j);
                            return (
                              <div
                                key={j}
                                className={`${styles.qcmOption} ${estCorrecte ? styles.qcmOptionCorrect : ''}`}
                                onClick={() => toggleCorrecte(i, j)}
                              >
                                <span
                                  className={`${styles.qcmLabel} ${estCorrecte ? styles.qcmLabelCorrect : styles.qcmLabelDefault}`}
                                >
                                  {estCorrecte ? '✓' : `${String.fromCharCode(65 + j)}.`}
                                </span>
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    updateOption(i, j, e.target.value);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  placeholder={`Option ${String.fromCharCode(65 + j)}`}
                                  className={`${styles.qcmInput} ${estCorrecte ? styles.qcmInputCorrect : ''}`}
                                  disabled={disabled}
                                />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    supprimerOption(i, j);
                                  }}
                                  className={styles.btnRemoveOption}
                                  disabled={disabled}
                                >
                                  &times;
                                </button>
                              </div>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => ajouterOption(i)}
                            className={styles.btnAddOption}
                            disabled={disabled}
                          >
                            + Option
                          </button>
                        </div>
                      )}

                      {/* Corrigé & références */}
                      <details className={styles.details}>
                        <summary className={styles.detailsSummary}>
                          Corrigé &amp; références
                        </summary>
                        <div className={styles.detailsContent}>
                          <div style={{ marginBottom: 8 }}>
                            <div className={styles.detailsLabel}>Réponse attendue :</div>
                            <textarea
                              value={q.reponseAttendue || ''}
                              onChange={(e) =>
                                updateQuestion(i, { reponseAttendue: e.target.value })
                              }
                              placeholder="Éléments de réponse attendus, points clés..."
                              rows={2}
                              className={styles.detailsTextarea}
                              disabled={disabled}
                            />
                          </div>
                          <div>
                            <div className={styles.detailsLabel}>Références :</div>
                            {(q.referencesProf || []).map((url, ri) => (
                              <div key={ri} className={styles.refRow}>
                                <span className={styles.refArrow}>→</span>
                                <input
                                  type="text"
                                  value={url}
                                  onChange={(e) => {
                                    const refs = [...(q.referencesProf || [])];
                                    refs[ri] = e.target.value;
                                    updateQuestion(i, { referencesProf: refs });
                                  }}
                                  placeholder="https://..."
                                  className={styles.refInput}
                                  disabled={disabled}
                                />
                                {url && (
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={styles.refLink}
                                  >
                                    ↗
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const refs = (q.referencesProf || []).filter(
                                      (_, k) => k !== ri
                                    );
                                    updateQuestion(i, { referencesProf: refs });
                                  }}
                                  className={styles.btnRemoveOption}
                                  disabled={disabled}
                                >
                                  &times;
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                const refs = [...(q.referencesProf || []), ''];
                                updateQuestion(i, { referencesProf: refs });
                              }}
                              className={styles.btnAddRef}
                              disabled={disabled}
                            >
                              + Ajouter une référence
                            </button>
                          </div>
                        </div>
                      </details>
                    </td>

                    {/* Type */}
                    <td className={styles.cellCenter}>
                      <select
                        value={q.type}
                        onChange={(e) => {
                          const newType = e.target.value as 'texte' | 'qcm';
                          const update: Partial<NavigKidQuestion> = { type: newType };
                          if (newType === 'qcm' && !q.options) {
                            update.options = ['', ''];
                            update.correctes = [];
                          }
                          updateQuestion(i, update);
                        }}
                        className={styles.selectSmall}
                        disabled={disabled}
                      >
                        <option value="texte">Texte</option>
                        <option value="qcm">QCM</option>
                      </select>
                    </td>

                    {/* Sources */}
                    <td className={styles.cellCenter}>
                      <select
                        value={q.nbSources}
                        onChange={(e) =>
                          updateQuestion(i, { nbSources: parseInt(e.target.value) })
                        }
                        className={styles.selectSmall}
                        disabled={disabled}
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            {n} source{n > 1 ? 's' : ''}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Points */}
                    <td className={styles.cellCenter}>
                      <input
                        type="number"
                        value={q.points || ''}
                        onChange={(e) =>
                          updateQuestion(i, {
                            points: e.target.value ? parseInt(e.target.value) : undefined,
                          })
                        }
                        placeholder="—"
                        min={0}
                        className={styles.inputSmall}
                        disabled={disabled}
                      />
                    </td>

                    {/* Supprimer */}
                    <td className={styles.cellCenter}>
                      <button
                        type="button"
                        onClick={() => supprimerQuestion(i)}
                        className={styles.btnDeleteQuestion}
                        disabled={disabled}
                      >
                        &times;
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer : total + boutons ajouter */}
        <div className={styles.footer}>
          {questions.length > 0 && (
            <div className={styles.footerInfo}>
              <div className={styles.footerHints}>
                <span>
                  <strong>Type</strong> : Texte = réponse ouverte, QCM = correction auto
                </span>
                <span>
                  <strong>Sources</strong> : pages web à collecter
                </span>
              </div>
              <div className={styles.totalPoints}>
                Total : {questions.reduce((sum, q) => sum + (q.points || 0), 0)} pts
              </div>
            </div>
          )}

          <div className={styles.addButtons}>
            <button
              type="button"
              onClick={() => ajouterQuestion('texte')}
              className={`${styles.btnAdd} ${styles.btnAddTexte}`}
              disabled={disabled}
            >
              + Texte libre
            </button>
            <button
              type="button"
              onClick={() => ajouterQuestion('qcm')}
              className={`${styles.btnAdd} ${styles.btnAddQcm}`}
              disabled={disabled}
            >
              + QCM
            </button>
            <button
              type="button"
              onClick={genererSuggestionsIA}
              disabled={generating || disabled || themes.length === 0}
              className={`${styles.btnAdd} ${styles.btnAddIA}`}
            >
              {generating ? 'Génération...' : 'Générer IA'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
