import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { hashEmail } from '@/lib/crypto';

/**
 * L'uid Firebase d'un élève, retrouvé par son email dans Firebase Auth — SERVEUR
 * UNIQUEMENT. Sert quand sa fiche `eleves` n'est pas encore liée (`firebaseUid`
 * n'est posé qu'à la connexion suivante : cas d'un élève ajouté à une classe
 * alors qu'il avait déjà un compte). null = jamais connecté à Recto-versIA.
 */
export async function uidParEmail(email: string): Promise<string | null> {
  if (!email) return null;
  try {
    return (await adminAuth.getUserByEmail(email.trim().toLowerCase())).uid;
  } catch {
    return null;
  }
}

/**
 * Retrouve les documents eleves par email — SERVEUR UNIQUEMENT.
 * Interroge d'abord l'empreinte `emailHash` (documents migrés/chiffrés), puis se
 * replie sur l'email en clair (documents pas encore migrés). Les champs identité
 * des documents retournés restent chiffrés : décrypter à la lecture si besoin.
 */
export async function queryElevesByEmail(email: string, classeId?: string) {
  const normalized = email.trim().toLowerCase();

  let query = adminDb
    .collection('eleves')
    .where('emailHash', '==', hashEmail(normalized));
  if (classeId) query = query.where('classeId', '==', classeId);
  let snap = await query.get();

  if (snap.empty) {
    let fallback = adminDb.collection('eleves').where('email', '==', normalized);
    if (classeId) fallback = fallback.where('classeId', '==', classeId);
    snap = await fallback.get();
  }

  return snap;
}
