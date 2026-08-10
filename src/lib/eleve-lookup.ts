import { adminDb } from '@/lib/firebase/admin';
import { hashEmail } from '@/lib/crypto';

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
