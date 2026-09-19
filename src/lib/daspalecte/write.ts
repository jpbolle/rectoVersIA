import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { encrypt } from '@/lib/crypto';
import {
  COLL_ATTENTE, COLL_PERSO, fusionnerMots, normaliserMot, type MotPersonnel,
} from './mots';
import type { IngestBody, IngestEvent } from './schema';

// ── Écriture d'un lot d'événements Daspalecte ── SERVEUR UNIQUEMENT.
//
//  tracesDaspalecte/{sessionId}          une session (un onglet, 30 min d'inactivité max)
//    └ events/{eventId}                  le journal brut, même forme que daspa-app
//  resultatsDaspalecte/{eventId}         un exercice ou un test de lecture (les stats)
//  vocabulairePersonnel/{uid}            les mots traduits (ou vocabulaireEnAttente)
//
// L'élève y est désigné par son empreinte d'email (`studentEmailHash`) : rien
// d'identifiant en clair, et ça marche avant même sa première connexion.

export const COLL_TRACES = 'tracesDaspalecte';
export const COLL_RESULTATS = 'resultatsDaspalecte';

export interface IngestTarget {
  email: string;
  emailHash: string;
  /** null = l'élève ne s'est jamais connecté à Recto-versIA */
  uid: string | null;
}

interface Compteurs {
  words: number;
  exercises: number;
  readingTests: number;
  comprehensions: number;
  captures: number;
}

/**
 * Renvoie le nombre d'événements réellement enregistrés : un lot rejoué après
 * une coupure réseau renvoie 0 sans rien réécrire (les identifiants d'événement
 * viennent de l'extension, on écarte ceux qui existent déjà).
 */
export async function ingestBatch(target: IngestTarget, body: IngestBody): Promise<number> {
  const { email, emailHash, uid } = target;
  const { session, events, source } = body;

  const sessionRef = adminDb.collection(COLL_TRACES).doc(session.id);
  const eventsRef = sessionRef.collection('events');
  const eventRefs = events.map((e) => eventsRef.doc(e.id));
  const attenteRef = adminDb.collection(COLL_ATTENTE).doc(emailHash);
  const vocabRef = uid ? adminDb.collection(COLL_PERSO).doc(uid) : attenteRef;

  return adminDb.runTransaction(async (tx) => {
    // Toutes les lectures avant la moindre écriture (règle des transactions)
    const refs = uid ? [sessionRef, vocabRef, attenteRef, ...eventRefs] : [sessionRef, vocabRef, ...eventRefs];
    const snaps = await tx.getAll(...refs);
    const [sessionSnap, vocabSnap] = snaps;
    const attenteSnap = uid ? snaps[2] : null;
    const eventSnaps = snaps.slice(uid ? 3 : 2);

    const dejaLa = new Set(eventSnaps.filter((s) => s.exists).map((s) => s.id));
    const nouveaux = events.filter((e) => !dejaLa.has(e.id));
    if (nouveaux.length === 0) return 0;

    const compteurs: Compteurs = { words: 0, exercises: 0, readingTests: 0, comprehensions: 0, captures: 0 };
    const motsRecus: MotPersonnel[] = [];
    let lastActivityAt = session.startedAt;

    for (const event of nouveaux) {
      lastActivityAt = Math.max(lastActivityAt, event.at);
      tx.set(eventsRef.doc(event.id), {
        id: event.id,
        type: event.type,
        at: event.at,
        studentEmailHash: emailHash,
        payload: event.payload,
      });
      appliquer(event, { tx, emailHash, sessionId: session.id, compteurs, motsRecus });
    }

    tx.set(
      sessionRef,
      {
        id: session.id,
        studentEmailHash: emailHash,
        source,
        context: session.context,
        // `startedAt` n'est posé qu'au premier lot : sinon la durée serait fausse
        ...(sessionSnap.exists ? {} : { startedAt: session.startedAt }),
        lastActivityAt,
        counters: Object.fromEntries(
          Object.entries(compteurs).map(([k, v]) => [k, FieldValue.increment(v)])
        ),
      },
      { merge: true }
    );

    // Mots : dans la liste personnelle si l'uid est connu (en y versant au
    // passage une éventuelle file d'attente), sinon dans la file d'attente
    const enAttente: MotPersonnel[] = attenteSnap?.exists ? attenteSnap.data()?.words || [] : [];
    if (motsRecus.length > 0 || enAttente.length > 0) {
      const existants: MotPersonnel[] = vocabSnap.exists ? vocabSnap.data()?.words || [] : [];
      const words = fusionnerMots(fusionnerMots(existants, enAttente), motsRecus);
      const maintenant = new Date().toISOString();
      if (uid) {
        tx.set(vocabRef, { studentEmail: encrypt(email), words, updatedAt: maintenant }, { merge: true });
        if (attenteSnap?.exists) tx.delete(attenteRef);
      } else {
        tx.set(vocabRef, { words, updatedAt: maintenant }, { merge: true });
      }
    }

    return nouveaux.length;
  });
}

interface Contexte {
  tx: FirebaseFirestore.Transaction;
  emailHash: string;
  sessionId: string;
  compteurs: Compteurs;
  motsRecus: MotPersonnel[];
}

function appliquer(event: IngestEvent, ctx: Contexte) {
  const { tx, emailHash, sessionId, compteurs, motsRecus } = ctx;
  const p = event.payload;

  switch (event.type) {
    case 'word': {
      const brut = asString(p.word);
      const word = brut ? normaliserMot(brut) : '';
      if (!word) return;
      compteurs.words += 1;
      const quand = new Date(event.at).toISOString();
      motsRecus.push({
        word,
        definition: '',
        example: '',
        addedAt: quand,
        traduction: asString(p.translation) || '',
        langue: asString(p.nativeLanguage) || '',
        source: 'daspalecte',
        clics: 1,
        lastSeenAt: quand,
      });
      return;
    }

    case 'exercise': {
      compteurs.exercises += 1;
      tx.set(adminDb.collection(COLL_RESULTATS).doc(event.id), {
        id: event.id,
        kind: 'exercise',
        studentEmailHash: emailHash,
        sessionId,
        at: event.at,
        exerciseType: asString(p.exerciseType) || '',
        score: asNumber(p.score),
        total: asNumber(p.total),
        attempts: Math.max(1, asNumber(p.attempts)),
      });
      return;
    }

    case 'reading_test': {
      compteurs.readingTests += 1;
      tx.set(adminDb.collection(COLL_RESULTATS).doc(event.id), {
        id: event.id,
        kind: 'reading_test',
        studentEmailHash: emailHash,
        sessionId,
        at: event.at,
        mcqScore: asNumber(p.mcqScore),
        mcqTotal: asNumber(p.mcqTotal),
        matchingScore: asNumber(p.matchingScore),
        matchingTotal: asNumber(p.matchingTotal),
        percentage: asNumber(p.percentage),
        pageUrl: asString(p.pageUrl),
        pageTitle: asString(p.pageTitle),
      });
      return;
    }

    case 'comprehension':
      compteurs.comprehensions += 1;
      return;

    case 'capture':
      compteurs.captures += 1;
      return;

    // `ai_call` : reste au journal de la session, pas branché sur /admin › Coûts
  }
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value.slice(0, 500) : null;
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 0;
}
