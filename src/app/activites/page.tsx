'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useDevoirs } from '@/hooks/useDevoirs';
import { useStudentClasses } from '@/hooks/useStudentClasses';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import DevoirCard from '@/components/DevoirCard/DevoirCard';
import EmptyState from '@/components/EmptyState/EmptyState';
import styles from './activites.module.css';

export default function ActivitesPage() {
  const { isAuthenticated, isLoading: authLoading, role, getAuthHeaders } = useAuth();
  const router = useRouter();
  const { devoirs, isLoading: devoirsLoading } = useDevoirs();
  const { classes, isLoading: classesLoading } = useStudentClasses();

  const [isReady, setIsReady] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  // devoirId → visibleParEleve pour les corrections individuelles
  const [correctionVisibility, setCorrectionVisibility] = useState<Record<string, boolean>>({});

  // Mode prévisualisation pour les profs
  const isPreviewMode = role === 'prof';

  // Charger la visibilité des corrections individuelles (élève seulement)
  useEffect(() => {
    if (role !== 'eleve' || !isAuthenticated) return;
    getAuthHeaders().then((headers) => {
      if (!headers) return;
      fetch('/api/corrections/mine', { headers })
        .then((r) => r.json())
        .then((json) => {
          if (json.success) {
            const map: Record<string, boolean> = {};
            for (const item of json.data) {
              map[item.devoirId] = item.visibleParEleve;
            }
            setCorrectionVisibility(map);
          }
        })
        .catch(() => {});
    });
  }, [role, isAuthenticated, getAuthHeaders]);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if ((authLoading && !isAuthenticated) || redirecting) return;
    if (!isAuthenticated) {
      setRedirecting(true);
      router.replace('/login');
      return;
    }
    // Élève sans classe → renvoyer vers login pour rejoindre une classe
    if (role === 'eleve' && !classesLoading && classes.length === 0) {
      setRedirecting(true);
      router.replace('/login');
    }
  }, [isAuthenticated, authLoading, role, classes, classesLoading, router, redirecting]);


  if ((authLoading && !isAuthenticated) || redirecting || (role === 'eleve' && classesLoading)) return null;

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
        {devoirsLoading ? (
          <section className={styles.activitesSection}>
            <EmptyState icon="hourglass" message="Chargement..." />
          </section>
        ) : (() => {
          const estCorrige = (d: { id: string; corrigeDisponible: boolean }) =>
            d.corrigeDisponible || correctionVisibility[d.id] === true;
          const actives = devoirs.filter((d) => !estCorrige(d));
          const corrigees = devoirs.filter((d) => estCorrige(d));
          return (
            <>
              <section className={styles.activitesSection}>
                <h3 className={styles.sectionTitle}>Mes Activités</h3>
                <div className={styles.activitesGrid}>
                  {actives.length === 0 ? (
                    <EmptyState
                      icon="clipboard"
                      message="Aucune activité n'est disponible pour le moment."
                    />
                  ) : (
                    actives.map((devoir) => (
                      <DevoirCard
                        key={devoir.id}
                        devoir={devoir}
                        variant="student"
                      />
                    ))
                  )}
                </div>
              </section>

              {corrigees.length > 0 && (
                <section className={`${styles.activitesSection} ${styles.corrigeesSection}`}>
                  <h3 className={styles.sectionTitle}>Travaux corrigés</h3>
                  <div className={styles.activitesGrid}>
                    {corrigees.map((devoir) => (
                      <DevoirCard
                        key={devoir.id}
                        devoir={devoir}
                        variant="student"
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          );
        })()}
      </main>

      <Footer version="2.0" />
    </div>
  );
}
