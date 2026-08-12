import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';

// GET — élève : statut de remise de tous ses travaux, par devoir.
// Sert à la page /activites pour classer les activités corrigées entre
// « Travaux corrigés » (copie remise) et « Travaux non rendus ».
// Réponse : { [devoirId]: { status, excuse } }
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const snap = await adminDb
      .collection('travaux')
      .where('studentId', '==', auth.uid)
      .get();

    const map: Record<string, { status: string; nonRendu: string | null }> = {};
    for (const doc of snap.docs) {
      const data = doc.data();
      if (!data.devoirId) continue;
      map[data.devoirId] = {
        status: data.status || 'draft',
        nonRendu: data.nonRendu || null,
      };
    }

    return NextResponse.json({ success: true, data: map });
  } catch (error) {
    console.error('Erreur GET /api/travaux/status:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
