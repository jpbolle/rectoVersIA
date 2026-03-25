import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';

// GET - Retourne les corrections de l'élève connecté (devoirId + visibleParEleve)
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  if (auth.role !== 'eleve') {
    return NextResponse.json({ error: 'Acces reserve aux eleves' }, { status: 403 });
  }

  try {
    const snapshot = await adminDb
      .collection('corrections')
      .where('studentId', '==', auth.uid)
      .get();

    const data = snapshot.docs.map((doc) => ({
      devoirId: doc.data().devoirId as string,
      visibleParEleve: doc.data().visibleParEleve === true,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Erreur GET /api/corrections/mine:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
