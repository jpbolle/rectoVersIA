'use client';

// « Mes ressources personnelles » de l'espace FLE (JP, 2026-10-08, soir) :
// onglet « Mon vocabulaire » — les mots cliqués dans l'extension Daspalecte,
// avec leur traduction, rangés à part des mots de l'espace classique
// (`vocabulaireFle`, servi par /api/fle/vocabulaire).

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { aUneClasseFle, useStudentClasses } from '@/hooks/useStudentClasses';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import EmptyState from '@/components/EmptyState/EmptyState';
import { langueLabel } from '@/types/niveaux-fle';
import type { MotPersonnel } from '@/lib/daspalecte/mots';
import styles from '../../mes-ressources/mes-ressources.module.css';

function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function RessourcesFleElevePage() {
  const { isAuthenticated, isLoading: authLoading, role, getAuthHeaders } = useAuth();
  const router = useRouter();
  const { classes, isLoading: classesLoading } = useStudentClasses();
  const [words, setWords] = useState<MotPersonnel[] | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if ((authLoading && !isAuthenticated) || redirecting) return;
    if (!isAuthenticated) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- garde de redirection imposée par AGENTS.md (state `redirecting`)
      setRedirecting(true);
      router.replace('/login');
      return;
    }
    if (role === 'prof') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- garde de redirection imposée par AGENTS.md (state `redirecting`)
      setRedirecting(true);
      router.replace('/dashboard');
      return;
    }
    if (role === 'eleve' && !classesLoading && !aUneClasseFle(classes)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- garde de redirection imposée par AGENTS.md (state `redirecting`)
      setRedirecting(true);
      router.replace('/mes-ressources');
    }
  }, [isAuthenticated, authLoading, role, classes, classesLoading, router, redirecting]);

  useEffect(() => {
    if (!isAuthenticated || role !== 'eleve') return;
    let annule = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const res = await fetch('/api/fle/vocabulaire', { headers });
        const json = await res.json();
        if (!annule) setWords(json.success ? (json.data.words as MotPersonnel[]) : []);
      } catch {
        if (!annule) setWords([]);
      }
    })();
    return () => {
      annule = true;
    };
  }, [isAuthenticated, role, getAuthHeaders]);

  if ((authLoading && !isAuthenticated) || redirecting) return null;

  return (
    <div className={`${styles.pageWrapper} ${isReady ? styles.ready : ''}`}>
      <Header variant="fle" />

      <main className={styles.mainContent}>
        <h1 className={styles.pageTitle}>Mes ressources personnelles</h1>

        <div className={styles.tabBar}>
          <button className={`${styles.tabButton} ${styles.tabActive}`} type="button">
            Mon vocabulaire
          </button>
        </div>

        <section className={styles.section}>
          {words === null ? (
            <EmptyState icon="hourglass" message="En cours de chargement" />
          ) : words.length === 0 ? (
            <EmptyState icon="📖" message="Aucun mot pour le moment. Les mots que tu cliques avec Daspalecte apparaîtront ici, avec leur traduction." />
          ) : (
            <>
              <div className={styles.persoNote}>Les mots que tu as cliqués avec Daspalecte, avec leur traduction.</div>
              {words.map((w) => (
                <div key={w.word} className={styles.persoItem}>
                  <span className={styles.persoWord}>{w.word}</span>
                  <span className={styles.persoDef}>
                    {w.traduction && (
                      <span className={styles.persoTrad}>
                        {w.traduction}
                        {w.langue ? ` (${langueLabel(w.langue)})` : ''}
                      </span>
                    )}
                    {w.definition || ''}
                    {w.clics ? ` · ${w.clics} clic${w.clics > 1 ? 's' : ''}` : ''}
                  </span>
                  <span className={styles.persoDate}>{formatDate(w.lastSeenAt || w.addedAt)}</span>
                </div>
              ))}
            </>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
