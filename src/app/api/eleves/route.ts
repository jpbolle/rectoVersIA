import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { generateEleveId } from '@/lib/classe-utils';
import type { Eleve, CreateEleveData } from '@/types/classe';

// GET - Liste des élèves (par classeId en query param)
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json(
      { success: false, message: 'Non autorisé' },
      { status: 401 }
    );
  }

  if (auth.role !== 'prof') {
    return NextResponse.json(
      { success: false, message: 'Accès refusé' },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const classeId = searchParams.get('classeId');

    if (classeId) {
      // Vérifier que la classe existe et appartient au prof
      const classeDoc = await adminDb.collection('classes').doc(classeId).get();
      if (!classeDoc.exists) {
        return NextResponse.json(
          { success: false, message: 'Classe non trouvée' },
          { status: 404 }
        );
      }
      const classeData = classeDoc.data();
      if (classeData?.profId !== auth.uid) {
        return NextResponse.json(
          { success: false, message: 'Non autorisé' },
          { status: 403 }
        );
      }

      const snapshot = await adminDb
        .collection('eleves')
        .where('classeId', '==', classeId)
        .get();

      const eleves: Eleve[] = snapshot.docs
        .map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            nom: data.nom || '',
            prenom: data.prenom || '',
            email: data.email || '',
            classeId: data.classeId || '',
            googleClassroomId: data.googleClassroomId,
            firebaseUid: data.firebaseUid,
            createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || '',
          };
        })
        .sort((a, b) => a.nom.localeCompare(b.nom));

      return NextResponse.json({ success: true, data: eleves });
    }

    // Sinon, récupérer tous les élèves de toutes les classes du prof
    const classesSnapshot = await adminDb
      .collection('classes')
      .where('profId', '==', auth.uid)
      .get();

    const classeIds = classesSnapshot.docs.map((doc) => doc.id);

    if (classeIds.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Firestore limite "in" à 30 éléments
    const allEleves: Eleve[] = [];
    for (let i = 0; i < classeIds.length; i += 30) {
      const chunk = classeIds.slice(i, i + 30);
      const snapshot = await adminDb
        .collection('eleves')
        .where('classeId', 'in', chunk)
        .get();

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        allEleves.push({
          id: doc.id,
          nom: data.nom || '',
          prenom: data.prenom || '',
          email: data.email || '',
          classeId: data.classeId || '',
          googleClassroomId: data.googleClassroomId,
          firebaseUid: data.firebaseUid,
          createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || '',
        });
      });
    }

    // Trier côté JavaScript
    allEleves.sort((a, b) => a.nom.localeCompare(b.nom));

    return NextResponse.json({ success: true, data: allEleves });
  } catch (error) {
    console.error('Erreur GET eleves:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// POST - Créer un élève
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json(
      { success: false, message: 'Non autorisé' },
      { status: 401 }
    );
  }

  if (auth.role !== 'prof') {
    return NextResponse.json(
      { success: false, message: 'Accès refusé' },
      { status: 403 }
    );
  }

  try {
    const body: CreateEleveData = await request.json();

    if (!body.nom || !body.prenom || !body.email || !body.classeId) {
      return NextResponse.json(
        { success: false, message: 'Tous les champs sont requis' },
        { status: 400 }
      );
    }

    // Vérifier que la classe existe et appartient au prof
    const classeDoc = await adminDb.collection('classes').doc(body.classeId).get();
    if (!classeDoc.exists) {
      return NextResponse.json(
        { success: false, message: 'Classe non trouvée' },
        { status: 404 }
      );
    }
    const classeData = classeDoc.data();
    if (classeData?.profId !== auth.uid) {
      return NextResponse.json(
        { success: false, message: 'Non autorisé' },
        { status: 403 }
      );
    }

    const eleveId = generateEleveId();
    const now = new Date();

    const eleve = {
      nom: body.nom.trim(),
      prenom: body.prenom.trim(),
      email: body.email.trim().toLowerCase(),
      classeId: body.classeId,
      createdAt: now,
    };

    await adminDb.collection('eleves').doc(eleveId).set(eleve);

    return NextResponse.json({
      success: true,
      data: {
        id: eleveId,
        ...eleve,
        createdAt: now.toISOString(),
      },
    });
  } catch (error) {
    console.error('Erreur POST eleve:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
