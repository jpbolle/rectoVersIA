import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { encrypt } from '@/lib/crypto';

// ── Vocabulaire personnel de l'élève ──
// vocabulairePersonnel/{uid} : mots dont l'élève a demandé la définition
// (app Recto-versIA via /api/dictionary, extension NavigKid via POST ici).

interface MotRecu {
  word?: string;
  definition?: string;
}

// GET — élève : sa liste ; prof : celle d'un élève (?studentId=uid)
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get('studentId');

  // Un élève ne peut lire que sa propre liste
  const uid = auth.role === 'prof' && studentId ? studentId : auth.uid;

  try {
    const doc = await adminDb.collection('vocabulairePersonnel').doc(uid).get();
    const data = doc.exists ? doc.data() : null;
    return NextResponse.json({
      success: true,
      data: {
        words: data?.words || [],
        updatedAt: data?.updatedAt || null,
      },
    });
  } catch (error) {
    console.error('Erreur GET /api/vocabulaire/personnel:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

// POST — ajouter des mots (extension NavigKid) : { words: [{ word, definition }] }
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  if (auth.role !== 'eleve') {
    return NextResponse.json({ error: 'Réservé aux élèves' }, { status: 403 });
  }

  let body: { words?: MotRecu[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const recus = (body.words || [])
    .filter((m) => typeof m.word === 'string' && m.word.trim().length >= 2)
    .slice(0, 100);

  if (recus.length === 0) {
    return NextResponse.json({ success: true, added: 0 });
  }

  try {
    const ref = adminDb.collection('vocabulairePersonnel').doc(auth.uid);
    const doc = await ref.get();
    const words: Array<{ word?: string }> = (doc.exists ? doc.data()?.words : []) || [];
    const existants = new Set(words.map((w) => (w.word || '').toLowerCase()));

    let added = 0;
    for (const m of recus) {
      const normalized = m.word!.trim().toLowerCase().slice(0, 50);
      if (existants.has(normalized)) continue;
      existants.add(normalized);
      words.push({
        word: normalized,
        definition: (m.definition || '').slice(0, 500),
        example: '',
        addedAt: new Date().toISOString(),
      } as { word: string });
      added++;
    }

    if (added > 0) {
      await ref.set(
        { studentEmail: encrypt(auth.email), words, updatedAt: new Date().toISOString() },
        { merge: true }
      );
    }

    return NextResponse.json({ success: true, added });
  } catch (error) {
    console.error('Erreur POST /api/vocabulaire/personnel:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
