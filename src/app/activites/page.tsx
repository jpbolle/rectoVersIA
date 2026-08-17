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
  // devoirId → { status, nonRendu } de son travail (classement corrigés / non rendus)
  const [travauxStatus, setTravauxStatus] = useState<Record<string, { status: string; nonRendu: string | null }> | null>(null);

  // Mode prévisualisation pour les profs
  const isPreviewMode = role === 'prof';

  // Charger la visibilité des corrections individuelles + le statut de remise
  // de ses travaux (élève seulement)
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
      fetch('/api/travaux/status', { headers })
        .then((r) => r.json())
        .then((json) => setTravauxStatus(json.success ? json.data : {}))
        .catch(() => setTravauxStatus({}));
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
        {devoirsLoading || (role === 'eleve' && travauxStatus === null) ? (
          <section className={styles.activitesSection}>
            <EmptyState icon="hourglass" message="En cours de chargement" />
          </section>
        ) : (() => {
          const estCorrige = (d: { id: string; corrigeDisponible: boolean }) =>
            d.corrigeDisponible || correctionVisibility[d.id] === true;
          // « Non rendu » = uniquement si le prof l'a coché sur la copie
          const nonRenduOf = (d: { id: string }) =>
            role === 'eleve' ? travauxStatus?.[d.id]?.nonRendu ?? null : null;
          // Un travail marqué « non rendu » par le prof sort de tous les autres
          // blocs, que l'activité soit corrigée ou non
          const actives = devoirs.filter((d) => !estCorrige(d) && !nonRenduOf(d));
          const corrigees = devoirs.filter((d) => estCorrige(d) && !nonRenduOf(d));
          const nonRendus = devoirs.filter((d) => nonRenduOf(d));
          const excuseLabel = (d: { id: string }) =>
            nonRenduOf(d) === 'justifie'
              ? 'Non rendu — justifié'
              : 'Non fait — note : 0';
          return (
            <>
              <section className={styles.activitesSection}>
                <h3 className={styles.sectionTitle}>Mes Activités</h3>
                <div className={styles.activitesGrid}>
                  {actives.length === 0 ? (
                    <EmptyState
                      icon="📋"
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

              {nonRendus.length > 0 && (
                <section className={`${styles.activitesSection} ${styles.corrigeesSection}`}>
                  <h3 className={styles.sectionTitle}>Travaux non rendus</h3>
                  <div className={styles.activitesGrid}>
                    {nonRendus.map((devoir) => (
                      <div key={devoir.id} className={styles.nonRenduWrap}>
                        {/* Pas de badge « corrigé disponible » : le corrigé est
                            réservé à ceux qui ont rendu le travail */}
                        <DevoirCard
                          devoir={{ ...devoir, corrigeDisponible: false }}
                          variant="student"
                        />
                        <span className={styles.nonRenduBadge}>{excuseLabel(devoir)}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          );
        })()}
      </main>

      <Footer />
    </div>
  );
}
