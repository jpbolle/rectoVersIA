'use client';

import { useState, useEffect, useCallback } from 'react';
import { useVocabulaireWords } from '@/hooks/useVocabulaireWords';
import EmptyState from '@/components/EmptyState/EmptyState';
import type { VocabulaireThemeSummary } from '@/hooks/useVocabulaireThemes';
import type { VocabulaireWord } from '@/types/vocabulaire';
import styles from './VocabListEditor.module.css';

// Outil de création/édition d'une liste de vocabulaire — utilisé par la page
// Mes Ressources (onglet Listes de vocabulaire) et par le verso du formulaire
// de création d'activité (type vocabulaire). Une seule source : les listes
// créées ici vivent dans les mêmes collections Firestore.
interface VocabListEditorProps {
  // 'create' : saisie du nom d'une nouvelle liste — objet : édition de la liste
  mode: 'create' | VocabulaireThemeSummary;
  readOnly?: boolean;
  createTheme: (name: string) => Promise<string | null>;
  updateWords: (id: string, words: VocabulaireWord[]) => Promise<void>;
  updateThemeMeta?: (id: string, meta: { targetLevels?: string[] }) => Promise<void>;
  getAuthHeaders?: () => Promise<Record<string, string> | null>;
  onClose?: () => void;
  onCreated?: (theme: VocabulaireThemeSummary) => void;
  onMessage?: (text: string, type: 'success' | 'error') => void;
}

export default function VocabListEditor({
  mode,
  readOnly = false,
  createTheme,
  updateWords,
  updateThemeMeta,
  getAuthHeaders,
  onClose,
  onCreated,
  onMessage,
}: VocabListEditorProps) {
  const theme = typeof mode === 'object' ? mode : null;

  const [newListName, setNewListName] = useState('');
  const [creating, setCreating] = useState(false);
  const [targetLevels, setTargetLevels] = useState<string[]>([]);

  // Mots de la liste en cours
  const { words: wordsMap, isLoading: wordsLoading } = useVocabulaireWords(
    theme ? [theme.id] : null
  );
  const [editingWords, setEditingWords] = useState<VocabulaireWord[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Popup ajout de mot
  const [showAddWordModal, setShowAddWordModal] = useState(false);
  const [newWord, setNewWord] = useState<VocabulaireWord>({
    word: '', definition: '', example: '', synonyms: '', antonyms: '', wordFamily: '',
  });

  // IA : suggestions de mots
  const [showAiSuggestions, setShowAiSuggestions] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiSelectedWords, setAiSelectedWords] = useState<Set<string>>(new Set());
  const [aiLoading, setAiLoading] = useState(false);
  const [aiEnriching, setAiEnriching] = useState(false);

  // Charger les mots quand la liste est disponible
  useEffect(() => {
    if (theme && wordsMap[theme.id]) {
      setEditingWords(wordsMap[theme.id].map((w) => ({ ...w })));
      setDirty(false);
    }
  }, [theme?.id, wordsMap]); // eslint-disable-line react-hooks/exhaustive-deps

  // Synchroniser les niveaux ciblés quand on change de liste
  useEffect(() => {
    setTargetLevels(theme?.targetLevels || []);
  }, [theme?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreateConfirm = useCallback(async () => {
    if (!newListName.trim() || creating) return;
    setCreating(true);
    try {
      const id = await createTheme(newListName.trim());
      if (id) {
        onMessage?.(`Liste "${newListName.trim()}" créée !`, 'success');
        onCreated?.({ id, name: newListName.trim(), wordCount: 0, profId: null });
      }
      setNewListName('');
    } catch (err) {
      onMessage?.(err instanceof Error ? err.message : 'Erreur lors de la création', 'error');
    } finally {
      setCreating(false);
    }
  }, [newListName, creating, createTheme, onCreated, onMessage]);

  const handleWordChange = useCallback((index: number, field: keyof VocabulaireWord, value: string) => {
    setEditingWords((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    setDirty(true);
  }, []);

  const handleAddWord = useCallback(() => {
    setNewWord({ word: '', definition: '', example: '', synonyms: '', antonyms: '', wordFamily: '' });
    setShowAddWordModal(true);
  }, []);

  const handleConfirmAddWord = useCallback(() => {
    if (!newWord.word.trim()) return;
    setEditingWords((prev) => [...prev, { ...newWord }]);
    setDirty(true);
    setShowAddWordModal(false);
  }, [newWord]);

  const handleRemoveWord = useCallback((index: number) => {
    setEditingWords((prev) => prev.filter((_, i) => i !== index));
    setDirty(true);
  }, []);

  const handleSaveWords = useCallback(async () => {
    if (!theme) return;
    setSaving(true);
    try {
      const cleaned = editingWords.filter((w) => w.word.trim());
      await updateWords(theme.id, cleaned);
      setDirty(false);
      onMessage?.('Liste sauvegardée !', 'success');
    } catch (err) {
      onMessage?.(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde', 'error');
    } finally {
      setSaving(false);
    }
  }, [theme, editingWords, updateWords, onMessage]);

  const handleAiSuggest = useCallback(async () => {
    if (!theme || !getAuthHeaders) return;
    setAiLoading(true);
    setShowAiSuggestions(true);
    setAiSuggestions([]);
    setAiSelectedWords(new Set());

    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch('/api/vocabulaire/suggest', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'suggest',
          themeName: theme.name,
          existingWords: editingWords.map((w) => w.word),
        }),
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        // Filtrer les mots deja dans la liste
        const existingWords = new Set(editingWords.map((w) => w.word.toLowerCase().trim()));
        const filtered = json.data.filter((w: string) => !existingWords.has(w.toLowerCase().trim()));
        setAiSuggestions(filtered);
      } else {
        onMessage?.(json.message || 'Erreur lors de la génération', 'error');
      }
    } catch {
      onMessage?.('Erreur lors de la génération IA', 'error');
    } finally {
      setAiLoading(false);
    }
  }, [theme, editingWords, getAuthHeaders, onMessage]);

  const handleToggleAiWord = useCallback((word: string) => {
    setAiSelectedWords((prev) => {
      const next = new Set(prev);
      if (next.has(word)) next.delete(word);
      else next.add(word);
      return next;
    });
  }, []);

  const handleImportAiWords = useCallback(async () => {
    if (aiSelectedWords.size === 0 || !getAuthHeaders) return;
    setAiEnriching(true);

    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const wordsToEnrich = Array.from(aiSelectedWords);
      const res = await fetch('/api/vocabulaire/suggest', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enrich', words: wordsToEnrich }),
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const enrichedWords: VocabulaireWord[] = json.data.map((w: VocabulaireWord) => ({
          word: w.word || '',
          definition: w.definition || '',
          example: w.example || '',
          synonyms: w.synonyms || '',
          antonyms: w.antonyms || '',
          wordFamily: w.wordFamily || '',
        }));
        setEditingWords((prev) => [...prev, ...enrichedWords]);
        setDirty(true);
        setShowAiSuggestions(false);
        setAiSuggestions([]);
        setAiSelectedWords(new Set());
        onMessage?.(
          `${enrichedWords.length} mot${enrichedWords.length > 1 ? 's' : ''} importé${enrichedWords.length > 1 ? 's' : ''} et enrichi${enrichedWords.length > 1 ? 's' : ''} !`,
          'success'
        );
      } else {
        onMessage?.(json.message || 'Erreur lors de l\'enrichissement', 'error');
      }
    } catch {
      onMessage?.('Erreur lors de l\'enrichissement IA', 'error');
    } finally {
      setAiEnriching(false);
    }
  }, [aiSelectedWords, getAuthHeaders, onMessage]);

  const handleClose = useCallback(() => {
    if (!readOnly && dirty && !confirm('Vous avez des modifications non sauvegardées. Fermer quand même ?')) return;
    onClose?.();
  }, [readOnly, dirty, onClose]);

  // ── Mode création : saisie du nom ──
  if (!theme) {
    return (
      <div className={styles.vocabEditor}>
        <div className={styles.vocabEditorHeader}>
          <h3 className={styles.vocabEditorTitle}>Nouvelle liste de vocabulaire</h3>
          {onClose && (
            <button className={styles.vocabEditorClose} onClick={handleClose}>
              ✕
            </button>
          )}
        </div>
        <div className={styles.vocabCreateRow}>
          <input
            className={styles.vocabCreateInput}
            type="text"
            placeholder="Nom de la liste (ex : champ lexical de la nature)..."
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateConfirm()}
            autoFocus
          />
          <button
            className={styles.vocabCreateBtn}
            onClick={handleCreateConfirm}
            disabled={!newListName.trim() || creating}
          >
            {creating ? 'Création...' : 'Créer la liste'}
          </button>
        </div>
      </div>
    );
  }

  // ── Mode édition / lecture seule ──
  return (
    <div className={styles.vocabEditor}>
      <div className={styles.vocabEditorHeader}>
        <h3 className={styles.vocabEditorTitle}>
          {theme.name.charAt(0).toUpperCase() + theme.name.slice(1)}
          {readOnly && <span className={styles.vocabReadOnlyBadge}>lecture seule</span>}
        </h3>
        {onClose && (
          <button className={styles.vocabEditorClose} onClick={handleClose}>
            ✕
          </button>
        )}
      </div>

      {/* Eleves cibles */}
      {!readOnly && updateThemeMeta && (
        <div className={styles.vocabTargetLevels}>
          <label className={styles.vocabTargetLabel}>Élèves ciblés :</label>
          <div className={styles.vocabTargetChips}>
            {['1', '2', '3', '4', '5', '6', 'daspa'].map((level) => {
              const active = targetLevels.includes(level);
              return (
                <button
                  key={level}
                  type="button"
                  className={`${styles.vocabTargetChip} ${active ? styles.vocabTargetChipActive : ''}`}
                  onClick={() => {
                    const updated = active
                      ? targetLevels.filter((l) => l !== level)
                      : [...targetLevels, level];
                    setTargetLevels(updated);
                    updateThemeMeta(theme.id, { targetLevels: updated });
                  }}
                >
                  {level}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {wordsLoading ? (
        <EmptyState icon="hourglass" message="Chargement des mots..." />
      ) : (
        <>
          {!readOnly && (
            <div className={styles.vocabTableActions}>
              <button className={styles.vocabAddWordBtn} onClick={handleAddWord}>
                + Ajouter un mot
              </button>
              {getAuthHeaders && (
                <button
                  className={styles.vocabAiBtn}
                  onClick={handleAiSuggest}
                  disabled={aiLoading}
                >
                  {aiLoading ? 'Génération...' : '✨ Créer avec l\'IA'}
                </button>
              )}
              {dirty && (
                <button
                  className={styles.vocabSaveBtn}
                  onClick={handleSaveWords}
                  disabled={saving}
                >
                  {saving ? 'Sauvegarde...' : 'Sauvegarder les modifications'}
                </button>
              )}
            </div>
          )}

          {/* Panneau suggestions IA */}
          {showAiSuggestions && (
            <div className={styles.aiPanel}>
              <div className={styles.aiPanelHeader}>
                <h4 className={styles.aiPanelTitle}>
                  Suggestions de l&apos;IA pour &laquo;&nbsp;{theme.name}&nbsp;&raquo;
                </h4>
                <button
                  className={styles.vocabEditorClose}
                  onClick={() => { setShowAiSuggestions(false); setAiSuggestions([]); setAiSelectedWords(new Set()); }}
                >
                  ✕
                </button>
              </div>
              {aiLoading ? (
                <div className={styles.aiLoading}>Génération en cours...</div>
              ) : aiSuggestions.length === 0 ? (
                <div className={styles.aiLoading}>Aucune suggestion disponible.</div>
              ) : (
                <>
                  <p className={styles.aiHint}>
                    Cliquez sur les mots à importer, puis validez.
                  </p>
                  <div className={styles.aiTagGrid}>
                    {aiSuggestions.map((word) => (
                      <button
                        key={word}
                        className={`${styles.aiTag} ${aiSelectedWords.has(word) ? styles.aiTagSelected : ''}`}
                        onClick={() => handleToggleAiWord(word)}
                      >
                        {word}
                      </button>
                    ))}
                  </div>
                  <div className={styles.aiActions}>
                    <span className={styles.aiCount}>
                      {aiSelectedWords.size} mot{aiSelectedWords.size > 1 ? 's' : ''} sélectionné{aiSelectedWords.size > 1 ? 's' : ''}
                    </span>
                    <button
                      className={styles.vocabCreateBtn}
                      onClick={handleImportAiWords}
                      disabled={aiSelectedWords.size === 0 || aiEnriching}
                    >
                      {aiEnriching ? 'Enrichissement...' : 'Importer et enrichir'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          <div className={styles.vocabTableWrapper}>
            <table className={styles.vocabTable}>
              <thead>
                <tr>
                  <th className={styles.vocabThTerm}>Terme</th>
                  <th className={styles.vocabThDef}>Définition</th>
                  <th className={styles.vocabThExample}>Exemple d&apos;emploi</th>
                  <th className={styles.vocabThSyn}>Synonymes</th>
                  <th className={styles.vocabThAnt}>Antonymes</th>
                  <th className={styles.vocabThFam}>Proxémie linguistique</th>
                  {!readOnly && <th className={styles.vocabThActions}></th>}
                </tr>
              </thead>
              <tbody>
                {editingWords.length === 0 ? (
                  <tr>
                    <td colSpan={readOnly ? 6 : 7} className={styles.vocabEmptyRow}>
                      {readOnly ? 'Cette liste est vide.' : 'Aucun mot — cliquez sur « Ajouter un mot » pour commencer.'}
                    </td>
                  </tr>
                ) : editingWords.map((word, idx) => (
                  <tr key={idx}>
                    <td>
                      {readOnly ? (
                        <span className={styles.vocabCellText}>{word.word}</span>
                      ) : (
                        <input
                          className={styles.vocabInput}
                          type="text"
                          value={word.word}
                          onChange={(e) => handleWordChange(idx, 'word', e.target.value)}
                          placeholder="mot"
                        />
                      )}
                    </td>
                    <td>
                      {readOnly ? (
                        <span className={styles.vocabCellText}>{word.definition}</span>
                      ) : (
                        <textarea
                          className={styles.vocabTextarea}
                          value={word.definition}
                          onChange={(e) => handleWordChange(idx, 'definition', e.target.value)}
                          placeholder="définition"
                          rows={2}
                        />
                      )}
                    </td>
                    <td>
                      {readOnly ? (
                        <span className={styles.vocabCellText}>{word.example}</span>
                      ) : (
                        <textarea
                          className={styles.vocabTextarea}
                          value={word.example}
                          onChange={(e) => handleWordChange(idx, 'example', e.target.value)}
                          placeholder="exemple dans une phrase"
                          rows={2}
                        />
                      )}
                    </td>
                    <td>
                      {readOnly ? (
                        <span className={styles.vocabCellText}>{word.synonyms || '—'}</span>
                      ) : (
                        <input
                          className={styles.vocabInput}
                          type="text"
                          value={word.synonyms || ''}
                          onChange={(e) => handleWordChange(idx, 'synonyms', e.target.value)}
                          placeholder="synonymes"
                        />
                      )}
                    </td>
                    <td>
                      {readOnly ? (
                        <span className={styles.vocabCellText}>{word.antonyms || '—'}</span>
                      ) : (
                        <input
                          className={styles.vocabInput}
                          type="text"
                          value={word.antonyms || ''}
                          onChange={(e) => handleWordChange(idx, 'antonyms', e.target.value)}
                          placeholder="antonymes"
                        />
                      )}
                    </td>
                    <td>
                      {readOnly ? (
                        <span className={styles.vocabCellText}>{word.wordFamily || '—'}</span>
                      ) : (
                        <input
                          className={styles.vocabInput}
                          type="text"
                          value={word.wordFamily || ''}
                          onChange={(e) => handleWordChange(idx, 'wordFamily', e.target.value)}
                          placeholder="mots de la même famille"
                        />
                      )}
                    </td>
                    {!readOnly && (
                      <td>
                        <button
                          className={styles.vocabRemoveBtn}
                          onClick={() => handleRemoveWord(idx)}
                          title="Supprimer ce mot"
                        >
                          ✕
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modale ajout de mot */}
      {showAddWordModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAddWordModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Ajouter un mot</h3>
              <button className={styles.vocabEditorClose} onClick={() => setShowAddWordModal(false)}>
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Terme *</label>
                <input
                  className={styles.modalInput}
                  type="text"
                  value={newWord.word}
                  onChange={(e) => setNewWord((w) => ({ ...w, word: e.target.value }))}
                  placeholder="Le mot à ajouter"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleConfirmAddWord()}
                />
              </div>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Définition</label>
                <textarea
                  className={styles.modalTextarea}
                  value={newWord.definition}
                  onChange={(e) => setNewWord((w) => ({ ...w, definition: e.target.value }))}
                  placeholder="Définition du mot"
                  rows={2}
                />
              </div>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Exemple d&apos;emploi</label>
                <textarea
                  className={styles.modalTextarea}
                  value={newWord.example}
                  onChange={(e) => setNewWord((w) => ({ ...w, example: e.target.value }))}
                  placeholder="Exemple dans une phrase"
                  rows={2}
                />
              </div>
              <div className={styles.modalFieldRow}>
                <div className={styles.modalField}>
                  <label className={styles.modalLabel}>Synonymes</label>
                  <input
                    className={styles.modalInput}
                    type="text"
                    value={newWord.synonyms || ''}
                    onChange={(e) => setNewWord((w) => ({ ...w, synonyms: e.target.value }))}
                    placeholder="Synonymes"
                  />
                </div>
                <div className={styles.modalField}>
                  <label className={styles.modalLabel}>Antonymes</label>
                  <input
                    className={styles.modalInput}
                    type="text"
                    value={newWord.antonyms || ''}
                    onChange={(e) => setNewWord((w) => ({ ...w, antonyms: e.target.value }))}
                    placeholder="Antonymes"
                  />
                </div>
              </div>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Proxémie linguistique</label>
                <input
                  className={styles.modalInput}
                  type="text"
                  value={newWord.wordFamily || ''}
                  onChange={(e) => setNewWord((w) => ({ ...w, wordFamily: e.target.value }))}
                  placeholder="Mots de la même famille"
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.modalCancelBtn} onClick={() => setShowAddWordModal(false)}>
                Annuler
              </button>
              <button
                className={styles.vocabCreateBtn}
                onClick={handleConfirmAddWord}
                disabled={!newWord.word.trim()}
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
