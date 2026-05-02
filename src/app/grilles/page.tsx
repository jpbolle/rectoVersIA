'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useGrilles } from '@/hooks/useGrilles';
import { useVocabulaireThemes, type VocabulaireThemeSummary } from '@/hooks/useVocabulaireThemes';
import { useVocabulaireWords } from '@/hooks/useVocabulaireWords';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import GrilleCard from '@/components/GrilleCard/GrilleCard';
import CreateGrilleCard from '@/components/CreateGrilleCard/CreateGrilleCard';
import GrilleBuilder from '@/components/GrilleBuilder/GrilleBuilder';
import GrilleViewer from '@/components/GrilleViewer/GrilleViewer';
import VocabCard from '@/components/VocabCard/VocabCard';
import CreateVocabCard from '@/components/CreateVocabCard/CreateVocabCard';
import MessageBox from '@/components/MessageBox/MessageBox';
import EmptyState from '@/components/EmptyState/EmptyState';
import type { Grille, GrilleCriterion } from '@/types/grille';
import type { VocabulaireWord } from '@/types/vocabulaire';
import styles from './grilles.module.css';

type Tab = 'grilles' | 'vocabulaire';

export default function GrillesPage() {
  const { isAuthenticated, isLoading: authLoading, role, isAdmin: userIsAdmin, getAuthHeaders } = useAuth();
  const router = useRouter();
  const {
    grilles,
    sharedGrilles,
    otherProfsGrilles,
    isLoading: grillesLoading,
    createGrille,
    updateGrille,
    deleteGrille,
  } = useGrilles();

  // Onglet actif
  const [activeTab, setActiveTab] = useState<Tab>('grilles');

  const [isReady, setIsReady] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Mode builder grilles : 'create' | Grille (edition) | null (ferme)
  const [builderMode, setBuilderMode] = useState<'create' | Grille | null>(null);
  // Mode viewer grilles (lecture seule)
  const [viewingGrille, setViewingGrille] = useState<Grille | null>(null);

  // --- Vocabulaire ---
  const {
    myThemes,
    otherThemes,
    isLoading: vocabThemesLoading,
    createTheme,
    updateWords,
    updateThemeMeta,
    deleteTheme,
    duplicateTheme,
  } = useVocabulaireThemes();

  // Editeur vocabulaire : 'create' (saisie nom) | theme (edition) | null
  const [vocabEditorMode, setVocabEditorMode] = useState<'create' | VocabulaireThemeSummary | null>(null);
  // Viewer vocabulaire (lecture seule)
  const [viewingVocab, setViewingVocab] = useState<VocabulaireThemeSummary | null>(null);
  const [newListName, setNewListName] = useState('');
  const [editingTargetLevels, setEditingTargetLevels] = useState<string[]>([]);

  // Mots du theme en cours d'edition/visualisation
  const editingThemeId = vocabEditorMode && typeof vocabEditorMode === 'object' ? vocabEditorMode.id : null;
  const viewingThemeId = viewingVocab?.id || null;
  const activeThemeId = editingThemeId || viewingThemeId;
  const { words: vocabWordsMap, isLoading: vocabWordsLoading } = useVocabulaireWords(
    activeThemeId ? [activeThemeId] : null
  );
  const [editingWords, setEditingWords] = useState<VocabulaireWord[]>([]);
  const [vocabDirty, setVocabDirty] = useState(false);
  const [vocabSaving, setVocabSaving] = useState(false);
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

  // Charger les mots quand on selectionne un theme
  useEffect(() => {
    if (activeThemeId && vocabWordsMap[activeThemeId]) {
      setEditingWords(vocabWordsMap[activeThemeId].map((w) => ({ ...w })));
      setVocabDirty(false);
    }
  }, [activeThemeId, vocabWordsMap]);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (authLoading && !isAuthenticated) return;
    if (!isAuthenticated) {
      router.replace('/login');
    } else if (role !== 'prof') {
      router.replace('/activites');
    }
  }, [isAuthenticated, authLoading, role, router]);

  // --- Grilles callbacks ---
  const handleCreateClick = useCallback(() => {
    setBuilderMode('create');
  }, []);

  const handleEditClick = useCallback((grille: Grille) => {
    setBuilderMode(grille);
  }, []);

  const handleDuplicateClick = useCallback(
    async (grille: Grille) => {
      try {
        await createGrille({
          name: `${grille.name} (copie)`,
          description: grille.description,
          uaa: grille.uaa,
          criteria: grille.criteria,
        });
        setMessage({ text: `Grille "${grille.name}" dupliquée dans vos grilles !`, type: 'success' });
      } catch (err) {
        setMessage({
          text: err instanceof Error ? err.message : 'Erreur lors de la duplication',
          type: 'error',
        });
      }
    },
    [createGrille]
  );

  const handleDeleteClick = useCallback(
    async (grille: Grille) => {
      if (!confirm(`Supprimer la grille "${grille.name}" ? Cette action est irréversible.`)) {
        return;
      }
      try {
        await deleteGrille(grille.id);
        setMessage({ text: 'Grille supprimée avec succès', type: 'success' });
        if (builderMode && typeof builderMode === 'object' && builderMode.id === grille.id) {
          setBuilderMode(null);
        }
      } catch (err) {
        setMessage({
          text: err instanceof Error ? err.message : 'Erreur lors de la suppression',
          type: 'error',
        });
      }
    },
    [deleteGrille, builderMode]
  );

  const handleToggleShared = useCallback(
    async (grille: Grille) => {
      try {
        await updateGrille(grille.id, { shared: !grille.shared });
        setMessage({
          text: grille.shared
            ? `"${grille.name}" retirée des grilles exemples`
            : `"${grille.name}" partagée comme exemple`,
          type: 'success',
        });
      } catch (err) {
        setMessage({
          text: err instanceof Error ? err.message : 'Erreur lors du partage',
          type: 'error',
        });
      }
    },
    [updateGrille]
  );

  const handleBuilderSave = useCallback(
    async (data: { name: string; description: string; uaa: number[]; criteria: GrilleCriterion[] }) => {
      setIsSaving(true);
      try {
        if (builderMode === 'create') {
          await createGrille({
            name: data.name,
            description: data.description,
            uaa: data.uaa,
            criteria: data.criteria,
          });
          setMessage({ text: `Grille "${data.name}" créée avec succès !`, type: 'success' });
        } else if (builderMode && typeof builderMode === 'object') {
          await updateGrille(builderMode.id, {
            name: data.name,
            description: data.description,
            uaa: data.uaa,
            criteria: data.criteria,
          });
          setMessage({ text: `Grille "${data.name}" modifiée avec succès !`, type: 'success' });
        }
        setBuilderMode(null);
      } catch (err) {
        setMessage({
          text: err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement',
          type: 'error',
        });
      } finally {
        setIsSaving(false);
      }
    },
    [builderMode, createGrille, updateGrille]
  );

  const handleBuilderCancel = useCallback(() => {
    setBuilderMode(null);
  }, []);

  // --- Vocabulaire callbacks ---
  const handleVocabCreateClick = useCallback(() => {
    setVocabEditorMode('create');
    setViewingVocab(null);
    setNewListName('');
  }, []);

  const handleVocabCreateConfirm = useCallback(async () => {
    if (!newListName.trim()) return;
    try {
      const id = await createTheme(newListName.trim());
      if (id) {
        // Ouvrir directement en mode edition
        setVocabEditorMode({ id, name: newListName.trim(), wordCount: 0, profId: null });
        setEditingWords([]);
        setVocabDirty(false);
        setMessage({ text: `Liste "${newListName.trim()}" créée !`, type: 'success' });
      }
      setNewListName('');
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : 'Erreur lors de la création',
        type: 'error',
      });
    }
  }, [newListName, createTheme]);

  const handleVocabEditClick = useCallback((theme: VocabulaireThemeSummary) => {
    setVocabEditorMode(theme);
    setEditingTargetLevels(theme.targetLevels || []);
    setViewingVocab(null);
  }, []);

  const handleVocabViewClick = useCallback((theme: VocabulaireThemeSummary) => {
    setViewingVocab(theme);
    setVocabEditorMode(null);
  }, []);

  const handleVocabDeleteClick = useCallback(
    async (theme: VocabulaireThemeSummary) => {
      if (!confirm(`Supprimer la liste "${theme.name}" et tous ses mots ? Cette action est irréversible.`)) return;
      try {
        await deleteTheme(theme.id);
        if (vocabEditorMode && typeof vocabEditorMode === 'object' && vocabEditorMode.id === theme.id) {
          setVocabEditorMode(null);
        }
        setMessage({ text: `Liste "${theme.name}" supprimée`, type: 'success' });
      } catch (err) {
        setMessage({
          text: err instanceof Error ? err.message : 'Erreur lors de la suppression',
          type: 'error',
        });
      }
    },
    [deleteTheme, vocabEditorMode]
  );

  const handleVocabDuplicateClick = useCallback(
    async (theme: VocabulaireThemeSummary) => {
      try {
        await duplicateTheme(theme);
        setMessage({ text: `Liste "${theme.name}" dupliquée dans vos listes !`, type: 'success' });
      } catch (err) {
        setMessage({
          text: err instanceof Error ? err.message : 'Erreur lors de la duplication',
          type: 'error',
        });
      }
    },
    [duplicateTheme]
  );

  const handleWordChange = useCallback((index: number, field: keyof VocabulaireWord, value: string) => {
    setEditingWords((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    setVocabDirty(true);
  }, []);

  const handleAddWord = useCallback(() => {
    setNewWord({ word: '', definition: '', example: '', synonyms: '', antonyms: '', wordFamily: '' });
    setShowAddWordModal(true);
  }, []);

  const handleConfirmAddWord = useCallback(() => {
    if (!newWord.word.trim()) return;
    setEditingWords((prev) => [...prev, { ...newWord }]);
    setVocabDirty(true);
    setShowAddWordModal(false);
  }, [newWord]);

  const handleAiSuggest = useCallback(async () => {
    if (!vocabEditorMode || typeof vocabEditorMode !== 'object') return;
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
          themeName: vocabEditorMode.name,
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
        setMessage({ text: json.message || 'Erreur lors de la génération', type: 'error' });
      }
    } catch {
      setMessage({ text: 'Erreur lors de la génération IA', type: 'error' });
    } finally {
      setAiLoading(false);
    }
  }, [vocabEditorMode, editingWords, getAuthHeaders]);

  const handleToggleAiWord = useCallback((word: string) => {
    setAiSelectedWords((prev) => {
      const next = new Set(prev);
      if (next.has(word)) next.delete(word);
      else next.add(word);
      return next;
    });
  }, []);

  const handleImportAiWords = useCallback(async () => {
    if (aiSelectedWords.size === 0) return;
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
        setVocabDirty(true);
        setShowAiSuggestions(false);
        setAiSuggestions([]);
        setAiSelectedWords(new Set());
        setMessage({
          text: `${enrichedWords.length} mot${enrichedWords.length > 1 ? 's' : ''} importé${enrichedWords.length > 1 ? 's' : ''} et enrichi${enrichedWords.length > 1 ? 's' : ''} !`,
          type: 'success',
        });
      } else {
        setMessage({ text: json.message || 'Erreur lors de l\'enrichissement', type: 'error' });
      }
    } catch {
      setMessage({ text: 'Erreur lors de l\'enrichissement IA', type: 'error' });
    } finally {
      setAiEnriching(false);
    }
  }, [aiSelectedWords, getAuthHeaders]);

  const handleRemoveWord = useCallback((index: number) => {
    setEditingWords((prev) => prev.filter((_, i) => i !== index));
    setVocabDirty(true);
  }, []);

  const handleSaveWords = useCallback(async () => {
    if (!editingThemeId) return;
    setVocabSaving(true);
    try {
      const cleaned = editingWords.filter((w) => w.word.trim());
      await updateWords(editingThemeId, cleaned);
      setVocabDirty(false);
      setMessage({ text: 'Liste sauvegardée !', type: 'success' });
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : 'Erreur lors de la sauvegarde',
        type: 'error',
      });
    } finally {
      setVocabSaving(false);
    }
  }, [editingThemeId, editingWords, updateWords]);

  const handleVocabEditorClose = useCallback(() => {
    if (vocabDirty && !confirm('Vous avez des modifications non sauvegard��es. Fermer quand même ?')) return;
    setVocabEditorMode(null);
    setEditingWords([]);
    setVocabDirty(false);
  }, [vocabDirty]);

  const handleVocabViewerClose = useCallback(() => {
    setViewingVocab(null);
    setEditingWords([]);
  }, []);

  if (authLoading && !isAuthenticated) return null;

  // Nom du theme en cours d'edition/visualisation
  const activeThemeName = vocabEditorMode && typeof vocabEditorMode === 'object'
    ? vocabEditorMode.name
    : viewingVocab?.name || '';
  const isViewOnly = !!viewingVocab;

  return (
    <div className={`${styles.pageWrapper} ${isReady ? styles.ready : ''}`}>
      <Header variant="prof" />

      <main className={styles.mainContent}>
        <MessageBox
          message={message?.text || null}
          type={message?.type || 'success'}
          onDismiss={() => setMessage(null)}
        />

        {/* Titre de la page */}
        <h1 className={styles.pageTitle}>Mes Ressources</h1>

        {/* Onglets */}
        <div className={styles.tabBar}>
          <button
            className={`${styles.tabButton} ${activeTab === 'grilles' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('grilles')}
          >
            Grilles d&apos;évaluation
          </button>
          <button
            className={`${styles.tabButton} ${activeTab === 'vocabulaire' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('vocabulaire')}
          >
            Listes de vocabulaire
          </button>
        </div>

        {/* ===== TAB GRILLES ===== */}
        {activeTab === 'grilles' && (
          <>
            {viewingGrille && (
              <section className={styles.builderSection}>
                <GrilleViewer
                  grille={viewingGrille}
                  onClose={() => setViewingGrille(null)}
                />
              </section>
            )}

            {builderMode !== null && (
              <section className={styles.builderSection}>
                <GrilleBuilder
                  grille={builderMode === 'create' ? null : builderMode}
                  onSave={handleBuilderSave}
                  onCancel={handleBuilderCancel}
                  isSaving={isSaving}
                />
              </section>
            )}

            {/* Mes grilles */}
            <section className={styles.grillesSection}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Mes grilles d&apos;évaluation</h2>
                <p className={styles.sectionSubtitle}>
                  Créez et gérez vos grilles de correction
                </p>
              </div>

              <div className={styles.grillesGrid}>
                {grillesLoading ? (
                  <EmptyState icon="hourglass" message="Chargement..." />
                ) : (
                  <>
                    <CreateGrilleCard onClick={handleCreateClick} />
                    {grilles.map((grille) => (
                      <GrilleCard
                        key={grille.id}
                        grille={grille}
                        onEdit={handleEditClick}
                        onDelete={handleDeleteClick}
                        onDuplicate={handleDuplicateClick}
                        onToggleShared={handleToggleShared}
                        isAdmin={userIsAdmin}
                      />
                    ))}
                  </>
                )}
              </div>
            </section>

            {/* Grilles des autres professeurs */}
            {(sharedGrilles.length > 0 || otherProfsGrilles.length > 0) && (
              <section className={styles.grillesSection}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Grilles des professeurs</h2>
                  <p className={styles.sectionSubtitle}>
                    Parcourez les grilles de vos collègues — dupliquez-les pour les adapter
                  </p>
                </div>

                <div className={styles.grillesGrid}>
                  {[...sharedGrilles, ...otherProfsGrilles].map((grille) => (
                    <GrilleCard
                      key={grille.id}
                      grille={grille}
                      onDuplicate={handleDuplicateClick}
                      onView={(g) => { setViewingGrille(g); setBuilderMode(null); }}
                      readOnly
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* ===== TAB VOCABULAIRE ===== */}
        {activeTab === 'vocabulaire' && (
          <>
            {/* Editeur / Viewer de liste (apparait au-dessus des cards) */}
            {(vocabEditorMode === 'create') && (
              <section className={styles.builderSection}>
                <div className={styles.vocabEditor}>
                  <div className={styles.vocabEditorHeader}>
                    <h3 className={styles.vocabEditorTitle}>Nouvelle liste de vocabulaire</h3>
                    <button className={styles.vocabEditorClose} onClick={() => setVocabEditorMode(null)}>
                      ✕
                    </button>
                  </div>
                  <div className={styles.vocabCreateRow}>
                    <input
                      className={styles.vocabCreateInput}
                      type="text"
                      placeholder="Nom de la liste (ex : champ lexical de la nature)..."
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleVocabCreateConfirm()}
                      autoFocus
                    />
                    <button
                      className={styles.vocabCreateBtn}
                      onClick={handleVocabCreateConfirm}
                      disabled={!newListName.trim()}
                    >
                      Créer la liste
                    </button>
                  </div>
                </div>
              </section>
            )}

            {((vocabEditorMode && typeof vocabEditorMode === 'object') || viewingVocab) && (
              <section className={styles.builderSection}>
                <div className={styles.vocabEditor}>
                  <div className={styles.vocabEditorHeader}>
                    <h3 className={styles.vocabEditorTitle}>
                      {isViewOnly ? '' : ''}{activeThemeName.charAt(0).toUpperCase() + activeThemeName.slice(1)}
                      {isViewOnly && <span className={styles.vocabReadOnlyBadge}>lecture seule</span>}
                    </h3>
                    <button
                      className={styles.vocabEditorClose}
                      onClick={isViewOnly ? handleVocabViewerClose : handleVocabEditorClose}
                    >
                      ✕
                    </button>
                  </div>

                  {/* Eleves cibles */}
                  {!isViewOnly && (
                    <div className={styles.vocabTargetLevels}>
                      <label className={styles.vocabTargetLabel}>Élèves ciblés :</label>
                      <div className={styles.vocabTargetChips}>
                        {['1', '2', '3', '4', '5', '6', 'daspa'].map((level) => {
                          const active = editingTargetLevels.includes(level);
                          return (
                            <button
                              key={level}
                              type="button"
                              className={`${styles.vocabTargetChip} ${active ? styles.vocabTargetChipActive : ''}`}
                              onClick={() => {
                                const updated = active
                                  ? editingTargetLevels.filter((l) => l !== level)
                                  : [...editingTargetLevels, level];
                                setEditingTargetLevels(updated);
                                if (vocabEditorMode && typeof vocabEditorMode === 'object') {
                                  updateThemeMeta(vocabEditorMode.id, { targetLevels: updated });
                                }
                              }}
                            >
                              {level}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {vocabWordsLoading ? (
                    <EmptyState icon="hourglass" message="Chargement des mots..." />
                  ) : (
                    <>
                      {!isViewOnly && (
                        <div className={styles.vocabTableActions}>
                          <button className={styles.vocabAddWordBtn} onClick={handleAddWord}>
                            + Ajouter un mot
                          </button>
                          <button
                            className={styles.vocabAiBtn}
                            onClick={handleAiSuggest}
                            disabled={aiLoading}
                          >
                            {aiLoading ? 'Génération...' : '✨ Créer avec l\'IA'}
                          </button>
                          {vocabDirty && (
                            <button
                              className={styles.vocabSaveBtn}
                              onClick={handleSaveWords}
                              disabled={vocabSaving}
                            >
                              {vocabSaving ? 'Sauvegarde...' : 'Sauvegarder les modifications'}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Panneau suggestions IA */}
                      {showAiSuggestions && (
                        <div className={styles.aiPanel}>
                          <div className={styles.aiPanelHeader}>
                            <h4 className={styles.aiPanelTitle}>
                              Suggestions de l&apos;IA pour &laquo;&nbsp;{activeThemeName}&nbsp;&raquo;
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
                              {!isViewOnly && <th className={styles.vocabThActions}></th>}
                            </tr>
                          </thead>
                          <tbody>
                            {editingWords.length === 0 ? (
                              <tr>
                                <td colSpan={isViewOnly ? 6 : 7} className={styles.vocabEmptyRow}>
                                  {isViewOnly ? 'Cette liste est vide.' : 'Aucun mot — cliquez sur « Ajouter un mot » pour commencer.'}
                                </td>
                              </tr>
                            ) : editingWords.map((word, idx) => (
                              <tr key={idx}>
                                <td>
                                  {isViewOnly ? (
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
                                  {isViewOnly ? (
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
                                  {isViewOnly ? (
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
                                  {isViewOnly ? (
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
                                  {isViewOnly ? (
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
                                  {isViewOnly ? (
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
                                {!isViewOnly && (
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
                </div>
              </section>
            )}

            {/* Mes listes de vocabulaire */}
            <section className={styles.grillesSection}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Mes listes de vocabulaire</h2>
                <p className={styles.sectionSubtitle}>
                  Créez et gérez vos séries lexicales
                </p>
              </div>

              <div className={styles.grillesGrid}>
                {vocabThemesLoading ? (
                  <EmptyState icon="hourglass" message="Chargement..." />
                ) : (
                  <>
                    <CreateVocabCard onClick={handleVocabCreateClick} />
                    {myThemes.map((theme) => (
                      <VocabCard
                        key={theme.id}
                        theme={theme}
                        onEdit={handleVocabEditClick}
                        onDelete={handleVocabDeleteClick}
                        onDuplicate={handleVocabDuplicateClick}
                      />
                    ))}
                  </>
                )}
              </div>
            </section>

            {/* Listes des autres professeurs */}
            {otherThemes.length > 0 && (
              <section className={styles.grillesSection}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Listes des professeurs</h2>
                  <p className={styles.sectionSubtitle}>
                    Parcourez les listes de vos collègues — dupliquez-les pour les adapter
                  </p>
                </div>

                <div className={styles.grillesGrid}>
                  {otherThemes.map((theme) => (
                    <VocabCard
                      key={theme.id}
                      theme={theme}
                      onDuplicate={handleVocabDuplicateClick}
                      onView={handleVocabViewClick}
                      readOnly
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

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

      <Footer />
    </div>
  );
}
