'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import UserAvatar from '@/components/UserAvatar';
import NotificationBell from '@/components/NotificationBell/NotificationBell';
import { useEspace } from '@/context/EspaceContext';
import type { Espace } from '@/context/EspaceContext';
import styles from './Header.module.css';

// Onglets de la page /admin, pilotés par le header (variant admin)
export type AdminHeaderTab = 'vue' | 'membres' | 'didactique' | 'couts';

// DEUX ESPACES (JP, 2026-10-08) : classique et FLE, choisis par un double
// bouton ambre à côté de la cloche. Le prof a toujours ce bouton ; l'élève ne
// l'a que s'il a une classe FLE (`avecCoursFle`, ou le header `fle`). Les
// menus suivent l'espace :
//   prof classique : Accueil · Mes Activités · Mes Classes · Mes Ressources
//   prof FLE       : Accueil · Mes activités FLE · Mes classes · Mes ressources FLE
//   élève classique: le header élève habituel ; élève FLE : « Mon cours FLE ».
interface HeaderProps {
  variant: 'prof' | 'student' | 'admin' | 'fle';
  topOffset?: number;
  // Élève à classes mixtes : il a le double bouton (header élève)
  avecCoursFle?: boolean;
  // Conservé pour les appelants (le double bouton remplace l'ancien bouton Accueil)
  avecAccueil?: boolean;
  // Variant admin uniquement : onglet actif + navigation entre onglets
  adminTab?: AdminHeaderTab;
  onAdminTabChange?: (tab: AdminHeaderTab) => void;
}

// Source unique des libellés d'onglets : la page /admin s'en sert aussi pour
// son titre — le header porte déjà « Administration du site », le titre de la
// page nomme donc l'onglet courant, sans le répéter.
export const ADMIN_TABS: { key: AdminHeaderTab; label: string }[] = [
  { key: 'vue', label: 'Vue d’ensemble' },
  { key: 'membres', label: 'Gestion des membres' },
  { key: 'didactique', label: 'Gestion didactique' },
  { key: 'couts', label: 'Gestion des coûts' },
];

export default function Header({
  variant,
  topOffset = 0,
  avecCoursFle,
  adminTab,
  onAdminTabChange,
}: HeaderProps) {
  const router = useRouter();
  const { espace, setEspace } = useEspace();

  const estProf = variant === 'prof';
  const estEleve = variant === 'student' || variant === 'fle';
  // Pour l'élève, l'espace courant se lit aussi dans le header qu'on lui sert
  const espaceEleve: Espace = variant === 'fle' ? 'fle' : 'classique';
  const espaceAffiche: Espace = estProf ? espace : espaceEleve;
  const avecBascule = estProf || variant === 'fle' || (variant === 'student' && !!avecCoursFle);

  const basculer = (e: Espace) => {
    if (e === espaceAffiche) return;
    setEspace(e);
    // Chaque espace a sa page d'entrée
    if (estProf) router.push('/accueil');
    else router.push(e === 'fle' ? '/fle' : '/accueil');
  };

  const sousTitre =
    variant === 'admin'
      ? 'Administration'
      : estProf
        ? espace === 'fle'
          ? 'Espace FLE'
          : 'Assistant de correction'
        : variant === 'fle'
          ? 'Mon cours de français'
          : 'Aide à l’écrilecture';

  return (
    <header className={styles.header} style={topOffset ? { top: `${topOffset}px` } : undefined}>
      <Link href="/" className={styles.logoLink}>
        <img src="/logoRecto.png" alt="RectoVerso" className={styles.logoImg} />
      </Link>
      <div className={styles.headerContent}>
        <h1 className={styles.title}>RectoVerso</h1>
        <p className={styles.subtitle}>{sousTitre}</p>

        {variant === 'admin' ? (
          <nav className={styles.navButtons}>
            {ADMIN_TABS.map((tab) => (
              <button
                key={tab.key}
                className={`${styles.navBtn} ${adminTab === tab.key ? styles.navBtnActive : ''}`}
                onClick={() => onAdminTabChange?.(tab.key)}
              >
                {tab.label}
              </button>
            ))}
            {/* Sortie de l'administration : en dernier, après les onglets */}
            <button className={styles.navBtn} onClick={() => router.push('/dashboard')}>
              Retour à l&apos;accueil
            </button>
          </nav>
        ) : estProf && espace === 'fle' ? (
          <nav className={styles.navButtons}>
            <button className={styles.navBtn} onClick={() => router.push('/accueil')}>
              Accueil
            </button>
            <button className={styles.navBtn} onClick={() => router.push('/dashboard')}>
              Mes activités FLE
            </button>
            <button className={styles.navBtn} onClick={() => router.push('/classes')}>
              Mes classes
            </button>
            <button className={styles.navBtn} onClick={() => router.push('/ressources-fle')}>
              Mes ressources FLE
            </button>
          </nav>
        ) : estProf ? (
          <nav className={styles.navButtons}>
            {/* L'accueil du prof : à corriger, échéances à venir, élèves en retard */}
            <button className={styles.navBtn} onClick={() => router.push('/accueil')}>
              Accueil
            </button>
            <button className={styles.navBtn} onClick={() => router.push('/dashboard')}>
              Mes Activités
            </button>
            <button className={styles.navBtn} onClick={() => router.push('/classes')}>
              Mes Classes
            </button>
            <button className={styles.navBtn} onClick={() => router.push('/grilles')}>
              Mes Ressources
            </button>
          </nav>
        ) : variant === 'fle' ? (
          <nav className={styles.navButtons}>
            <button className={styles.navBtn} onClick={() => router.push('/fle')}>
              Mon cours FLE
            </button>
            <button className={styles.navBtn} onClick={() => router.push('/mes-classes')}>
              Mes classes
            </button>
            <button className={styles.navBtn} onClick={() => router.push('/fle/ressources')}>
              Mes ressources personnelles
            </button>
            <button className={styles.navBtn} onClick={() => router.push('/profil')}>
              Mon profil
            </button>
          </nav>
        ) : (
          <nav className={styles.navButtons}>
            {/* La page d'ouverture de l'élève : ses retards, ses échéances, ses
                derniers résultats et sa progression en ceintures. */}
            <button className={styles.navBtn} onClick={() => router.push('/accueil')}>
              Accueil
            </button>
            <button className={styles.navBtn} onClick={() => router.push('/activites')}>
              Mes Activités
            </button>
            <button className={styles.navBtn} onClick={() => router.push('/mes-classes')}>
              Mes Classes
            </button>
            <button className={styles.navBtn} onClick={() => router.push('/mes-ressources')}>
              Mes Ressources personnelles
            </button>
            <button className={styles.navBtn} onClick={() => router.push('/profil')}>
              Mon Profil
            </button>
          </nav>
        )}
      </div>

      <div className={styles.headerActions}>
        {avecBascule && (estProf || estEleve) && (
          <div className={styles.espaces} role="tablist" aria-label="Espace de travail">
            <button
              type="button"
              role="tab"
              aria-selected={espaceAffiche === 'classique'}
              className={`${styles.espaceBtn} ${espaceAffiche === 'classique' ? styles.espaceActif : ''}`}
              onClick={() => basculer('classique')}
            >
              Espace classique
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={espaceAffiche === 'fle'}
              className={`${styles.espaceBtn} ${espaceAffiche === 'fle' ? styles.espaceActif : ''}`}
              onClick={() => basculer('fle')}
            >
              Espace FLE
            </button>
          </div>
        )}
        <NotificationBell variant={variant === 'fle' ? 'student' : variant} />
        <UserAvatar />
      </div>
    </header>
  );
}
