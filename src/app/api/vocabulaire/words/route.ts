import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import type { VocabulaireWord } from '@/types/vocabulaire';

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const themesParam = searchParams.get('themes');

    if (!themesParam) {
      return NextResponse.json(
        { success: false, message: 'Parametre "themes" requis (ex: ?themes=cognition,critique)' },
        { status: 400 }
      );
    }

    const themeNames = themesParam.split(',').map((t) => t.trim()).filter(Boolean);
    const allWords: Record<string, VocabulaireWord[]> = {};

    for (const themeName of themeNames) {
      const doc = await adminDb.collection('vocabulaire').doc(themeName).get();
      if (doc.exists) {
        const data = doc.data();
        allWords[themeName] = (data?.words || []) as VocabulaireWord[];
      }
    }

    return NextResponse.json({ success: true, data: allWords });
  } catch (error) {
    console.error('Erreur GET /api/vocabulaire/words:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
