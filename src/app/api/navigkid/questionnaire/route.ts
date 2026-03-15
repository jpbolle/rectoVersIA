import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id requis' }, { status: 400 });
  }

  try {
    const doc = await adminDb.collection('questionnaires').doc(id).get();
    if (!doc.exists) {
      return NextResponse.json({ success: false, message: 'Questionnaire non trouve' }, { status: 404 });
    }

    const data = doc.data()!;
    return NextResponse.json({
      success: true,
      data: {
        id: doc.id,
        titre: data.titre || '',
        theme: data.theme || '',
        consignes: data.consignes || '',
        questions: data.questions || [],
        codeAcces: data.codeAcces || '',
        profId: data.profId || '',
        devoirId: data.devoirId || '',
      },
    });
  } catch (error) {
    console.error('Erreur GET /api/navigkid/questionnaire:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
