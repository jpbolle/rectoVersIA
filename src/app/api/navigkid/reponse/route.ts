import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { decrypt, encrypt } from '@/lib/crypto';

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  const questionnaireId = request.nextUrl.searchParams.get('questionnaireId');
  // Un élève ne peut lire que sa propre réponse
  const eleveId =
    auth.role === 'eleve' ? auth.uid : request.nextUrl.searchParams.get('eleveId');

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
        eleveNom: decrypt(data.eleveNom) || '',
        eleveEmail: decrypt(data.eleveEmail) || '',
        questions: data.questions || [],
        soumisLe: data.soumisLe?.toDate?.()?.toISOString?.() || '',
      },
    });
  } catch (error) {
    console.error('Erreur GET /api/navigkid/reponse:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

// POST - Soumettre les réponses de l'élève connecté (extension NavigKid)
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }
  if (auth.role !== 'eleve') {
    return NextResponse.json({ error: 'Réservé aux élèves' }, { status: 403 });
  }

  let body: { questionnaireId?: string; eleveNom?: string; questions?: unknown[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  if (!body.questionnaireId || !Array.isArray(body.questions)) {
    return NextResponse.json(
      { error: 'questionnaireId et questions[] requis' },
      { status: 400 }
    );
  }

  try {
    const questionnaireRef = adminDb.collection('questionnaires').doc(body.questionnaireId);
    const questionnaireSnap = await questionnaireRef.get();
    if (!questionnaireSnap.exists) {
      return NextResponse.json(
        { success: false, message: 'Questionnaire non trouvé' },
        { status: 404 }
      );
    }

    await questionnaireRef.collection('reponses').doc(auth.uid).set({
      eleveNom: encrypt(body.eleveNom || auth.email.split('@')[0]),
      eleveEmail: encrypt(auth.email),
      questions: body.questions,
      soumisLe: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur POST /api/navigkid/reponse:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
