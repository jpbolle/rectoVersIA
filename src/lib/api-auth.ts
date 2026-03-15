import { NextRequest } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { getUserRole, isAdmin } from '@/lib/auth-utils';

// Resolution de role asynchrone : hardcode + Firestore professeurs + Firestore eleves
async function resolveUserRole(email: string): Promise<'prof' | 'eleve' | null> {
  const role = getUserRole(email);
  if (role) return role;

  const emailLower = email.toLowerCase().trim();

  // Fallback 1 : verifier la collection professeurs
  const profDoc = await adminDb.collection('professeurs').doc(emailLower).get();
  if (profDoc.exists) {
    const expiresAt = profDoc.data()?.expiresAt;
    // Acces expire → supprimer le doc et traiter comme non-prof
    if (expiresAt && new Date(expiresAt) < new Date()) {
      await adminDb.collection('professeurs').doc(emailLower).delete();
    } else {
      return 'prof';
    }
  }

  // Tout utilisateur connecte qui n'est pas prof est eleve par defaut
  return 'eleve';
}

export async function verifyAuth(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  try {
    const token = authHeader.split('Bearer ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const email = decoded.email || '';
    const role = await resolveUserRole(email);
    if (!role) return null;
    return { uid: decoded.uid, email, role, isAdmin: isAdmin(email) };
  } catch {
    return null;
  }
}
