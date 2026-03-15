'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { isAdmin } from '@/lib/auth-utils';
import { usePreferences } from '@/hooks/usePreferences';
import { useRouter } from 'next/navigation';
import PreferencesModal from '@/components/PreferencesModal/PreferencesModal';
import styles from './UserAvatar.module.css';

function getInitials(email: string | null | undefined, displayName: string | null | undefined): string {
  if (displayName) {
    const parts = displayName.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return displayName.substring(0, 2).toUpperCase();
  }
  if (email) {
    return email.substring(0, 2).toUpperCase();
  }
  return '??';
}

export default function UserAvatar() {
  const { user, role, signOut } = useAuth();
  const { preferences, preferencesSet, updatePreferences, markPreferencesSet } = usePreferences();
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const firstLoginHandled = useRef(false);

  // Ouvrir automatiquement la modal pour les eleves a la premiere connexion
  useEffect(() => {
    if (
      !firstLoginHandled.current &&
      role === 'eleve' &&
      !preferencesSet &&
      user
    ) {
      firstLoginHandled.current = true;
      setShowPreferences(true);
    }
  }, [role, preferencesSet, user]);

  const initials = getInitials(user?.email, user?.displayName);
  const photoURL = user?.photoURL;

  async function handleLogout() {
    setShowMenu(false);
    await signOut();
    router.replace('/login');
  }

  function handleOpenPreferences() {
    setShowMenu(false);
    setShowPreferences(true);
  }

  return (
    <>
      <div className={styles.avatarContainer}>
        <button
          className={styles.avatarBtn}
          onClick={() => setShowMenu(!showMenu)}
          title={user?.email || 'Mon compte'}
        >
          {photoURL ? (
            <img src={photoURL} alt="Avatar" className={styles.avatarImg} />
          ) : (
            <span className={styles.initials}>{initials}</span>
          )}
        </button>

        {showMenu && (
          <div className={styles.dropdownMenu}>
            <div className={styles.menuUserInfo}>
              <span className={styles.menuEmail}>{user?.email}</span>
            </div>
            <button className={styles.menuItem} onClick={handleOpenPreferences}>
              Mes préférences
            </button>
            <button className={styles.menuItem} onClick={() => { setShowMenu(false); router.push('/roadmap'); }}>
              Roadmap
            </button>
            {isAdmin(user?.email || '') && (
              <button className={styles.menuItem} onClick={() => { setShowMenu(false); router.push('/admin'); }}>
                Administration du site
              </button>
            )}
            <button className={styles.menuItem} onClick={handleLogout}>
              Déconnexion
            </button>
          </div>
        )}
      </div>

      {showMenu && (
        <div
          className={styles.backdrop}
          onClick={() => setShowMenu(false)}
        />
      )}

      <PreferencesModal
        isOpen={showPreferences}
        onClose={() => {
          setShowPreferences(false);
          markPreferencesSet();
        }}
        preferences={preferences}
        onSave={async (prefs) => {
          await updatePreferences(prefs);
          markPreferencesSet();
        }}
      />
    </>
  );
}
