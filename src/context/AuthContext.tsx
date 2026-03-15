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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    role: null,
    isAdmin: false,
    isLoading: true,
    isAuthenticated: false,
  });

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
          currentUidRef.current = user.uid;
          userRef.current = user;
          setState({
            user,
            role,
            isAdmin: checkIsAdmin(email),
            isLoading: false,
            isAuthenticated: true,
          });
        } else {
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
