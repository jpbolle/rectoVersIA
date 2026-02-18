'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import GoogleSignInButton from '@/components/GoogleSignInButton/GoogleSignInButton';
import styles from './login.module.css';

export default function LoginPage() {
  const { isAuthenticated, isLoading, role, signIn } = useAuth();
  const router = useRouter();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) {
      if (role === 'prof') {
        router.replace('/dashboard');
      } else if (role === 'eleve') {
        router.replace('/activites');
      }
    }
  }, [isAuthenticated, isLoading, role, router]);

  async function handleGoogleSignIn() {
    setError(null);
    setIsSigningIn(true);

    const result = await signIn();

    if (result.success) {
      // Le redirect sera gere par le useEffect ci-dessus
    } else {
      setError(result.error || 'Erreur d\'authentification');
      setIsSigningIn(false);
    }
  }

  if (isLoading) {
    return (
      <div className={styles.body}>
        <div className={styles.loginContainer}>
          <div className={styles.mainContent}>
            <div className={styles.loading}>
              <div className={styles.spinner} />
            </div>
          </div>
          <footer className={styles.footer}>
            <div className={styles.footerLineWrap}>
              <span className={styles.footerLineSegment} />
              <a href="https://www.pedagokit.be/" target="_blank" rel="noopener noreferrer" className={styles.footerLogoLink}>
                <img
                  src="/logo%20copie.png"
                  alt="PEDAGOKIT ASBL"
                  className={styles.footerLogo}
                />
              </a>
              <span className={styles.footerLineSegment} />
            </div>
          </footer>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.body}>
      <div className={styles.loginContainer}>
        <div className={styles.mainContent}>
          <div className={styles.logoSection}>
            <img src="/logoRecto.png" alt="Recto-VersIA Logo" className={styles.appIcon} />
            <h1 className={styles.title}>Recto-VersIA</h1>
            <p className={styles.subtitle}>Aide à l&#39;écriture</p>
          </div>

          <div className={styles.buttonWrapper}>
            <GoogleSignInButton
              onClick={handleGoogleSignIn}
              disabled={isSigningIn}
            />
          </div>

          {isSigningIn && (
            <div className={styles.loading}>
              <div className={styles.spinner} />
            </div>
          )}

          {error && (
            <div className={styles.errorMessage}>{error}</div>
          )}
        </div>

        <footer className={styles.footer}>
          <div className={styles.footerLineWrap}>
            <span className={styles.footerLineSegment} />
            <a href="https://www.pedagokit.be/" target="_blank" rel="noopener noreferrer" className={styles.footerLogoLink}>
              <img
                src="/logo%20copie.png"
                alt="PEDAGOKIT ASBL"
                className={styles.footerLogo}
              />
            </a>
            <span className={styles.footerLineSegment} />
          </div>
        </footer>
      </div>
    </div>
  );
}
