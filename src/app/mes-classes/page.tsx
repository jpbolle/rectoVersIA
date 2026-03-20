'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useStudentClasses } from '@/hooks/useStudentClasses';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import StudentClasseCard from '@/components/StudentClasseCard/StudentClasseCard';
import JoinClasseModal from '@/components/JoinClasseModal/JoinClasseModal';
import EmptyState from '@/components/EmptyState/EmptyState';
import styles from './mes-classes.module.css';

export default function MesClassesPage() {
  const { isAuthenticated, isLoading: authLoading, role } = useAuth();
  const router = useRouter();
  const { classes, isLoading, joinClasse } = useStudentClasses();
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (authLoading && !isAuthenticated) return;
    if (!isAuthenticated) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  if (!isAuthenticated) return null;

  const handleJoin = async (code: string, nom: string, prenom: string) => {
    return await joinClasse(code, nom, prenom);
  };

  return (
    <div className={`${styles.pageWrapper} ${isReady ? styles.ready : ''}`}>
      <Header variant={role === 'prof' ? 'prof' : 'student'} />

      <main className={styles.mainContent}>
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Mes Classes</h2>
            <button className={styles.joinBtn} onClick={() => setShowJoinModal(true)}>
              + Rejoindre une classe
            </button>
          </div>

          <div className={styles.grid}>
            {isLoading ? (
              <EmptyState icon="hourglass" message="Chargement..." />
            ) : classes.length === 0 ? (
              <EmptyState
                icon="school"
                message="Tu n'as rejoint aucune classe. Clique sur « Rejoindre une classe » et entre le code donné par ton professeur."
              />
            ) : (
              classes.map((c) => (
                <StudentClasseCard
                  key={c.id}
                  nom={c.nom}
                  description={c.description}
                  anneeScolaire={c.anneeScolaire}
                />
              ))
            )}
          </div>
        </section>
      </main>

      <Footer />

      {showJoinModal && (
        <JoinClasseModal
          onClose={() => setShowJoinModal(false)}
          onJoin={handleJoin}
        />
      )}
    </div>
  );
}
