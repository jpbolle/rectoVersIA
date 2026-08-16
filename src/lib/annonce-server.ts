// Poser une notification depuis le serveur, sans passer par /api/annonces.
//
// Certaines notifications ne sont pas un geste de l'utilisateur mais la
// CONSÉQUENCE d'un autre : partager une œuvre prévient le collègue. Les faire
// écrire par le navigateur, en second appel, c'est accepter qu'elles partent
// sans que le partage ait réussi — ou l'inverse. On les écrit donc là où
// l'action se produit.
//
// La collection `annonces` est en accès serveur uniquement : aucune règle
// Firestore n'est requise.

import { adminDb } from '@/lib/firebase/admin';
import { generateAnnonceId, normalizeLien } from '@/types/annonce';
import type { Annonce, AnnonceCible } from '@/types/annonce';

const MAX_MESSAGE = 500;

interface PoserAnnonce {
  message: string;
  cible: AnnonceCible;
  auteurUid: string;
  lien?: string | null;
  destinataireUid?: string;
  destinataireEmail?: string;
  ton?: 'felicitation' | 'rappel' | null;
}

/**
 * Écrit une annonce. Renvoie `null` si le message est vide — jamais d'erreur :
 * une notification qui échoue ne doit pas faire échouer l'action qui l'a
 * provoquée (le partage, lui, a bien eu lieu).
 */
export async function poserAnnonce(a: PoserAnnonce): Promise<Annonce | null> {
  const message = a.message.trim();
  if (!message) return null;

  const annonce: Annonce = {
    id: generateAnnonceId(),
    message: message.slice(0, MAX_MESSAGE),
    cible: a.cible,
    lien: normalizeLien(a.lien),
    auteurUid: a.auteurUid,
    createdAt: new Date().toISOString(),
    // Firestore refuse `undefined` : on n'écrit que ce qui existe
    ...(a.destinataireUid ? { destinataireUid: a.destinataireUid } : {}),
    ...(a.destinataireEmail ? { destinataireEmail: a.destinataireEmail.toLowerCase() } : {}),
    ...(a.ton ? { ton: a.ton } : {}),
  };

  try {
    await adminDb.collection('annonces').doc(annonce.id).set(annonce);
    return annonce;
  } catch (error) {
    console.error('Notification non écrite:', error);
    return null;
  }
}
