'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import UserAvatar from '@/components/UserAvatar';
import NotificationBell from '@/components/NotificationBell/NotificationBell';
import styles from './Header.module.css';

// Onglets de la page /admin, pilotés par le header (variant admin)
export type AdminHeaderTab = 'vue' | 'membres' | 'didactique' | 'couts';

interface HeaderProps {
  variant: 'prof' | 'student' | 'admin';
  topOffset?: number;
  // Variant admin uniquement : onglet actif + navigation entre onglets
  adminTab?: AdminHeaderTab;
  onAdminTabChange?: (tab: AdminHeaderTab) => void;
}

const ADMIN_TABS: { key: AdminHeaderTab; label: string }[] = [
  { key: 'vue', label: 'Vue d’ensemble' },
  { key: 'membres', label: 'Gestion des membres' },
  { key: 'didactique', label: 'Gestion didactique' },
  { key: 'couts', label: 'Gestion des coûts' },
];

export default function Header({ variant, topOffset = 0, adminTab, onAdminTabChange }: HeaderProps) {
  const router = useRouter();

  return (
    <header className={styles.header} style={topOffset ? { top: `${topOffset}px` } : undefined}>
      <Link href="/" className={styles.logoLink}>
        <img src="/logoRecto.png" alt="Recto-VersIA" className={styles.logoImg} />
      </Link>
      <div className={styles.headerContent}>
        <h1 className={styles.title}>Recto-VersIA</h1>
        <p className={styles.subtitle}>
          {variant === 'prof'
            ? 'Assistant de correction'
            : variant === 'admin'
              ? 'Administration'
              : 'Aide à l\'écrilecture'}
        </p>

        {variant === 'admin' ? (
          <nav className={styles.navButtons}>
            <button className={styles.navBtn} onClick={() => router.push('/dashboard')}>
              Accueil
            </button>
            {ADMIN_TABS.map((tab) => (
              <button
                key={tab.key}
                className={`${styles.navBtn} ${adminTab === tab.key ? styles.navBtnActive : ''}`}
                onClick={() => onAdminTabChange?.(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        ) : variant === 'prof' ? (
          <nav className={styles.navButtons}>
            <button
              className={styles.navBtn}
              onClick={() => router.push('/dashboard')}
            >
              Mes Activités
            </button>
            <button
              className={styles.navBtn}
              onClick={() => router.push('/classes')}
            >
              Mes Classes
            </button>
            <button
              className={styles.navBtn}
              onClick={() => router.push('/grilles')}
            >
              Mes Ressources
            </button>
          </nav>
        ) : (
          <nav className={styles.navButtons}>
            <button
              className={styles.navBtn}
              onClick={() => router.push('/activites')}
            >
              Mes Activités
            </button>
            <button
              className={styles.navBtn}
              onClick={() => router.push('/mes-classes')}
            >
              Mes Classes
            </button>
            <button
              className={styles.navBtn}
              onClick={() => router.push('/mes-ressources')}
            >
              Mes Ressources personnelles
            </button>
            <button
              className={styles.navBtn}
              onClick={() => router.push('/profil')}
            >
              Mon Profil
            </button>
          </nav>
        )}
      </div>

      <div className={styles.headerActions}>
        <NotificationBell variant={variant} />
        <UserAvatar />
      </div>
    </header>
  );
}
