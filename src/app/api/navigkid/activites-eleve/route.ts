import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { queryElevesByEmail } from '@/lib/eleve-lookup';

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  try {
    // Trouver les classes de l'élève (empreinte puis clair)
    const elevesSnap = await queryElevesByEmail(auth.email);

    if (elevesSnap.empty) {
      return NextResponse.json({ success: true, data: [] });
    }

    const classeIds = elevesSnap.docs.map(doc => doc.data().classeId);

    // Résoudre les IDs en noms de classes
    const classeNames: string[] = [];
    for (const cId of classeIds) {
      const classeDoc = await adminDb.collection('classes').doc(cId).get();
      if (classeDoc.exists) {
        classeNames.push(classeDoc.data()?.nom);
      }
    }

    // Récupérer les devoirs de type "rechercher" disponibles
    const devoirsSnap = await adminDb
      .collection('devoirs')
      .where('typeTravail', '==', 'rechercher')
      .where('disponible', '==', true)
      .get();

    // Filtrer par classe de l'élève
    const activites = [];
    for (const doc of devoirsSnap.docs) {
      const data = doc.data();
      const devoirClasses = data.classes || [];
      if (!devoirClasses.some((c: string) => classeNames.includes(c))) continue;

      // Vérifier si l'élève a déjà soumis une réponse
      let soumis = false;
      if (data.questionnaireId) {
        const reponseDoc = await adminDb
          .collection('questionnaires')
          .doc(data.questionnaireId)
          .collection('reponses')
          .doc(auth.uid)
          .get();
        soumis = reponseDoc.exists;
      }

      activites.push({
        id: data.id || doc.id,
        intitule: data.intitule || '',
        grille: data.grille || '',
        dateRemise: data.dateRemise?.toDate?.()?.toISOString?.() || '',
        questionnaireId: data.questionnaireId || '',
        codeAcces: data.codeAcces || '',
        accesIA: data.accesIA ?? false,
        corrige: data.corrige ?? false,
        corrigeDisponible: data.corrigeDisponible ?? false,
        soumis,
      });
    }

    return NextResponse.json({ success: true, data: activites });
  } catch (error) {
    console.error('Erreur GET /api/navigkid/activites-eleve:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
