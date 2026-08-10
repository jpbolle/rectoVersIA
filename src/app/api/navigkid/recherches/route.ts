import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { encrypt } from '@/lib/crypto';

// POST - Sauvegarder le tracking de recherche de l'élève connecté (extension NavigKid)
// recherches/{uid} : requêtes tapées et sites consultés, par question
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }
  if (auth.role !== 'eleve') {
    return NextResponse.json({ error: 'Réservé aux élèves' }, { status: 403 });
  }

  let body: { questionnaireId?: string; eleveNom?: string; parQuestion?: unknown[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  if (!body.questionnaireId || !Array.isArray(body.parQuestion)) {
    return NextResponse.json(
      { error: 'questionnaireId et parQuestion[] requis' },
      { status: 400 }
    );
  }

  try {
    await adminDb.collection('recherches').doc(auth.uid).set(
      {
        eleveNom: encrypt(body.eleveNom || auth.email.split('@')[0]),
        questionnaireId: body.questionnaireId,
        parQuestion: body.parQuestion,
      },
      { merge: true }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur POST /api/navigkid/recherches:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
