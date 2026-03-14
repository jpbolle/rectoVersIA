'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useGrilles } from '@/hooks/useGrilles';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import GrilleCard from '@/components/GrilleCard/GrilleCard';
import CreateGrilleCard from '@/components/CreateGrilleCard/CreateGrilleCard';
import GrilleBuilder from '@/components/GrilleBuilder/GrilleBuilder';
import MessageBox from '@/components/MessageBox/MessageBox';
import EmptyState from '@/components/EmptyState/EmptyState';
import type { Grille, GrilleCriterion } from '@/types/grille';
import styles from './grilles.module.css';

export default function GrillesPage() {
  const { isAuthenticated, isLoading: authLoading, role } = useAuth();
  const router = useRouter();
  const {
    grilles,
    isLoading: grillesLoading,
    createGrille,
    updateGrille,
    deleteGrille,
  } = useGrilles();

  const [isReady, setIsReady] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Mode builder : 'create' | Grille (edition) | null (ferme)
  const [builderMode, setBuilderMode] = useState<'create' | Grille | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
    } else if (role !== 'prof') {
      router.replace('/activites');
    }
  }, [isAuthenticated, authLoading, role, router]);

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
        setMessage({ text: `Grille "${grille.name}" dupliquée avec succès !`, type: 'success' });
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

  if (authLoading) return null;

  return (
    <div className={`${styles.pageWrapper} ${isReady ? styles.ready : ''}`}>
      <Header variant="prof" />

      <main className={styles.mainContent}>
        <MessageBox
          message={message?.text || null}
          type={message?.type || 'success'}
          onDismiss={() => setMessage(null)}
        />

        <section className={styles.grillesSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Mes Grilles d&apos;évaluation</h2>
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
                  />
                ))}
              </>
            )}
          </div>
        </section>

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
      </main>

      <Footer />
    </div>
  );
}
