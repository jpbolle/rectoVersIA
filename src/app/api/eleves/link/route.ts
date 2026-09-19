import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { queryElevesByEmail } from '@/lib/eleve-lookup';
import { verserMotsEnAttente } from '@/lib/daspalecte/mots';

// POST - Lier le firebaseUid d'un eleve connecte a son document dans la collection "eleves"
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json(
      { success: false, message: 'Non autorisé' },
      { status: 401 }
    );
  }

  if (auth.role !== 'eleve') {
    return NextResponse.json(
      { success: false, message: 'Réservé aux élèves' },
      { status: 403 }
    );
  }

  try {
    // Chercher les documents eleves avec le meme email (empreinte puis clair)
    const snapshot = await queryElevesByEmail(auth.email);

    if (snapshot.empty) {
      // Pas de document eleve correspondant — ce n'est pas une erreur bloquante
      return NextResponse.json({
        success: true,
        linked: false,
        message: 'Aucun document élève trouvé pour cet email',
      });
    }

    let linkedCount = 0;
    const batch = adminDb.batch();

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (!data.firebaseUid) {
        batch.update(doc.ref, { firebaseUid: auth.uid });
        linkedCount++;
      }
    });

    if (linkedCount > 0) {
      await batch.commit();
    }

    // Mots traduits avec Daspalecte avant sa première connexion : ils
    // attendaient l'uid de l'élève pour rejoindre sa liste personnelle.
    // Un échec ici ne doit pas empêcher la connexion.
    await verserMotsEnAttente(auth.uid, auth.email).catch((error) =>
      console.error('Versement des mots Daspalecte en attente:', error)
    );

    return NextResponse.json({
      success: true,
      linked: linkedCount > 0,
      linkedCount,
      message: linkedCount > 0
        ? `${linkedCount} document(s) élève lié(s)`
        : 'Documents élève déjà liés',
    });
  } catch (error) {
    console.error('Erreur POST /api/eleves/link:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
