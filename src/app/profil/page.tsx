'use client';

// Page « Mon Profil » de l'élève : coquille (header, garde d'accès) autour du
// panneau ProfilPanel, partagé avec la fiche élève consultée par le prof
// (popup des pages Mes Classes).

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useStudentClasses } from '@/hooks/useStudentClasses';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import ProfilPanel from '@/components/ProfilPanel/ProfilPanel';
import styles from './profil.module.css';

export default function ProfilPage() {
  const { isAuthenticated, isLoading: authLoading, role } = useAuth();
  const router = useRouter();
  const { classes, isLoading: classesLoading } = useStudentClasses();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (authLoading && !isAuthenticated) return;
    if (!isAuthenticated) { router.replace('/login'); return; }
    if (role === 'eleve' && !classesLoading && classes.length === 0) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, role, classes, classesLoading, router]);

  // Guard après tous les hooks
  if (!isAuthenticated || (role === 'eleve' && classesLoading)) return null;

  return (
    <div className={`${styles.pageWrapper} ${isReady ? styles.ready : ''}`}>
      <Header variant={role === 'prof' ? 'prof' : 'student'} />

      <main className={styles.main}>
        <h1 className={styles.pageTitle}>Mon profil d&apos;écrilecteur</h1>
        <p className={styles.pageSubtitle}>
          Tes résultats agrégés sur toutes les évaluations corrigées
        </p>

        <ProfilPanel />
      </main>

      <Footer />
    </div>
  );
}
