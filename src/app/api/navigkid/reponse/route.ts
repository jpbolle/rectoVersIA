import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  const questionnaireId = request.nextUrl.searchParams.get('questionnaireId');
  const eleveId = request.nextUrl.searchParams.get('eleveId');

  if (!questionnaireId || !eleveId) {
    return NextResponse.json({ error: 'questionnaireId et eleveId requis' }, { status: 400 });
  }

  try {
    const doc = await adminDb
      .collection('questionnaires')
      .doc(questionnaireId)
      .collection('reponses')
      .doc(eleveId)
      .get();

    if (!doc.exists) {
      return NextResponse.json({ success: true, data: null });
    }

    const data = doc.data()!;
    return NextResponse.json({
      success: true,
      data: {
        id: doc.id,
        eleveNom: data.eleveNom || '',
        eleveEmail: data.eleveEmail || '',
        questions: data.questions || [],
        soumisLe: data.soumisLe?.toDate?.()?.toISOString?.() || '',
      },
    });
  } catch (error) {
    console.error('Erreur GET /api/navigkid/reponse:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
