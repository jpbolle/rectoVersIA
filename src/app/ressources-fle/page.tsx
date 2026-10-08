'use client';

// « Mes ressources FLE » (espace FLE du prof, JP 2026-10-08) : les points de
// théorie et les activités FLE sans classe — ce que les séquences assemblent.
// `?section=theorie|activites` lu au montage.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useEspace } from '@/context/EspaceContext';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import ModuleFlePanel from '@/components/ModuleFlePanel/ModuleFlePanel';
import ActiviteFlePanel from '@/components/ActiviteFlePanel/ActiviteFlePanel';
import styles from '../parcours-fle/parcours-fle.module.css';

type Section = 'theorie' | 'activites';

export default function RessourcesFlePage() {
  const { isAuthenticated, isLoading: authLoading, role } = useAuth();
  const { setEspace } = useEspace();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [section, setSection] = useState<Section>(() => {
    if (typeof window === 'undefined') return 'theorie';
    return new URLSearchParams(window.location.search).get('section') === 'activites' ? 'activites' : 'theorie';
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
      setEspace('fle');
    }, 100);
    return () => clearTimeout(timer);
  }, [setEspace]);

  // Garde de redirection avec le state `redirecting` (gotcha AGENTS.md)
  useEffect(() => {
    if ((authLoading && !isAuthenticated) || redirecting) return;
    if (!isAuthenticated) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- garde de redirection imposée par AGENTS.md (state `redirecting`)
      setRedirecting(true);
      router.replace('/login');
      return;
    }
    if (!role) return;
    if (role !== 'prof') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- garde de redirection imposée par AGENTS.md (state `redirecting`)
      setRedirecting(true);
      router.replace('/accueil');
    }
  }, [isAuthenticated, authLoading, role, router, redirecting]);

  if ((authLoading && !isAuthenticated) || redirecting) return null;

  return (
    <div className={`${styles.pageWrapper} ${isReady ? styles.ready : ''}`}>
      <Header variant="prof" />
      <main className={styles.mainContent}>
        <h1 className={styles.pageTitle}>Mes ressources FLE</h1>
        <div className={styles.bascule} role="tablist" aria-label="Ressources FLE">
          <button type="button" role="tab" aria-selected={section === 'theorie'} className={`${styles.basculeBtn} ${section === 'theorie' ? styles.basculeActive : ''}`} onClick={() => setSection('theorie')}>
            📖 Points de théorie
          </button>
          <button type="button" role="tab" aria-selected={section === 'activites'} className={`${styles.basculeBtn} ${section === 'activites' ? styles.basculeActive : ''}`} onClick={() => setSection('activites')}>
            🎯 Activités FLE
          </button>
        </div>
        {section === 'theorie' ? <ModuleFlePanel /> : <ActiviteFlePanel />}
      </main>
      <Footer />
    </div>
  );
}
