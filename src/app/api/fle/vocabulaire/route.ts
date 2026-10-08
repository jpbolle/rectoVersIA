import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { COLL_FLE } from '@/lib/daspalecte/mots';
import type { MotPersonnel } from '@/lib/daspalecte/mots';

// GET — la liste de vocabulaire FLE d'un élève (mots cliqués dans Daspalecte,
// vocabulaire des lectures de cours à venir) : `vocabulaireFle/{uid}`.
// Élève : la sienne ; prof : celle d'un élève (?studentId=uid).
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 });
  const studentId = new URL(request.url).searchParams.get('studentId');
  const uid = auth.role === 'prof' && studentId ? studentId : auth.uid;
  try {
    const doc = await adminDb.collection(COLL_FLE).doc(uid).get();
    const words = (doc.exists ? (doc.data()?.words as MotPersonnel[]) || [] : [])
      .filter((w) => w.word)
      .sort((a, b) => (b.lastSeenAt || b.addedAt || '').localeCompare(a.lastSeenAt || a.addedAt || ''));
    return NextResponse.json({ success: true, data: { words, updatedAt: doc.data()?.updatedAt || null } });
  } catch (error) {
    console.error('Erreur GET /api/fle/vocabulaire:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
