'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useStudentProfil } from '@/hooks/useStudentProfil';
import { useStudentClasses } from '@/hooks/useStudentClasses';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import EmptyState from '@/components/EmptyState/EmptyState';
import styles from './profil.module.css';

function getProgressClass(score: number) {
  if (score < 40) return styles.progressLow;
  if (score < 65) return styles.progressMedium;
  return styles.progressGood;
}

export default function ProfilPage() {
  const { isAuthenticated, isLoading: authLoading, role } = useAuth();
  const router = useRouter();
  const { profilData, isLoading } = useStudentProfil();
  const { classes, isLoading: classesLoading } = useStudentClasses();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (authLoading && !isAuthenticated) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (role === 'eleve' && !classesLoading && classes.length === 0) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, role, classes, classesLoading, router]);

  if (!isAuthenticated || (role === 'eleve' && classesLoading)) return null;

  return (
    <div className={`${styles.pageWrapper} ${isReady ? styles.ready : ''}`}>
      <Header variant={role === 'prof' ? 'prof' : 'student'} />

      <main className={styles.mainContent}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Mon profil d&apos;écrilecteur</h2>
          <p className={styles.sectionSubtitle}>
            Tes résultats agrégés sur toutes les évaluations corrigées
          </p>

          {isLoading ? (
            <EmptyState icon="hourglass" message="Chargement de ton profil..." />
          ) : !profilData || profilData.totalEvaluations === 0 ? (
            <EmptyState
              icon="chart"
              message="Aucune évaluation disponible pour le moment. Tes résultats apparaîtront ici dès que ton professeur aura corrigé un de tes travaux."
            />
          ) : (
            <>
              <div className={styles.globalBanner}>
                <div className={styles.globalScoreCircle}>
                  {profilData.globalScore}%
                </div>
                <div className={styles.globalInfo}>
                  <p className={styles.globalLabel}>Score global</p>
                  <p className={styles.globalDetail}>
                    Basé sur {profilData.totalEvaluations} évaluation{profilData.totalEvaluations > 1 ? 's' : ''} corrigée{profilData.totalEvaluations > 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              <div className={styles.criteriaGrid}>
                {profilData.criteria.map((crit) => (
                  <div key={crit.name} className={styles.criterionCard}>
                    <h3 className={styles.criterionName}>{crit.name}</h3>
                    <p className={styles.criterionCount}>
                      {crit.count} évaluation{crit.count > 1 ? 's' : ''}
                    </p>

                    <div className={styles.progressBar}>
                      <div
                        className={`${styles.progressFill} ${getProgressClass(crit.averageScore)}`}
                        style={{ width: `${crit.averageScore}%` }}
                      />
                    </div>

                    <p className={styles.criterionScore}>
                      {crit.averageScore}%{' '}
                      <span className={styles.criterionScoreSuffix}>
                        ({crit.averageScore >= 60 ? 'Suffisant' : crit.averageScore >= 35 ? 'Insuffisant' : 'À travailler'})
                      </span>
                    </p>

                    {crit.history.length > 1 && (
                      <div className={styles.historyList}>
                        {crit.history.slice(-5).map((h, i) => (
                          <div key={i} className={styles.historyItem}>
                            <span className={styles.historyName}>{h.devoirName}</span>
                            <span className={styles.historyScore}>{h.score}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
