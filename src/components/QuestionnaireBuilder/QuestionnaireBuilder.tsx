'use client';

// Constructeur du questionnaire de recherche (verso de la création/édition
// d'une activité de type « rechercher »).
//
// Même forme que le constructeur de lecture — blocs repliables réordonnables en
// glisser-déposer, énoncé redimensionnable, habiletés et barème dans l'entête —
// avec ce qui n'appartient qu'à la recherche : le nombre de sources à collecter
// et le barème de la DÉMARCHE (mots-clés + sites), noté séparément de la
// réponse (voir src/lib/recherche-scoring.ts).
//
// « Chercher, c'est lire » : les habiletés proposées sont celles de la lecture.

import { useState } from 'react';
import { useDidactique } from '@/hooks/useDidactique';
import { habileteLabel, habiletesOfType } from '@/types/didactique';
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
  // Habiletés retenues pour l'activité : les questions ne piochent que là-dedans.
  // null = pas de restriction.
  allowedHabiletes?: string[] | null;
}

function excerpt(texte: string): string {
  const t = texte.trim();
  return t.length > 70 ? `${t.slice(0, 70)}…` : t;
}

export default function QuestionnaireBuilder({
  questions,
  onQuestionsChange,
  themes,
  onThemesChange,
  titre,
  disabled = false,
  getAuthHeaders,
  allowedHabiletes = null,
}: QuestionnaireBuilderProps) {
  const [themeInput, setThemeInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [openIndexes, setOpenIndexes] = useState<Set<number>>(new Set([0]));
  const [habiletesOpenIndex, setHabiletesOpenIndex] = useState<number | null>(null);

  const { config: didactique } = useDidactique();

  const toggleOpen = (index: number) => {
    setOpenIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  // ─── Thèmes ───

  function ajouterTheme() {
    const t = themeInput.trim();
    if (t && !themes.includes(t)) onThemesChange([...themes, t]);
    setThemeInput('');
  }

  function supprimerTheme(index: number) {
    onThemesChange(themes.filter((_, i) => i !== index));
  }

  // ─── Questions ───

  function ajouterQuestion(type: 'texte' | 'qcm') {
    const q: NavigKidQuestion =
      type === 'qcm'
        ? { texte: '', type: 'qcm', options: ['', ''], correctes: [], nbSources: 1, points: 1, competences: [] }
        : { texte: '', type: 'texte', nbSources: 1, points: 1, competences: [] };
    onQuestionsChange([...questions, q]);
    // La nouvelle question se déplie, les autres se replient
    setOpenIndexes(new Set([questions.length]));
  }

  function updateQuestion(index: number, field: Partial<NavigKidQuestion>) {
    const copy = [...questions];
    copy[index] = { ...copy[index], ...field };
    onQuestionsChange(copy);
  }

  function supprimerQuestion(index: number) {
    onQuestionsChange(questions.filter((_, i) => i !== index));
  }

  // Duplication : la copie se place juste après l'originale et s'ouvre
  function dupliquerQuestion(index: number) {
    const copie: NavigKidQuestion = JSON.parse(JSON.stringify(questions[index]));
    const next = [...questions];
    next.splice(index + 1, 0, copie);
    onQuestionsChange(next);
    setOpenIndexes(new Set([index + 1]));
  }

  function deplacerQuestion(from: number, to: number) {
    if (from === to) return;
    const next = [...questions];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onQuestionsChange(next);
  }

  // ─── Options QCM ───

  function updateOption(qIndex: number, oIndex: number, value: string) {
    const opts = [...(questions[qIndex].options || [])];
    opts[oIndex] = value;
    updateQuestion(qIndex, { options: opts });
  }

  function ajouterOption(qIndex: number) {
    updateQuestion(qIndex, { options: [...(questions[qIndex].options || []), ''] });
  }

  function supprimerOption(qIndex: number, oIndex: number) {
    const opts = (questions[qIndex].options || []).filter((_, i) => i !== oIndex);
    if (opts.length < 2) return;
    const correctes = (questions[qIndex].correctes || [])
      .filter((c) => c !== oIndex)
      .map((c) => (c > oIndex ? c - 1 : c));
    updateQuestion(qIndex, { options: opts, correctes });
  }

  function toggleCorrecte(qIndex: number, oIndex: number) {
    const correctes = [...(questions[qIndex].correctes || [])];
    const idx = correctes.indexOf(oIndex);
    if (idx >= 0) correctes.splice(idx, 1);
    else correctes.push(oIndex);
    updateQuestion(qIndex, { correctes });
  }

  // ─── Habiletés (chercher, c'est lire) ───

  function habileteOptions(q: NavigKidQuestion) {
    const cochees = q.competences ?? [];
    const restriction = allowedHabiletes ? new Set(allowedHabiletes) : null;
    const lecture = habiletesOfType(didactique, 'lire').filter(
      (h) => !restriction || restriction.has(h.id) || cochees.includes(h.id)
    );
    const connues = new Set(lecture.map((h) => h.id));
    return [
      ...lecture
        .filter((h) => h.visible || cochees.includes(h.id))
        .map((h) => ({ id: h.id, label: habileteLabel(h) })),
      ...cochees.filter((c) => !connues.has(c)).map((c) => ({ id: c, label: c })),
    ];
  }

  function toggleCompetence(index: number, id: string) {
    const cochees = questions[index].competences ?? [];
    updateQuestion(index, {
      competences: cochees.includes(id) ? cochees.filter((c) => c !== id) : [...cochees, id],
    });
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

  const totalReponses = questions.reduce((s, q) => s + (q.points || 0), 0);
  // 1 point par source demandée
  const totalDemarche = questions.reduce((s, q) => s + (q.pointsDemarche ?? q.nbSources ?? 0), 0);

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
            <button type="button" onClick={ajouterTheme} className={styles.btnAddTheme} disabled={disabled}>
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

      {/* Bandeau : totaux */}
      <div className={styles.totalsBar}>
        <span className={styles.totalChip}>
          Réponses : <strong>{totalReponses}</strong> pt{totalReponses > 1 ? 's' : ''}
        </span>
        <span className={`${styles.totalChip} ${styles.totalChipDemarche}`}>
          Démarche : <strong>{totalDemarche}</strong> pt{totalDemarche > 1 ? 's' : ''}
        </span>
        <span
          className={styles.info}
          title="La démarche note les mots-clés et les sites retenus par l'élève, indépendamment de sa réponse. Elle vaut 1 point par source demandée."
        >
          i
        </span>
      </div>

      {/* Blocs de questions */}
      <div className={styles.qList}>
        {questions.length === 0 && (
          <p className={styles.emptyMessage}>
            Aucune question. Chaque question demande à l&apos;élève de collecter des sources web,
            puis de répondre.
          </p>
        )}

        {questions.map((q, index) => {
          const isOpen = openIndexes.has(index);
          const nbHabiletes = (q.competences ?? []).length;
          return (
            <div
              key={index}
              className={`${styles.qBlock} ${dragIndex === index ? styles.qBlockDragging : ''} ${
                overIndex === index && dragIndex !== null && dragIndex !== index ? styles.qBlockOver : ''
              }`}
              draggable={!disabled}
              onDragStart={() => setDragIndex(index)}
              onDragEnd={() => {
                setDragIndex(null);
                setOverIndex(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setOverIndex(index);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex !== null) deplacerQuestion(dragIndex, index);
                setDragIndex(null);
                setOverIndex(null);
              }}
            >
              {/* Entête cliquable */}
              <div className={styles.qHead} onClick={() => toggleOpen(index)}>
                <span className={styles.grip} title="Glisser pour réordonner" onClick={(e) => e.stopPropagation()}>
                  ⠿
                </span>
                <span className={styles.chevron}>{isOpen ? '▾' : '▸'}</span>
                <span className={styles.qNum}>Question {index + 1}</span>
                <span className={`${styles.qType} ${q.type === 'qcm' ? styles.typeQcm : styles.typeTexte}`}>
                  {q.type === 'qcm' ? 'QCM' : 'Ouverte'}
                </span>
                {!isOpen && q.texte && <span className={styles.qExcerpt}>{excerpt(q.texte)}</span>}

                <span className={styles.headRight} onClick={(e) => e.stopPropagation()}>
                  {/* Habiletés */}
                  <span className={styles.habWrap}>
                    <button
                      type="button"
                      className={`${styles.habBtn} ${nbHabiletes > 0 ? styles.habBtnOn : ''}`}
                      onClick={() => setHabiletesOpenIndex(habiletesOpenIndex === index ? null : index)}
                      disabled={disabled}
                      title="Habiletés exercées — les résultats alimenteront l'onglet Rechercher du profil de l'élève."
                    >
                      Habiletés{nbHabiletes > 0 ? ` (${nbHabiletes})` : ''} ▾
                    </button>
                    {habiletesOpenIndex === index && (
                      <>
                        <span className={styles.habBackdrop} onClick={() => setHabiletesOpenIndex(null)} />
                        <span className={styles.habMenu}>
                          <span className={styles.habMenuTitle}>Habiletés — chercher, c&apos;est lire</span>
                          {habileteOptions(q).length === 0 && (
                            <span className={styles.habEmpty}>
                              Aucune habileté disponible — à gérer dans Administration du site.
                            </span>
                          )}
                          {habileteOptions(q).map((h) => (
                            <label key={h.id} className={styles.habItem}>
                              <input
                                type="checkbox"
                                checked={(q.competences ?? []).includes(h.id)}
                                onChange={() => toggleCompetence(index, h.id)}
                                disabled={disabled}
                              />
                              {h.label}
                            </label>
                          ))}
                        </span>
                      </>
                    )}
                  </span>

                  <span className={styles.qPts}>
                    Réponse
                    <input
                      type="number"
                      min={0}
                      value={q.points ?? 0}
                      onChange={(e) => updateQuestion(index, { points: Math.max(0, Number(e.target.value) || 0) })}
                      disabled={disabled}
                    />
                  </span>
                  {/* Démarche : 1 point par source demandée — rien à saisir */}
                  <span
                    className={`${styles.qPts} ${styles.qPtsDemarche}`}
                    title="La démarche vaut 1 point par source demandée. Pour la pondérer, changez le nombre de sources."
                  >
                    Démarche
                    <strong className={styles.demarcheAuto}>{q.pointsDemarche ?? q.nbSources}</strong>
                  </span>

                  <button
                    type="button"
                    className={styles.qAction}
                    onClick={() => dupliquerQuestion(index)}
                    title="Dupliquer cette question"
                    disabled={disabled}
                  >
                    ⧉
                  </button>
                  <button
                    type="button"
                    className={`${styles.qAction} ${styles.qDel}`}
                    onClick={() => supprimerQuestion(index)}
                    title="Supprimer cette question"
                    disabled={disabled}
                  >
                    🗑
                  </button>
                </span>
              </div>

              {isOpen && (
                <div className={styles.qBody}>
                  {/* Énoncé — redimensionnable, et il grandit avec le texte */}
                  <div className={styles.enonceRow}>
                    <textarea
                      className={styles.enonceTextarea}
                      value={q.texte}
                      onChange={(e) => updateQuestion(index, { texte: e.target.value })}
                      placeholder="Ex : Trouvez un article sur... puis expliquez..."
                      rows={Math.min(12, Math.max(3, q.texte.split('\n').length + Math.floor(q.texte.length / 90)))}
                      disabled={disabled}
                    />
                    <div className={styles.enonceIcons}>
                      <button
                        type="button"
                        className={`${styles.iconBtn} ${q.document ? styles.iconOn : ''}`}
                        onClick={() =>
                          updateQuestion(index, { document: q.document === undefined ? '' : undefined })
                        }
                        disabled={disabled}
                        title={
                          q.document !== undefined
                            ? 'Retirer le document joint'
                            : 'Joindre un texte à la question — un extrait, une consigne longue, un document à lire.'
                        }
                      >
                        📄
                      </button>
                    </div>
                  </div>

                  {/* Document joint */}
                  {q.document !== undefined && (
                    <div className={styles.docBlock}>
                      <label className={styles.docLabel}>Document joint à la question</label>
                      <textarea
                        className={styles.docTextarea}
                        value={q.document}
                        onChange={(e) => updateQuestion(index, { document: e.target.value })}
                        placeholder="Texte que l'élève lira sous l'énoncé, dans l'extension…"
                        rows={5}
                        disabled={disabled}
                      />
                    </div>
                  )}

                  {/* QCM */}
                  {q.type === 'qcm' && (
                    <div className={styles.choices}>
                      <p className={styles.hint}>
                        Cliquez sur une option pour la marquer comme bonne réponse — elle sera corrigée
                        automatiquement.
                      </p>
                      {(q.options || []).map((opt, j) => {
                        const correcte = (q.correctes || []).includes(j);
                        return (
                          <div
                            key={j}
                            className={`${styles.choice} ${correcte ? styles.choiceCorrect : ''}`}
                            onClick={() => toggleCorrecte(index, j)}
                          >
                            <span className={`${styles.choiceLabel} ${correcte ? styles.choiceLabelOn : ''}`}>
                              {correcte ? '✓' : String.fromCharCode(65 + j)}
                            </span>
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => {
                                e.stopPropagation();
                                updateOption(index, j, e.target.value);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              placeholder={`Option ${String.fromCharCode(65 + j)}`}
                              disabled={disabled}
                            />
                            {(q.options || []).length > 2 && (
                              <button
                                type="button"
                                className={styles.choiceDel}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  supprimerOption(index, j);
                                }}
                                disabled={disabled}
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        );
                      })}
                      <button
                        type="button"
                        className={styles.addChoice}
                        onClick={() => ajouterOption(index)}
                        disabled={disabled}
                      >
                        + Ajouter un choix
                      </button>
                    </div>
                  )}

                  {/* Réglages propres à la recherche */}
                  <div className={styles.settingsRow}>
                    <label className={styles.setting}>
                      Sources à collecter
                      <select
                        value={q.nbSources}
                        onChange={(e) => updateQuestion(index, { nbSources: parseInt(e.target.value) })}
                        disabled={disabled}
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            {n} source{n > 1 ? 's' : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.setting}>
                      Type
                      <select
                        value={q.type}
                        onChange={(e) => {
                          const newType = e.target.value as 'texte' | 'qcm';
                          const patch: Partial<NavigKidQuestion> = { type: newType };
                          if (newType === 'qcm' && !q.options) {
                            patch.options = ['', ''];
                            patch.correctes = [];
                          }
                          updateQuestion(index, patch);
                        }}
                        disabled={disabled}
                      >
                        <option value="texte">Ouverte</option>
                        <option value="qcm">QCM</option>
                      </select>
                    </label>
                  </div>

                  {/* Corrigé & références (prof uniquement — jamais envoyé à l'élève) */}
                  <details className={styles.details}>
                    <summary className={styles.detailsSummary}>Corrigé &amp; références</summary>
                    <div className={styles.detailsContent}>
                      <label className={styles.detailsLabel}>Réponse attendue</label>
                      <textarea
                        value={q.reponseAttendue || ''}
                        onChange={(e) => updateQuestion(index, { reponseAttendue: e.target.value })}
                        placeholder="Éléments de réponse attendus, points clés..."
                        rows={3}
                        className={styles.detailsTextarea}
                        disabled={disabled}
                      />
                      <label className={styles.detailsLabel}>Références</label>
                      {(q.referencesProf || []).map((url, ri) => (
                        <div key={ri} className={styles.refRow}>
                          <span className={styles.refArrow}>→</span>
                          <input
                            type="text"
                            value={url}
                            onChange={(e) => {
                              const refs = [...(q.referencesProf || [])];
                              refs[ri] = e.target.value;
                              updateQuestion(index, { referencesProf: refs });
                            }}
                            placeholder="https://..."
                            className={styles.refInput}
                            disabled={disabled}
                          />
                          {url && (
                            <a href={url} target="_blank" rel="noopener noreferrer" className={styles.refLink}>
                              ↗
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              updateQuestion(index, {
                                referencesProf: (q.referencesProf || []).filter((_, k) => k !== ri),
                              })
                            }
                            className={styles.choiceDel}
                            disabled={disabled}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          updateQuestion(index, { referencesProf: [...(q.referencesProf || []), ''] })
                        }
                        className={styles.addChoice}
                        disabled={disabled}
                      >
                        + Ajouter une référence
                      </button>
                    </div>
                  </details>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Boutons d'ajout */}
      <div className={styles.addButtons}>
        <button
          type="button"
          onClick={() => ajouterQuestion('texte')}
          className={`${styles.btnAdd} ${styles.btnAddTexte}`}
          disabled={disabled}
        >
          + Question ouverte
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
  );
}
