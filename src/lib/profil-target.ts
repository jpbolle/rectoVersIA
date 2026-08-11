// Résolution de la cible des routes /api/profil/* :
// - sans paramètre : l'utilisateur connecté consulte son propre profil ;
// - avec ?eleveId= : un prof consulte la fiche d'un de SES élèves (vérification
//   que la classe de l'élève lui appartient). L'email est déchiffré côté
//   serveur ; un élève jamais connecté (pas de firebaseUid) donnera un profil
//   vide, ce qui est le comportement attendu.

import type { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { decrypt } from '@/lib/crypto';

interface AuthInfo {
  uid: string;
  email?: string | null;
  role?: string;
}

export type ProfilTarget =
  | { uid: string; email: string }
  | { errorStatus: number; errorMessage: string };

export async function resolveProfilTarget(
  auth: AuthInfo,
  request: NextRequest
): Promise<ProfilTarget> {
  const eleveId = new URL(request.url).searchParams.get('eleveId');

  // Cas standard : profil de l'utilisateur connecté
  if (!eleveId) {
    return { uid: auth.uid, email: auth.email || '' };
  }

  // Consultation par un prof
  if (auth.role !== 'prof') {
    return { errorStatus: 403, errorMessage: 'Accès réservé aux professeurs' };
  }

  const eleveDoc = await adminDb.collection('eleves').doc(eleveId).get();
  if (!eleveDoc.exists) {
    return { errorStatus: 404, errorMessage: 'Élève introuvable' };
  }
  const eleve = eleveDoc.data() as {
    classeId?: string;
    email?: string;
    firebaseUid?: string;
  };

  // L'élève doit appartenir à une classe du prof
  const classeDoc = eleve.classeId
    ? await adminDb.collection('classes').doc(eleve.classeId).get()
    : null;
  if (!classeDoc?.exists || classeDoc.data()?.profId !== auth.uid) {
    return { errorStatus: 403, errorMessage: 'Cet élève n’est pas dans vos classes' };
  }

  return {
    uid: eleve.firebaseUid || '',
    email: decrypt(eleve.email) || '',
  };
}

export function isProfilTargetError(
  target: ProfilTarget
): target is { errorStatus: number; errorMessage: string } {
  return 'errorStatus' in target;
}
