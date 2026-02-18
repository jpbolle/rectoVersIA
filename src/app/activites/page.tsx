'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useDevoirs } from '@/hooks/useDevoirs';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import DevoirCard from '@/components/DevoirCard/DevoirCard';
import EmptyState from '@/components/EmptyState/EmptyState';
import styles from './activites.module.css';

export default function ActivitesPage() {
  const { isAuthenticated, isLoading: authLoading, role } = useAuth();
  const router = useRouter();
  const { devoirs, isLoading: devoirsLoading } = useDevoirs();

  const [isReady, setIsReady] = useState(false);

  // Mode prévisualisation pour les profs
  const isPreviewMode = role === 'prof';

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
    }
    // Ne plus rediriger les profs - ils peuvent voir la vue élève
  }, [isAuthenticated, authLoading, router]);


  if (authLoading) return null;

  return (
    <div className={`${styles.pageWrapper} ${isReady ? styles.ready : ''} ${isPreviewMode ? styles.previewMode : ''}`}>
      {isPreviewMode && (
        <div className={styles.previewBanner}>
          <span>👁️ Mode prévisualisation élève</span>
          <button
            className={styles.backButton}
            onClick={() => router.push('/dashboard')}
          >
            Retour au tableau de bord
          </button>
        </div>
      )}

      <Header variant="student" topOffset={isPreviewMode ? 44 : 0} />

      <main className={styles.mainContent}>
        <section className={styles.activitesSection}>
          <h3 className={styles.sectionTitle}>Mes Activités</h3>
          <div className={styles.activitesGrid}>
            {devoirsLoading ? (
              <EmptyState icon="hourglass" message="Chargement..." />
            ) : devoirs.length === 0 ? (
              <EmptyState
                icon="clipboard"
                message="Aucune activité n'est disponible pour le moment."
              />
            ) : (
              devoirs.map((devoir) => (
                <DevoirCard
                  key={devoir.id}
                  devoir={devoir}
                  variant="student"
                />
              ))
            )}
          </div>
        </section>
      </main>

      <Footer version="2.0" />
    </div>
  );
}
