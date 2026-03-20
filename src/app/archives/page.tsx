'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useDevoirs } from '@/hooks/useDevoirs';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import DevoirCard from '@/components/DevoirCard/DevoirCard';
import MessageBox from '@/components/MessageBox/MessageBox';
import EmptyState from '@/components/EmptyState/EmptyState';
import type { Devoir } from '@/types/devoir';
import styles from './archives.module.css';

export default function ArchivesPage() {
  const { isAuthenticated, isLoading: authLoading, role } = useAuth();
  const router = useRouter();
  const {
    devoirs,
    isLoading: devoirsLoading,
    toggleDisponible,
    toggleArchive,
  } = useDevoirs();

  const [isReady, setIsReady] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Filtrer les devoirs archives
  const archivedDevoirs = devoirs.filter((d) => d.archive);

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

  const handleToggleDisponible = useCallback(
    async (id: string, disponible: boolean) => {
      try {
        await toggleDisponible(id, disponible);
      } catch (err) {
        setMessage({
          text: err instanceof Error ? err.message : 'Erreur lors de la mise a jour',
          type: 'error',
        });
      }
    },
    [toggleDisponible]
  );

  const handleToggleArchive = useCallback(
    async (id: string, archive: boolean) => {
      try {
        await toggleArchive(id, archive);
        if (!archive) {
          setMessage({ text: 'Devoir restauré', type: 'success' });
        }
      } catch (err) {
        setMessage({
          text: err instanceof Error ? err.message : 'Erreur lors de la restauration',
          type: 'error',
        });
      }
    },
    [toggleArchive]
  );

  const handleEditDevoir = useCallback((devoir: Devoir) => {
    // Pas d'edition depuis les archives
  }, []);

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

        <section className={styles.archivesSection}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>Activités archivées</h3>
            <p className={styles.sectionSubtitle}>
              Désactivez le toggle &quot;Archiver&quot; pour restaurer un devoir
            </p>
          </div>

          <div className={styles.archivesGrid}>
            {devoirsLoading ? (
              <EmptyState icon="hourglass" message="Chargement..." />
            ) : archivedDevoirs.length === 0 ? (
              <EmptyState icon="archive" message="Aucun devoir archivé" />
            ) : (
              archivedDevoirs.map((devoir) => (
                <DevoirCard
                  key={devoir.id}
                  devoir={devoir}
                  variant="prof"
                  onEdit={handleEditDevoir}
                  onToggleDisponible={handleToggleDisponible}
                  onToggleArchive={handleToggleArchive}
                />
              ))
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
