'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useGrilles } from '@/hooks/useGrilles';
import { useVocabulaireThemes, type VocabulaireThemeSummary } from '@/hooks/useVocabulaireThemes';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import GrilleCard from '@/components/GrilleCard/GrilleCard';
import CreateGrilleCard from '@/components/CreateGrilleCard/CreateGrilleCard';
import GrilleBuilder from '@/components/GrilleBuilder/GrilleBuilder';
import ScenarisationPanel from '@/components/ScenarisationPanel/ScenarisationPanel';
import OeuvrePanel from '@/components/OeuvrePanel/OeuvrePanel';
import GrilleViewer from '@/components/GrilleViewer/GrilleViewer';
import VocabCard from '@/components/VocabCard/VocabCard';
import CreateVocabCard from '@/components/CreateVocabCard/CreateVocabCard';
import VocabListEditor from '@/components/VocabListEditor/VocabListEditor';
import MessageBox from '@/components/MessageBox/MessageBox';
import EmptyState from '@/components/EmptyState/EmptyState';
import type { Grille, GrilleCriterion } from '@/types/grille';
import styles from './grilles.module.css';

type Tab = 'grilles' | 'vocabulaire' | 'oeuvres' | 'scenarisation';

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

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (authLoading && !isAuthenticated) return;
    if (!isAuthenticated) {
      router.replace('/login');
    } else if (role !== 'prof') {
      router.replace('/accueil');
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
          ateliers: grille.ateliers,
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
    async (data: {
      name: string;
      description: string;
      uaa: number[];
      ateliers: string[];
      criteria: GrilleCriterion[];
    }) => {
      setIsSaving(true);
      try {
        if (builderMode === 'create') {
          await createGrille({
            name: data.name,
            description: data.description,
            uaa: data.uaa,
            ateliers: data.ateliers,
            criteria: data.criteria,
          });
          setMessage({ text: `Grille "${data.name}" créée avec succès !`, type: 'success' });
        } else if (builderMode && typeof builderMode === 'object') {
          await updateGrille(builderMode.id, {
            name: data.name,
            description: data.description,
            uaa: data.uaa,
            ateliers: data.ateliers,
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
  }, []);

  const handleVocabEditClick = useCallback((theme: VocabulaireThemeSummary) => {
    setVocabEditorMode(theme);
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

  if (authLoading && !isAuthenticated) return null;

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
          <button
            className={`${styles.tabButton} ${activeTab === 'oeuvres' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('oeuvres')}
          >
            Bibliothèque d&apos;œuvres
          </button>
          <button
            className={`${styles.tabButton} ${activeTab === 'scenarisation' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('scenarisation')}
          >
            Design &amp; scénarisation didactique
          </button>
        </div>

        {/* ===== TAB BIBLIOTHÈQUE D'ŒUVRES ===== */}
        {activeTab === 'oeuvres' && <OeuvrePanel />}

        {/* ===== TAB SCÉNARISATION ===== */}
        {activeTab === 'scenarisation' && <ScenarisationPanel />}

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
                  <EmptyState icon="hourglass" message="En cours de chargement" />
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
            {vocabEditorMode === 'create' && (
              <section className={styles.builderSection}>
                <VocabListEditor
                  mode="create"
                  createTheme={createTheme}
                  updateWords={updateWords}
                  updateThemeMeta={updateThemeMeta}
                  getAuthHeaders={getAuthHeaders}
                  onClose={() => setVocabEditorMode(null)}
                  onCreated={(theme) => setVocabEditorMode(theme)}
                  onMessage={(text, type) => setMessage({ text, type })}
                />
              </section>
            )}

            {vocabEditorMode !== null && vocabEditorMode !== 'create' && (
              <section className={styles.builderSection}>
                <VocabListEditor
                  mode={vocabEditorMode}
                  createTheme={createTheme}
                  updateWords={updateWords}
                  updateThemeMeta={updateThemeMeta}
                  getAuthHeaders={getAuthHeaders}
                  onClose={() => setVocabEditorMode(null)}
                  onMessage={(text, type) => setMessage({ text, type })}
                />
              </section>
            )}

            {viewingVocab && (
              <section className={styles.builderSection}>
                <VocabListEditor
                  mode={viewingVocab}
                  readOnly
                  createTheme={createTheme}
                  updateWords={updateWords}
                  getAuthHeaders={getAuthHeaders}
                  onClose={() => setViewingVocab(null)}
                  onMessage={(text, type) => setMessage({ text, type })}
                />
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
                  <EmptyState icon="hourglass" message="En cours de chargement" />
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


      <Footer />
    </div>
  );
}
