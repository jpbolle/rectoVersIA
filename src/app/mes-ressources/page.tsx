'use client';

// Page élève « Mes ressources personnelles » — pendant élève de la page
// Mes Ressources du prof. Onglet 1 : liste de vocabulaire personnelle (mots
// dont l'élève a demandé la définition, app ou NavigKid). Onglet 2 : à venir.

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import EmptyState from '@/components/EmptyState/EmptyState';
import styles from './mes-ressources.module.css';

type Tab = 'vocabulaire' | 'avenir';

interface PersoWord {
  word: string;
  definition: string;
  addedAt: string | null;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function MesRessourcesPage() {
  const { isAuthenticated, isLoading: authLoading, role, getAuthHeaders } = useAuth();
  const router = useRouter();

  const [isReady, setIsReady] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('vocabulaire');
  const [words, setWords] = useState<PersoWord[] | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (redirecting) return;
    if (authLoading && !isAuthenticated) return;
    if (!isAuthenticated) {
      setRedirecting(true);
      router.replace('/login');
    } else if (role === 'prof') {
      setRedirecting(true);
      router.replace('/grilles');
    }
  }, [isAuthenticated, authLoading, role, redirecting, router]);

  // Charge la liste personnelle
  useEffect(() => {
    if (!isAuthenticated || role === 'prof') return;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const res = await fetch('/api/vocabulaire/personnel', { headers });
        const json = await res.json();
        const raw: Array<{ word?: string; definition?: string; addedAt?: string }> =
          json.success ? json.data?.words || [] : [];
        setWords(
          raw
            .filter((w) => w.word)
            .map((w) => ({
              word: w.word!,
              definition: w.definition || '',
              addedAt: w.addedAt || null,
            }))
            .sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''))
        );
      } catch {
        setWords([]);
      }
    })();
  }, [isAuthenticated, role, getAuthHeaders]);

  if (redirecting) return null;

  return (
    <div className={`${styles.pageWrapper} ${isReady ? styles.ready : ''}`}>
      <Header variant="student" />

      <main className={styles.mainContent}>
        <h1 className={styles.pageTitle}>Mes ressources personnelles</h1>

        <div className={styles.tabBar}>
          <button
            className={`${styles.tabButton} ${activeTab === 'vocabulaire' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('vocabulaire')}
          >
            Liste de vocabulaire
          </button>
          <button
            className={`${styles.tabButton} ${activeTab === 'avenir' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('avenir')}
          >
            À venir
          </button>
        </div>

        {activeTab === 'vocabulaire' && (
          <section className={styles.section}>
            {words === null ? (
              <EmptyState icon="hourglass" message="En cours de chargement" />
            ) : words.length === 0 ? (
              <EmptyState
                icon="📖"
                message="Aucun mot pour le moment. Les mots dont tu demandes la définition (dans l'app ou avec NavigKid) apparaîtront ici."
              />
            ) : (
              <>
                <div className={styles.persoNote}>
                  Les mots dont tu as demandé la définition, dans l&apos;app ou avec NavigKid.
                </div>
                {words.map((w) => (
                  <div key={w.word} className={styles.persoItem}>
                    <span className={styles.persoWord}>{w.word}</span>
                    <span className={styles.persoDef}>{w.definition}</span>
                    {w.addedAt && <span className={styles.persoDate}>{formatDate(w.addedAt)}</span>}
                  </div>
                ))}
              </>
            )}
          </section>
        )}

        {activeTab === 'avenir' && (
          <section className={styles.section}>
            <EmptyState icon="🕓" message="Rien ici pour le moment." />
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
