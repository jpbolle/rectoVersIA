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
import AffichageBadge from '@/components/AffichageBadge/AffichageBadge';
import { useAffichage } from '@/hooks/useAffichage';
import styles from '../parcours-fle/parcours-fle.module.css';
import onglets from '../grilles/grilles.module.css';

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

  // Gestion de l'affichage : une section masquée reste visible, grisée, non
  // cliquable ; l'affichée ne peut pas l'être (→ l'autre, si elle est libre)
  const { vue: vueAffichage } = useAffichage();
  const vTheorie = vueAffichage('ressource:fle-theorie');
  const vActivites = vueAffichage('ressource:fle-activites');
  const affichee: Section | null = !(section === 'theorie' ? vTheorie : vActivites).bloque
    ? section
    : !(section === 'theorie' ? vActivites : vTheorie).bloque
      ? section === 'theorie' ? 'activites' : 'theorie'
      : null;

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
        {/* Onglets — même barre que Mes Ressources (JP, 2026-10-13) ; une
            section MASQUÉE reste visible, grisée et non cliquable */}
        <div className={onglets.tabBar} role="tablist" aria-label="Ressources FLE">
          <button
            type="button"
            role="tab"
            aria-selected={affichee === 'theorie'}
            className={`${onglets.tabButton} ${affichee === 'theorie' ? onglets.tabActive : ''} ${vTheorie.bloque ? onglets.tabBloque : ''}`}
            onClick={() => !vTheorie.bloque && setSection('theorie')}
            disabled={vTheorie.bloque}
            title={vTheorie.bloque ? vTheorie.note : undefined}
          >
            Points de théorie <AffichageBadge vue={vTheorie} compact />
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={affichee === 'activites'}
            className={`${onglets.tabButton} ${affichee === 'activites' ? onglets.tabActive : ''} ${vActivites.bloque ? onglets.tabBloque : ''}`}
            onClick={() => !vActivites.bloque && setSection('activites')}
            disabled={vActivites.bloque}
            title={vActivites.bloque ? vActivites.note : undefined}
          >
            Activités FLE <AffichageBadge vue={vActivites} compact />
          </button>
        </div>
        {affichee === 'theorie' ? <ModuleFlePanel /> : affichee === 'activites' ? <ActiviteFlePanel /> : null}
      </main>
      <Footer />
    </div>
  );
}
