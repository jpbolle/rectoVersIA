import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { queryElevesByEmail } from '@/lib/eleve-lookup';

// GET - Liste des classes de l'élève connecté
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json(
      { success: false, message: 'Non autorisé' },
      { status: 401 }
    );
  }

  try {
    // Trouver les docs eleve liés à cet utilisateur (par firebaseUid ou email)
    const byUid = await adminDb
      .collection('eleves')
      .where('firebaseUid', '==', auth.uid)
      .get();

    const byEmail = await queryElevesByEmail(auth.email);

    // Fusionner et dédupliquer par classeId
    const classeIds = new Set<string>();
    [...byUid.docs, ...byEmail.docs].forEach((doc) => {
      const classeId = doc.data().classeId;
      if (classeId) classeIds.add(classeId);
    });

    if (classeIds.size === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Charger les classes (par batches de 30 pour Firestore)
    const classeIdArray = Array.from(classeIds);
    const classes = [];

    for (let i = 0; i < classeIdArray.length; i += 30) {
      const batch = classeIdArray.slice(i, i + 30);
      const snapshot = await adminDb
        .collection('classes')
        .where('__name__', 'in', batch)
        .get();

      for (const doc of snapshot.docs) {
        const data = doc.data();
        classes.push({
          id: doc.id,
          nom: data.nom || '',
          description: data.description || '',
          anneeScolaire: data.anneeScolaire || '',
          archive: data.archive || false,
        });
      }
    }

    classes.sort((a, b) => a.nom.localeCompare(b.nom));

    return NextResponse.json({ success: true, data: classes });
  } catch (error) {
    console.error('Erreur GET student classes:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
