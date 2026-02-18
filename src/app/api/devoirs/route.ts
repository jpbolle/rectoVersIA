import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { calculateSchoolYear } from '@/lib/auth-utils';
import { generateDevoirId } from '@/lib/devoir-utils';

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  try {
    let snapshot;
    try {
      snapshot = await adminDb
        .collection('devoirs')
        .orderBy('dateRemise', 'desc')
        .get();
    } catch (queryError: unknown) {
      // Collection vide ou inexistante
      const error = queryError as { code?: number };
      if (error.code === 5) {
        return NextResponse.json({ success: true, data: [] });
      }
      throw queryError;
    }

    let devoirs = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: data.id || doc.id,
        classes: data.classes || [],
        dateRemise: data.dateRemise?.toDate?.()?.toISOString?.() || data.dateRemise || '',
        grille: data.grille || '',
        intitule: data.intitule || '',
        consignes: data.consignes || '',
        ressources: data.ressources || null,
        accesIA: data.accesIA ?? false,
        disponible: data.disponible ?? true,
        archive: data.archive ?? false,
        corrige: data.corrige ?? false,
        corrigeDisponible: data.corrigeDisponible ?? false,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || '',
        anneeScolaire: data.anneeScolaire || '',
        profId: data.profId || '',
      };
    });

    // Les eleves ne voient que les devoirs disponibles ET assignes a leur(s) classe(s)
    if (auth.role === 'eleve') {
      const email = auth.email.toLowerCase().trim();
      const elevesSnap = await adminDb
        .collection('eleves')
        .where('email', '==', email)
        .get();
      const classeIds = elevesSnap.docs.map((doc) => doc.data().classeId);

      // devoir.classes contient des noms ("Formation"), eleve.classeId contient des IDs
      // → résoudre les IDs en noms de classes
      const classeNames: string[] = [];
      for (const cId of classeIds) {
        const classeDoc = await adminDb.collection('classes').doc(cId).get();
        if (classeDoc.exists) {
          classeNames.push(classeDoc.data()?.nom);
        }
      }

      devoirs = devoirs.filter(
        (d) => d.disponible === true && d.classes.some((c: string) => classeNames.includes(c))
      );
    }

    return NextResponse.json({ success: true, data: devoirs });
  } catch (error) {
    console.error('Erreur GET /api/devoirs:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  if (auth.role !== 'prof') {
    return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      classes,
      dateRemise,
      grille,
      intitule,
      consignes,
      ressources,
      accesIA,
      disponible,
    } = body;

    // Validation des champs requis
    if (!classes || !Array.isArray(classes) || classes.length === 0 || !dateRemise || !grille || !intitule) {
      return NextResponse.json(
        { success: false, message: 'Au moins une classe, date de remise, grille et intitulé requis' },
        { status: 400 }
      );
    }

    const id = generateDevoirId();
    const anneeScolaire = calculateSchoolYear();

    await adminDb.collection('devoirs').doc(id).set({
      id,
      classes,
      dateRemise: new Date(dateRemise),
      grille,
      intitule,
      consignes: consignes || '',
      ressources: ressources || null,
      accesIA: accesIA ?? false,
      disponible: disponible ?? true,
      archive: false,
      corrige: false,
      corrigeDisponible: false,
      createdAt: new Date(),
      anneeScolaire,
      profId: auth.uid,
    });

    return NextResponse.json({
      success: true,
      data: { id },
      message: `Devoir "${intitule}" cree avec succes`,
    });
  } catch (error) {
    console.error('Erreur POST /api/devoirs:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
