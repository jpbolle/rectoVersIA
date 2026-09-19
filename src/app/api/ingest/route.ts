import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { hashEmail } from '@/lib/crypto';
import { getUserRole } from '@/lib/auth-utils';
import { queryElevesByEmail, uidParEmail } from '@/lib/eleve-lookup';
import { verifyGoogleAccessToken } from '@/lib/daspalecte/verify-google-token';
import { parseIngestBody } from '@/lib/daspalecte/schema';
import { ingestBatch } from '@/lib/daspalecte/write';

// POST — point d'entrée des traces de l'extension Daspalecte (élèves DASPA).
// Chemin imposé par l'extension, qui appelle `${adresse du site}/api/ingest`
// (analytics.js) : ne pas le déplacer sans republier l'extension.
//
// L'extension n'embarque pas le SDK Firebase (MV3 interdit le code distant) :
// elle envoie un jeton d'accès Google + un lot JSON (contrat de
// `src/lib/daspalecte/schema.ts`). Les appels partent de son service worker,
// qui a `<all_urls>` : pas de CORS à gérer.
//
// Réponses que l'extension sait interpréter :
//   401 token_*          → elle redemande un jeton et rejoue
//   403 unknown_account  → elle coupe le suivi (compte inscrit par aucun prof)
//   200                  → elle vide sa file d'attente

export async function POST(request: NextRequest) {
  const verification = await verifyGoogleAccessToken(request.headers.get('authorization'));
  if (!verification.ok) {
    return NextResponse.json({ error: `token_${verification.reason}` }, { status: 401 });
  }
  const email = verification.user.email;

  const parsed = parseIngestBody(await request.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    // Un prof qui essaie l'extension : 200 pour que sa file se vide sans rejouer
    if (getUserRole(email) === 'prof' || (await adminDb.collection('professeurs').doc(email).get()).exists) {
      return NextResponse.json({ ok: true, accepted: 0, ignored: 'not_a_student' });
    }

    // L'élève doit être inscrit dans une classe (fiche `eleves`)
    const eleves = await queryElevesByEmail(email);
    if (eleves.empty) {
      return NextResponse.json({ error: 'unknown_account', email }, { status: 403 });
    }

    const accepted = await ingestBatch(
      { email, emailHash: hashEmail(email), uid: await resoudreUid(eleves.docs, email) },
      parsed.body
    );
    return NextResponse.json({ ok: true, accepted });
  } catch (error) {
    console.error('Erreur POST /api/daspalecte/ingest:', error);
    // 500 : l'extension garde le lot et réessaiera
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

// L'uid Firebase de l'élève, s'il s'est déjà connecté à Recto-versIA : lié à sa
// fiche à la connexion, sinon retrouvé dans Firebase Auth. null = jamais connecté.
async function resoudreUid(
  docs: FirebaseFirestore.QueryDocumentSnapshot[],
  email: string
): Promise<string | null> {
  const lie = docs.map((d) => d.data().firebaseUid as string | undefined).find(Boolean);
  return lie || uidParEmail(email);
}
