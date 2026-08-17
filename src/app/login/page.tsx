'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useStudentClasses } from '@/hooks/useStudentClasses';
import GoogleSignInButton from '@/components/GoogleSignInButton/GoogleSignInButton';
import JoinClasseModal from '@/components/JoinClasseModal/JoinClasseModal';
import styles from './login.module.css';

const MAX_FAILED_ATTEMPTS = 3;

export default function LoginPage() {
  const { isAuthenticated, isLoading, role, signIn, signOut } = useAuth();
  const router = useRouter();
  const { classes, isLoading: classesLoading, joinClasse } = useStudentClasses();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const [checkingClasses, setCheckingClasses] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  // Redirection pour les utilisateurs qui ont déjà des classes
  useEffect(() => {
    // Attendre Firebase seulement si pas encore authentifié (pas de cache)
    if (!isAuthenticated && isLoading) return;
    if (!isAuthenticated) return;

    if (role === 'prof') {
      setRedirecting(true);
      router.replace('/dashboard');
      return;
    }

    // Pour l'élève, attendre que ses classes soient chargées
    if (role === 'eleve' && classesLoading) return;

    // Élève avec des classes → rediriger vers SA page d'accueil (retards,
    // échéances, ceintures) — pas vers la liste de ses activités.
    if (role === 'eleve' && classes.length > 0) {
      setRedirecting(true);
      router.replace('/accueil');
      return;
    }

    // Élève sans classe → afficher la popup sur l'écran de login
    if (role === 'eleve' && !classesLoading && classes.length === 0 && !blocked) {
      setCheckingClasses(false);
      setShowJoinModal(true);
    }
  }, [isAuthenticated, isLoading, role, classes, classesLoading, router, blocked]);

  // Blocage après 3 tentatives
  useEffect(() => {
    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      setBlocked(true);
      setShowJoinModal(false);
      const timer = setTimeout(async () => {
        await signOut();
        setBlocked(false);
        setFailedAttempts(0);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [failedAttempts, signOut]);

  async function handleGoogleSignIn() {
    setError(null);
    setIsSigningIn(true);

    const result = await signIn();

    if (result.success) {
      setCheckingClasses(true);
      setIsSigningIn(false);
      // Le useEffect ci-dessus gère la suite
    } else {
      setError(result.error || 'Erreur d\'authentification');
      setIsSigningIn(false);
    }
  }

  const handleJoin = useCallback(async (code: string, nom: string, prenom: string) => {
    try {
      const result = await joinClasse(code, nom, prenom);
      setFailedAttempts(0);
      // Après succès, la liste de classes se met à jour → le useEffect redirigera
      return result;
    } catch (err) {
      setFailedAttempts((prev) => prev + 1);
      throw err;
    }
  }, [joinClasse]);

  const handleCloseModal = useCallback(() => {
    setShowJoinModal(false);
    // Fermer le modal sans avoir rejoint = 1 tentative perdue
    if (classes.length === 0 && !blocked) {
      setFailedAttempts((prev) => prev + 1);
    }
  }, [classes.length, blocked]);

  // En cours de redirection → ne rien rendre (évite le flash de la page login)
  // Ne pas bloquer le rendu si authentifié sans classe (élève doit voir le modal)
  if (redirecting) return null;

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
            <p className={styles.subtitle}>Aide à l&#39;écrilecture</p>
          </div>

          {blocked ? (
            <div className={styles.errorMessage}>
              Trop de tentatives échouées. Redirection...
            </div>
          ) : checkingClasses ? (
            <div className={styles.loading}>
              <div className={styles.spinner} />
            </div>
          ) : !isAuthenticated ? (
            <>
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
            </>
          ) : null}

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

      {showJoinModal && !blocked && !redirecting && (
        <JoinClasseModal
          onClose={handleCloseModal}
          onJoin={handleJoin}
          remainingAttempts={MAX_FAILED_ATTEMPTS - failedAttempts}
        />
      )}
    </div>
  );
}
