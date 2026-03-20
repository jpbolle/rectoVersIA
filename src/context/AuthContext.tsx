'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { type User } from 'firebase/auth';
import { signInWithGoogle, signOutUser, onTokenRefresh } from '@/lib/firebase/auth';
import { getUserRole, isAdmin as checkIsAdmin } from '@/lib/auth-utils';
import type { UserRole } from '@/types';

interface AuthState {
  user: User | null;
  role: UserRole | null;
  isAdmin: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
}

type AuthHeaders = { 'Content-Type': string; Authorization: string };

interface AuthContextValue extends AuthState {
  signIn: () => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  getAuthHeaders: () => Promise<AuthHeaders | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Cache sessionStorage : évite le flash auth entre navigations ───
const SESSION_KEY = 'rv_auth_v1';

function readAuthCache(): { role: UserRole; isAdmin: boolean } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeAuthCache(role: UserRole, isAdmin: boolean) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ role, isAdmin })); } catch {}
}

function clearAuthCache() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch {}
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Démarrage identique serveur/client pour éviter le mismatch d'hydratation
  const [state, setState] = useState<AuthState>({
    user: null,
    role: null,
    isAdmin: false,
    isLoading: true,
    isAuthenticated: false,
  });

  // Appliquer le cache sessionStorage APRÈS hydratation (useEffect = client seulement)
  useEffect(() => {
    const cached = readAuthCache();
    if (cached) {
      setState((prev) => ({
        ...prev,
        role: cached.role,
        isAdmin: cached.isAdmin,
        isAuthenticated: true,
        // isLoading reste true — Firebase confirmera ensuite
      }));
    }
  }, []);

  // Stable ref for user — avoids re-renders on token refresh
  const userRef = useRef<User | null>(null);
  const currentUidRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = onTokenRefresh(async (user) => {
      if (user && user.email) {
        // Token refresh for same user — update ref silently, no setState
        if (currentUidRef.current === user.uid) {
          userRef.current = user;
          return;
        }

        const email = user.email;
        let role = getUserRole(email);

        // Fallback API pour les emails non-cnddinant.be (professeurs externes)
        if (!role) {
          try {
            const token = await user.getIdToken();
            const res = await fetch('/api/auth/role', {
              headers: { Authorization: `Bearer ${token}` },
            });
            const json = await res.json();
            if (json.success && json.role) {
              role = json.role;
            }
          } catch {
            // Silently fail
          }
        }

        if (role) {
          const isAdminVal = checkIsAdmin(email);
          writeAuthCache(role, isAdminVal);
          currentUidRef.current = user.uid;
          userRef.current = user;
          setState({
            user,
            role,
            isAdmin: isAdminVal,
            isLoading: false,
            isAuthenticated: true,
          });
        } else {
          clearAuthCache();
          currentUidRef.current = null;
          userRef.current = null;
          await signOutUser();
          setState({
            user: null,
            role: null,
            isAdmin: false,
            isLoading: false,
            isAuthenticated: false,
          });
        }
      } else {
        clearAuthCache();
        currentUidRef.current = null;
        userRef.current = null;
        setState({
          user: null,
          role: null,
          isAdmin: false,
          isLoading: false,
          isAuthenticated: false,
        });
      }
    });

    return () => unsubscribe();
  }, []);

  // Stable getAuthHeaders — never changes reference, uses userRef internally
  const getAuthHeaders = useCallback(async (): Promise<AuthHeaders | null> => {
    if (!userRef.current) return null;
    const token = await userRef.current.getIdToken();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }, []);

  const signIn = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const user = await signInWithGoogle();
      const email = user.email;

      if (!email) {
        await signOutUser();
        return { success: false, error: 'Adresse email non disponible.' };
      }

      let role = getUserRole(email);

      // Pour les emails non-cnddinant.be, vérifier via l'API si c'est un professeur enregistré
      if (!role) {
        try {
          const token = await user.getIdToken();
          const res = await fetch('/api/auth/role', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const json = await res.json();
          if (json.success && json.role) {
            role = json.role;
          }
        } catch {
          // Silently fail — will reject below
        }
      }

      if (!role) {
        await signOutUser();
        return {
          success: false,
          error: 'Accès non autorisé. Votre compte n\'est pas enregistré.',
        };
      }

      // Creer ou mettre a jour le document utilisateur via API (adminDb, bypass les rules)
      const token = await user.getIdToken();
      try {
        await fetch('/api/auth/init-user', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ displayName: user.displayName || '' }),
        });
      } catch {
        console.error('Erreur init-user');
      }

      // Si c'est un eleve, lier son uid Firebase a son document dans la collection "eleves"
      if (role === 'eleve') {
        try {
          await fetch('/api/eleves/link', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
        } catch (linkError) {
          console.error('Erreur liaison eleve/user:', linkError);
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Erreur authentification:', error);
      return {
        success: false,
        error: 'Une erreur est survenue lors de la connexion. Veuillez reessayer.',
      };
    }
  }, []);

  const signOut = useCallback(async () => {
    clearAuthCache();
    await signOutUser();
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut, getAuthHeaders }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
