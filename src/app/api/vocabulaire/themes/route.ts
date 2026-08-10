import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { decrypt } from '@/lib/crypto';
import type { VocabulaireWord } from '@/types/vocabulaire';

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  try {
    const snapshot = await adminDb.collection('vocabulaire').get();

    // Recuperer les noms des profs pour les listes des autres
    const profIds = new Set<string>();
    snapshot.docs.forEach((doc) => {
      const createdBy = doc.data().createdBy;
      if (createdBy && createdBy !== auth.uid) profIds.add(createdBy);
    });

    const profNames: Record<string, string> = {};
    if (profIds.size > 0) {
      const usersSnap = await adminDb.collection('users')
        .where('__name__', 'in', Array.from(profIds).slice(0, 10))
        .get();
      usersSnap.docs.forEach((doc) => {
        const d = doc.data();
        profNames[doc.id] = decrypt(d.displayName) || decrypt(d.email) || 'Professeur';
      });
    }

    const themes = snapshot.docs.map((doc) => {
      const data = doc.data();
      const createdBy = data.createdBy || null;
      return {
        id: doc.id,
        name: data.name || doc.id,
        wordCount: Array.isArray(data.words) ? data.words.length : 0,
        profId: createdBy,
        profName: createdBy && createdBy !== auth.uid
          ? (profNames[createdBy] || 'Professeur')
          : undefined,
        targetLevels: data.targetLevels || undefined,
      };
    });

    return NextResponse.json({ success: true, data: themes });
  } catch (error) {
    console.error('Erreur GET /api/vocabulaire/themes:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// Creer une nouvelle liste de vocabulaire
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth || auth.role !== 'prof') {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, words, targetLevels } = body as { name: string; words?: VocabulaireWord[]; targetLevels?: string[] };

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, message: 'Nom de la liste requis' },
        { status: 400 }
      );
    }

    const docId = name.trim().toLowerCase().replace(/\s+/g, '-');

    // Verifier si la liste existe deja
    const existing = await adminDb.collection('vocabulaire').doc(docId).get();
    if (existing.exists) {
      return NextResponse.json(
        { success: false, message: 'Une liste avec ce nom existe déjà' },
        { status: 409 }
      );
    }

    await adminDb.collection('vocabulaire').doc(docId).set({
      name: name.trim(),
      words: words || [],
      createdBy: auth.uid,
      createdAt: new Date().toISOString(),
      ...(targetLevels && { targetLevels }),
    });

    return NextResponse.json({ success: true, id: docId });
  } catch (error) {
    console.error('Erreur POST /api/vocabulaire/themes:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// Mettre a jour une liste de vocabulaire (mots)
export async function PUT(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth || auth.role !== 'prof') {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, words, meta } = body as {
      id: string;
      words?: VocabulaireWord[];
      meta?: { targetLevels?: string[] };
    };

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'ID requis' },
        { status: 400 }
      );
    }

    const docRef = adminDb.collection('vocabulaire').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json(
        { success: false, message: 'Liste introuvable' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (words && Array.isArray(words)) {
      updateData.words = words;
    }
    if (meta) {
      if (meta.targetLevels !== undefined) updateData.targetLevels = meta.targetLevels;
    }

    await docRef.update(updateData);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur PUT /api/vocabulaire/themes:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// Supprimer une liste de vocabulaire
export async function DELETE(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth || auth.role !== 'prof') {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Parametre "id" requis' },
        { status: 400 }
      );
    }

    const docRef = adminDb.collection('vocabulaire').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json(
        { success: false, message: 'Liste introuvable' },
        { status: 404 }
      );
    }

    await docRef.delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur DELETE /api/vocabulaire/themes:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
