import { adminDb } from '@/lib/firebase/admin';
import { encrypt, hashEmail } from '@/lib/crypto';

// ── Mots traduits avec Daspalecte → vocabulaire personnel de l'élève ──
// SERVEUR UNIQUEMENT.
//
// Les mots rejoignent `vocabulairePersonnel/{uid}`, la liste où NavigKid et le
// dictionnaire de l'app rangent déjà les leurs. Mais l'extension n'envoie que
// l'adresse Google de l'élève : tant qu'il ne s'est jamais connecté à
// Recto-versIA, il n'a pas d'uid. Ses mots attendent alors dans
// `vocabulaireEnAttente/{empreinte d'email}`, versés à sa première connexion
// (/api/eleves/link) ou au premier lot reçu une fois l'uid connu.

export const COLL_PERSO = 'vocabulairePersonnel';
export const COLL_ATTENTE = 'vocabulaireEnAttente';

// Forme d'un mot de la liste personnelle. `definition`/`example` viennent de
// NavigKid et du dictionnaire ; les champs suivants, de Daspalecte.
export interface MotPersonnel {
  word: string;
  definition?: string;
  example?: string;
  addedAt?: string;
  traduction?: string;
  langue?: string;
  source?: 'daspalecte';
  clics?: number;
  lastSeenAt?: string;
}

// Même normalisation que POST /api/vocabulaire/personnel : un mot déjà demandé
// à NavigKid et cliqué dans Daspalecte ne fait qu'une ligne.
export function normaliserMot(word: string): string {
  return word.trim().toLowerCase().slice(0, 50);
}

/**
 * Ajoute des mots reçus à une liste existante. Un mot déjà présent n'est pas
 * dupliqué : son compteur de clics grossit, et il gagne la traduction s'il ne
 * l'avait pas (mot venu de NavigKid, par exemple).
 */
export function fusionnerMots(existants: MotPersonnel[], recus: MotPersonnel[]): MotPersonnel[] {
  const liste = existants.map((m) => ({ ...m }));
  const index = new Map(liste.map((m, i) => [(m.word || '').toLowerCase(), i]));

  for (const recu of recus) {
    const cle = recu.word.toLowerCase();
    const i = index.get(cle);
    if (i === undefined) {
      index.set(cle, liste.length);
      liste.push({ ...recu });
      continue;
    }
    const m = liste[i];
    m.clics = (m.clics || 0) + (recu.clics || 0);
    if (!m.traduction && recu.traduction) m.traduction = recu.traduction;
    if (!m.langue && recu.langue) m.langue = recu.langue;
    if (recu.lastSeenAt && (!m.lastSeenAt || recu.lastSeenAt > m.lastSeenAt)) {
      m.lastSeenAt = recu.lastSeenAt;
    }
  }
  return liste;
}

/**
 * Verse la file d'attente d'un élève dans sa liste personnelle, puis la vide.
 * Appelé à la connexion : sans effet (une lecture) s'il n'y a rien en attente.
 */
export async function verserMotsEnAttente(uid: string, email: string): Promise<number> {
  const emailHash = hashEmail(email);
  if (!uid || !emailHash) return 0;

  const attenteRef = adminDb.collection(COLL_ATTENTE).doc(emailHash);
  const persoRef = adminDb.collection(COLL_PERSO).doc(uid);

  return adminDb.runTransaction(async (tx) => {
    const [attente, perso] = await tx.getAll(attenteRef, persoRef);
    if (!attente.exists) return 0;

    const enAttente: MotPersonnel[] = attente.data()?.words || [];
    const words = fusionnerMots(perso.exists ? perso.data()?.words || [] : [], enAttente);

    tx.set(
      persoRef,
      { studentEmail: encrypt(email), words, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    tx.delete(attenteRef);
    return enAttente.length;
  });
}
