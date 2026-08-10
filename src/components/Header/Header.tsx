'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import UserAvatar from '@/components/UserAvatar';
import styles from './Header.module.css';

interface HeaderProps {
  variant: 'prof' | 'student';
  topOffset?: number;
}

export default function Header({ variant, topOffset = 0 }: HeaderProps) {
  const router = useRouter();

  return (
    <header className={styles.header} style={topOffset ? { top: `${topOffset}px` } : undefined}>
      <Link href="/" className={styles.logoLink}>
        <img src="/logoRecto.png" alt="Recto-VersIA" className={styles.logoImg} />
      </Link>
      <div className={styles.headerContent}>
        <h1 className={styles.title}>Recto-VersIA</h1>
        <p className={styles.subtitle}>
          {variant === 'prof' ? 'Assistant de correction' : 'Aide à l\'écrilecture'}
        </p>

        {variant === 'prof' ? (
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
              onClick={() => router.push('/profil')}
            >
              Mon Profil
            </button>
          </nav>
        )}
      </div>

      <div className={styles.headerActions}>
        {variant === 'prof' && (
          <button
            className={styles.circleBtn}
            onClick={() => router.push('/activites')}
            title="Vue de l'élève"
          >
            <span className={styles.eyeIcon}>👁️</span>
          </button>
        )}

        <UserAvatar />
      </div>
    </header>
  );
}
