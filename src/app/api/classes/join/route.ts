import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { generateEleveId } from '@/lib/classe-utils';
import { encryptFields, hashEmail, SENSITIVE_ELEVE_FIELDS } from '@/lib/crypto';
import { queryElevesByEmail } from '@/lib/eleve-lookup';

// POST - Rejoindre une classe via son code
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json(
      { success: false, message: 'Non autorisé' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const code = (body.code || '').toUpperCase().replace(/\s/g, '');
    const nom = (body.nom || '').trim();
    const prenom = (body.prenom || '').trim();

    if (!code) {
      return NextResponse.json(
        { success: false, message: 'Code requis' },
        { status: 400 }
      );
    }

    if (!nom || !prenom) {
      return NextResponse.json(
        { success: false, message: 'Nom et prénom requis' },
        { status: 400 }
      );
    }

    // Trouver la classe par son code
    const classeSnapshot = await adminDb
      .collection('classes')
      .where('code', '==', code)
      .limit(1)
      .get();

    if (classeSnapshot.empty) {
      return NextResponse.json(
        { success: false, message: 'Aucune classe trouvée avec ce code' },
        { status: 404 }
      );
    }

    const classeDoc = classeSnapshot.docs[0];
    const classeId = classeDoc.id;

    // Vérifier si l'élève est déjà dans cette classe (empreinte puis clair)
    const existingByEmail = await queryElevesByEmail(auth.email, classeId);

    if (!existingByEmail.empty) {
      // Déjà membre — s'assurer que le firebaseUid est lié
      const existingDoc = existingByEmail.docs[0];
      if (!existingDoc.data().firebaseUid) {
        await existingDoc.ref.update({ firebaseUid: auth.uid });
      }
      return NextResponse.json({
        success: true,
        message: 'Tu fais déjà partie de cette classe',
        data: { classeId, classeName: classeDoc.data().nom },
      });
    }

    // Créer le doc eleve
    const eleveId = generateEleveId();
    const now = new Date().toISOString();

    await adminDb.collection('eleves').doc(eleveId).set({
      ...encryptFields(
        { nom, prenom, email: auth.email.toLowerCase() },
        SENSITIVE_ELEVE_FIELDS
      ),
      emailHash: hashEmail(auth.email),
      classeId,
      firebaseUid: auth.uid,
      createdAt: now,
    });

    return NextResponse.json({
      success: true,
      message: `Tu as rejoint la classe ${classeDoc.data().nom}`,
      data: { classeId, classeName: classeDoc.data().nom },
    });
  } catch (error) {
    console.error('Erreur POST join classe:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
