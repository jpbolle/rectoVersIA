import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';

// GET - Trouver une classe par son code (élève uniquement)
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json(
      { success: false, message: 'Non autorisé' },
      { status: 401 }
    );
  }

  const code = request.nextUrl.searchParams.get('code')?.toUpperCase().trim();
  if (!code) {
    return NextResponse.json(
      { success: false, message: 'Code requis' },
      { status: 400 }
    );
  }

  try {
    const snapshot = await adminDb
      .collection('classes')
      .where('code', '==', code)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json(
        { success: false, message: 'Aucune classe trouvée avec ce code' },
        { status: 404 }
      );
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    return NextResponse.json({
      success: true,
      data: {
        id: doc.id,
        nom: data.nom || '',
        description: data.description || '',
        anneeScolaire: data.anneeScolaire || '',
      },
    });
  } catch (error) {
    console.error('Erreur GET classe by code:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
