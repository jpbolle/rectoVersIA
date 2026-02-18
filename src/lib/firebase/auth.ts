import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, onIdTokenChanged, type User, type Auth } from 'firebase/auth';
import { getFirebaseApp } from './config';

let _auth: Auth | null = null;

function getFirebaseAuth(): Auth {
  if (!_auth) {
    _auth = getAuth(getFirebaseApp());
  }
  return _auth;
}

export async function signInWithGoogle(): Promise<User> {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  const idToken = await result.user.getIdToken();
  setSessionCookie(idToken);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  const auth = getFirebaseAuth();
  await firebaseSignOut(auth);
  clearSessionCookie();
}

export function onTokenRefresh(callback: (user: User | null) => void): () => void {
  const auth = getFirebaseAuth();
  return onIdTokenChanged(auth, async (user) => {
    if (user) {
      const idToken = await user.getIdToken();
      setSessionCookie(idToken);
    } else {
      clearSessionCookie();
    }
    callback(user);
  });
}

function setSessionCookie(token: string): void {
  if (typeof document !== 'undefined') {
    document.cookie = `__session=${token}; path=/; max-age=3600; SameSite=Lax`;
  }
}

function clearSessionCookie(): void {
  if (typeof document !== 'undefined') {
    document.cookie = '__session=; path=/; max-age=0';
  }
}
