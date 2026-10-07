'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useVocabulaireWords } from '@/hooks/useVocabulaireWords';
import EmptyState from '@/components/EmptyState/EmptyState';
import type { VocabulaireThemeSummary } from '@/hooks/useVocabulaireThemes';
import type { VocabulaireWord } from '@/types/vocabulaire';
import styles from './VocabListEditor.module.css';

// Sheets modèle public (Drive de JP) — l'URL en /copy en crée une copie chez le prof.
// Si le fichier est déplacé, supprimé ou rendu privé, le bouton casse en silence.
const TEMPLATE_COPY_URL =
  'https://docs.google.com/spreadsheets/d/1mW2_YHOQVZQ5GHgXsD-GbaqmbrSSuCgcXOLB8M-Qk7E/copy';

// Champs que l'IA peut compléter (tout sauf le terme lui-même), dans l'ordre du modèle
const OPTIONAL_FIELDS: (keyof VocabulaireWord)[] = ['definition', 'example', 'synonyms', 'antonyms', 'wordFamily'];

// Sauvegarde automatique : délai après la dernière modification, et après un échec
const AUTOSAVE_DELAY_MS = 1500;
const AUTOSAVE_RETRY_MS = 5000;

// Mots envoyés par appel à l'IA : au-delà, la réponse risque d'être tronquée
const ENRICH_BATCH_SIZE = 15;

function normalizeWord(word: string): string {
  return word.toLowerCase().trim();
}

function hasEmptyFields(word: VocabulaireWord): boolean {
  return OPTIONAL_FIELDS.some((field) => !(word[field] || '').trim());
}

// Liste collée : un mot par ligne (puces et numéros retirés). Des lignes copiées
// depuis un tableur (cellules séparées par des tabulations) sont lues dans
// l'ordre des colonnes du modèle ; une ligne d'en-tête « Terme » est ignorée.
function parsePastedList(text: string): VocabulaireWord[] {
  const words: VocabulaireWord[] = [];
  for (const line of text.split(/\r?\n/)) {
    const cells = line.split('\t').map((c) => c.trim());
    const term = cells[0].replace(/^(?:[-•*–]|\d+[.)])\s+/, '').trim();
    if (!term || normalizeWord(term) === 'terme') continue;
    words.push({
      word: term,
      definition: cells[1] || '',
      example: cells[2] || '',
      synonyms: cells[3] || '',
      antonyms: cells[4] || '',
      wordFamily: cells[5] || '',
    });
  }
  return words;
}

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
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

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

  // Import : liste collée ou Google Sheets public
  const [showImport, setShowImport] = useState(false);
  const [importTab, setImportTab] = useState<'list' | 'sheet'>('list');
  const [importText, setImportText] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ added: number; skipped: number } | null>(null);
  // Aides IA cochées avant l'import, lancées dans la foulée
  const [importComplete, setImportComplete] = useState(true);
  const [importEnrich, setImportEnrich] = useState(false);
  // IA : complétion des champs vides (progression par lots)
  const [completing, setCompleting] = useState<{ done: number; total: number } | null>(null);

  // Sauvegarde automatique : refs lues par les timers et au démontage
  const themeId = theme?.id;
  const editingWordsRef = useRef(editingWords);
  const dirtyRef = useRef(dirty);
  const updateWordsRef = useRef(updateWords);
  useEffect(() => {
    editingWordsRef.current = editingWords;
    dirtyRef.current = dirty;
    updateWordsRef.current = updateWords;
  });

  // Changement de liste (même composant réutilisé) : on repart d'un tableau vide
  // pour ne jamais enregistrer les mots de l'ancienne liste dans la nouvelle.
  // Au départ (changement de liste, fermeture, navigation), ce qui attendait
  // encore le délai de sauvegarde est enregistré immédiatement.
  useEffect(() => {
    setEditingWords([]);
    setDirty(false);
    dirtyRef.current = false;
    setSaveStatus('idle');
    if (!themeId || readOnly) return;
    return () => {
      if (dirtyRef.current) {
        updateWordsRef.current(themeId, editingWordsRef.current.filter((w) => w.word.trim()))
          .catch((err) => console.error('VocabListEditor: sauvegarde au départ échouée', err));
      }
    };
  }, [themeId, readOnly]);

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

  const saveWords = useCallback(async () => {
    if (!themeId || !dirtyRef.current) return;
    const snapshot = editingWordsRef.current;
    setSaving(true);
    setSaveStatus('saving');
    try {
      await updateWords(themeId, snapshot.filter((w) => w.word.trim()));
      // Modifié pendant l'enregistrement → reste à enregistrer, le cycle suivant s'en charge
      if (editingWordsRef.current === snapshot) setDirty(false);
      setSaveStatus('saved');
    } catch (err) {
      console.error('VocabListEditor: sauvegarde automatique échouée', err);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  }, [themeId, updateWords]);

  // Sauvegarde automatique : AUTOSAVE_DELAY_MS après la dernière modification
  // (nouvel essai plus espacé après un échec). Une seule requête à la fois.
  useEffect(() => {
    if (!dirty || saving || readOnly || !themeId) return;
    const timer = setTimeout(saveWords, saveStatus === 'error' ? AUTOSAVE_RETRY_MS : AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [editingWords, dirty, saving, readOnly, themeId, saveWords, saveStatus]);

  // `baseWords` : la liste à jour quand l'appel suit un import (le state n'a pas
  // encore été relu) — sinon la liste affichée
  const handleAiSuggest = useCallback(async (baseWords?: VocabulaireWord[]) => {
    if (!theme || !getAuthHeaders) return;
    const listWords = baseWords ?? editingWords;
    setAiLoading(true);
    setShowAiSuggestions(true);
    setShowImport(false);
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
          existingWords: listWords.map((w) => w.word),
        }),
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        // Filtrer les mots deja dans la liste
        const existingWords = new Set(listWords.map((w) => w.word.toLowerCase().trim()));
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

  const resetImport = useCallback(() => {
    setImportText('');
    setImportUrl('');
    setImportError(null);
    setImportResult(null);
  }, []);

  const handleToggleImport = useCallback(() => {
    setShowImport((prev) => !prev);
    setShowAiSuggestions(false);
    resetImport();
  }, [resetImport]);

  // IA : remplit uniquement les cases vides — ce que le prof a écrit n'est
  // jamais écrasé. Par lots, pour qu'une longue liste importée passe.
  const completeEmptyFields = useCallback(async (targets: string[]) => {
    if (!getAuthHeaders || targets.length === 0) return;

    setCompleting({ done: 0, total: targets.length });
    let completed = 0;
    let failed = false;
    try {
      for (let i = 0; i < targets.length; i += ENRICH_BATCH_SIZE) {
        const batch = targets.slice(i, i + ENRICH_BATCH_SIZE);
        const headers = await getAuthHeaders();
        if (!headers) { failed = true; break; }
        const res = await fetch('/api/vocabulaire/suggest', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'enrich', words: batch }),
        });
        const json = await res.json();
        if (!json.success || !Array.isArray(json.data)) { failed = true; break; }

        // L'IA renvoie les mots dans l'ordre demandé : appariement par position,
        // ou par le mot lui-même si elle en a sauté ou ajouté
        const data = json.data as VocabulaireWord[];
        const byWord = new Map<string, VocabulaireWord>(
          data.length === batch.length
            ? batch.map((w, idx) => [normalizeWord(w), data[idx]])
            : data.map((w) => [normalizeWord(w.word || ''), w])
        );
        setEditingWords((prev) => prev.map((w) => {
          const enriched = byWord.get(normalizeWord(w.word));
          if (!enriched) return w;
          const merged = { ...w };
          for (const field of OPTIONAL_FIELDS) {
            if (!(merged[field] || '').trim() && enriched[field]) merged[field] = enriched[field];
          }
          return merged;
        }));
        setDirty(true);
        completed += batch.length;
        setCompleting({ done: completed, total: targets.length });
      }
    } catch {
      failed = true;
    } finally {
      setCompleting(null);
    }

    if (failed) {
      onMessage?.(
        completed > 0
          ? `Complétion interrompue après ${completed} mot${completed > 1 ? 's' : ''} — les champs restants sont à remplir à la main.`
          : 'Erreur lors de la complétion IA',
        'error'
      );
    }
  }, [getAuthHeaders, onMessage]);

  // Ajoute les mots importés en fin de tableau, sans doublon (ni avec la liste,
  // ni entre eux), puis lance les aides IA cochées : complétion des champs vides
  // des mots importés, puis suggestions de mots en plus (panneau IA).
  const addImportedWords = useCallback(async (incoming: VocabulaireWord[]) => {
    const seen = new Set(editingWords.map((w) => normalizeWord(w.word)));
    const fresh: VocabulaireWord[] = [];
    for (const w of incoming) {
      const key = normalizeWord(w.word);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      fresh.push(w);
    }
    if (fresh.length > 0) {
      setEditingWords((prev) => [...prev, ...fresh]);
      setDirty(true);
    }
    setImportResult({ added: fresh.length, skipped: incoming.length - fresh.length });

    if (importComplete) {
      await completeEmptyFields(fresh.filter(hasEmptyFields).map((w) => w.word));
    }
    if (importEnrich) {
      resetImport();
      handleAiSuggest([...editingWords, ...fresh]);
    }
  }, [editingWords, importComplete, importEnrich, completeEmptyFields, resetImport, handleAiSuggest]);

  const handleImport = useCallback(async () => {
    setImportError(null);

    if (importTab === 'list') {
      const parsed = parsePastedList(importText);
      if (parsed.length === 0) {
        setImportError('Aucun mot à importer.');
        return;
      }
      await addImportedWords(parsed);
      return;
    }

    if (!getAuthHeaders || !importUrl.trim()) return;
    setImporting(true);
    let sheetWords: VocabulaireWord[] | null = null;
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch('/api/vocabulaire/import', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: importUrl.trim() }),
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        sheetWords = json.data;
      } else {
        setImportError(json.message || 'Erreur lors de l\'import');
      }
    } catch {
      setImportError('Erreur lors de l\'import du Sheet');
    } finally {
      setImporting(false);
    }
    if (sheetWords) await addImportedWords(sheetWords);
  }, [importTab, importText, importUrl, getAuthHeaders, addImportedWords]);

  // Plus de confirmation : ce qui reste en attente est enregistré au démontage
  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

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
        <EmptyState icon="hourglass" message="En cours de chargement" />
      ) : (
        <>
          {!readOnly && (
            <div className={styles.vocabTableActions}>
              <button className={styles.vocabAddWordBtn} onClick={handleAddWord}>
                + Ajouter un mot
              </button>
              <button
                className={`${styles.vocabAddWordBtn} ${showImport ? styles.vocabImportBtnActive : ''}`}
                onClick={handleToggleImport}
              >
                ⤓ Importer
              </button>
              {getAuthHeaders && (
                <button
                  className={styles.vocabAiBtn}
                  onClick={() => handleAiSuggest()}
                  disabled={aiLoading}
                >
                  {aiLoading ? 'Génération...' : '✨ Créer avec l\'IA'}
                </button>
              )}
              {(dirty || saveStatus !== 'idle') && (
                <span
                  className={`${styles.saveStatus} ${saveStatus === 'error' ? styles.saveStatusError : ''}`}
                  role="status"
                >
                  {saveStatus === 'error'
                    ? '⚠ Non enregistré — nouvel essai…'
                    : dirty || saving
                      ? 'Enregistrement…'
                      : 'Enregistré ✓'}
                </span>
              )}
            </div>
          )}

          {/* Panneau import : liste collée ou Google Sheets */}
          {showImport && !readOnly && (
            <div className={styles.importPanel}>
              <div className={styles.aiPanelHeader}>
                <h4 className={styles.importPanelTitle}>Importer des mots</h4>
                <button className={styles.vocabEditorClose} onClick={handleToggleImport}>
                  ✕
                </button>
              </div>

              {importResult ? (
                // Étape 2 : résultat (+ progression de la complétion IA)
                <>
                  <p className={styles.importSummary}>
                    {importResult.added > 0
                      ? `✓ ${importResult.added} mot${importResult.added > 1 ? 's' : ''} ajouté${importResult.added > 1 ? 's' : ''} au tableau`
                      : 'Aucun mot ajouté'}
                    {importResult.skipped > 0 &&
                      ` (${importResult.skipped} déjà présent${importResult.skipped > 1 ? 's' : ''}, ignoré${importResult.skipped > 1 ? 's' : ''})`}
                    .
                  </p>
                  {completing && (
                    <p className={styles.aiLoading}>
                      ✨ L&apos;IA complète les champs vides… {completing.done}/{completing.total}
                    </p>
                  )}
                  <div className={styles.aiActions}>
                    <button className={styles.modalCancelBtn} onClick={resetImport} disabled={!!completing}>
                      Importer d&apos;autres mots
                    </button>
                  </div>
                </>
              ) : (
                // Étape 1 : saisie de la source
                <>
                  {getAuthHeaders && (
                    <div className={styles.importTabs}>
                      <button
                        className={`${styles.importTab} ${importTab === 'list' ? styles.importTabActive : ''}`}
                        onClick={() => { setImportTab('list'); setImportError(null); }}
                      >
                        Liste de mots
                      </button>
                      <button
                        className={`${styles.importTab} ${importTab === 'sheet' ? styles.importTabActive : ''}`}
                        onClick={() => { setImportTab('sheet'); setImportError(null); }}
                      >
                        Google Sheets
                      </button>
                    </div>
                  )}

                  {importTab === 'list' || !getAuthHeaders ? (
                    <>
                      <textarea
                        className={styles.importTextarea}
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                        placeholder={'Un mot ou une expression par ligne :\nmélancolie\ns\'émerveiller\nprendre son envol'}
                        rows={8}
                        autoFocus
                      />
                      <p className={styles.importHint}>
                        Vous pouvez aussi coller des lignes copiées depuis un tableur : les colonnes sont
                        lues dans l&apos;ordre du modèle (Terme, Définition, Exemple, Synonymes, Antonymes, Proxémie).
                      </p>
                    </>
                  ) : (
                    <>
                      <label className={styles.modalLabel} htmlFor="vocab-import-url">
                        Lien du Google Sheets
                      </label>
                      <input
                        id="vocab-import-url"
                        className={styles.vocabCreateInput}
                        type="url"
                        value={importUrl}
                        onChange={(e) => setImportUrl(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleImport()}
                        placeholder="https://docs.google.com/spreadsheets/d/…"
                        autoFocus
                      />
                      <p className={styles.importHint}>
                        ⓘ Le Sheet doit être partagé en « Tous les utilisateurs disposant du lien ».
                        Copiez l&apos;URL depuis la barre d&apos;adresse, avec le bon onglet ouvert.
                      </p>

                      <div className={styles.sheetSampleWrapper}>
                        <table className={styles.sheetSample}>
                          <thead>
                            <tr>
                              <th className={styles.sheetSampleRequired}>Terme</th>
                              <th>Définition</th>
                              <th>Exemple</th>
                              <th>Synonymes</th>
                              <th>Antonymes</th>
                              <th>Proxémie</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td>mélancolie</td>
                              <td>Tristesse vague et douce…</td>
                              <td>Un dimanche de pluie…</td>
                              <td>nostalgie, spleen</td>
                              <td>gaieté</td>
                              <td>mélancolique</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <div className={styles.sheetSampleFooter}>
                        <span className={styles.importHint}>
                          Seule la colonne <strong>Terme</strong> est obligatoire. Les autres peuvent rester
                          vides : l&apos;IA pourra les compléter.
                        </span>
                        <a
                          className={styles.templateLink}
                          href={TEMPLATE_COPY_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Copier le modèle
                        </a>
                      </div>
                    </>
                  )}

                  {getAuthHeaders && (
                    <fieldset className={styles.importAiOptions}>
                      <legend className={styles.aiHint}>Aide de l&apos;IA, dans la foulée de l&apos;import :</legend>
                      <label className={styles.importAiOption}>
                        <input
                          type="checkbox"
                          checked={importComplete}
                          onChange={(e) => setImportComplete(e.target.checked)}
                        />
                        <span>
                          <strong>Compléter les champs vides</strong> des mots importés (définition,
                          exemple…) — ce que vous avez écrit n&apos;est jamais remplacé
                        </span>
                      </label>
                      <label className={styles.importAiOption}>
                        <input
                          type="checkbox"
                          checked={importEnrich}
                          onChange={(e) => setImportEnrich(e.target.checked)}
                        />
                        <span>
                          <strong>Enrichir la liste</strong> : l&apos;IA propose des mots en plus, vous
                          cochez ceux à garder
                        </span>
                      </label>
                    </fieldset>
                  )}

                  {importError && <p className={styles.importError}>{importError}</p>}

                  <div className={styles.aiActions}>
                    <span />
                    <button
                      className={styles.vocabCreateBtn}
                      onClick={handleImport}
                      disabled={
                        importing ||
                        (importTab === 'list' || !getAuthHeaders ? !importText.trim() : !importUrl.trim())
                      }
                    >
                      {importing ? 'Import...' : 'Importer'}
                    </button>
                  </div>
                </>
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
                      {readOnly ? 'Cette liste est vide.' : 'Aucun mot — cliquez sur « Ajouter un mot » ou « Importer » pour commencer.'}
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
