import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage as getAdminStorageSDK, type Storage } from 'firebase-admin/storage';

function getAdminApp(): App | null {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.warn('Firebase Admin: credentials manquantes, SDK non initialise');
    return null;
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    }),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

let _adminAuth: Auth | null = null;
let _adminDb: Firestore | null = null;

function ensureInitialized() {
  if (_adminAuth && _adminDb) return;
  const app = getAdminApp();
  if (!app) {
    throw new Error('Firebase Admin SDK non configure. Verifiez les variables d\'environnement.');
  }
  _adminAuth = getAuth(app);
  _adminDb = getFirestore(app);
}

export function getAdminAuth(): Auth {
  ensureInitialized();
  return _adminAuth!;
}

export function getAdminDb(): Firestore {
  ensureInitialized();
  return _adminDb!;
}

export function getAdminStorage(): Storage {
  ensureInitialized();
  return getAdminStorageSDK();
}

// Re-export sous les anciens noms pour compatibilite
export const adminAuth = new Proxy({} as Auth, {
  get(_, prop) {
    return Reflect.get(getAdminAuth(), prop);
  },
});

export const adminDb = new Proxy({} as Firestore, {
  get(_, prop) {
    return Reflect.get(getAdminDb(), prop);
  },
});
