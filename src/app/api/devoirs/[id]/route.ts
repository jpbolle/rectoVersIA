import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const docRef = adminDb.collection('devoirs').doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json(
        { success: false, message: 'Devoir non trouve' },
        { status: 404 }
      );
    }

    const data = docSnap.data()!;

    // Les eleves ne peuvent voir que les devoirs disponibles
    if (auth.role === 'eleve' && !data.disponible) {
      return NextResponse.json(
        { success: false, message: 'Devoir non disponible' },
        { status: 403 }
      );
    }

    const devoir = {
      id: data.id || docSnap.id,
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

    return NextResponse.json({ success: true, data: devoir });
  } catch (error) {
    console.error('Erreur GET /api/devoirs/[id]:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  if (auth.role !== 'prof') {
    return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const docRef = adminDb.collection('devoirs').doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json(
        { success: false, message: 'Devoir non trouve' },
        { status: 404 }
      );
    }

    // Champs modifiables
    const updateData: Record<string, unknown> = {};

    if (body.disponible !== undefined) {
      updateData.disponible = body.disponible;
    }
    if (body.accesIA !== undefined) {
      updateData.accesIA = body.accesIA;
    }
    if (body.classes !== undefined) {
      updateData.classes = body.classes;
    }
    if (body.dateRemise !== undefined) {
      updateData.dateRemise = new Date(body.dateRemise);
    }
    if (body.grille !== undefined) {
      updateData.grille = body.grille;
    }
    if (body.intitule !== undefined) {
      updateData.intitule = body.intitule;
    }
    if (body.consignes !== undefined) {
      updateData.consignes = body.consignes;
    }
    if (body.ressources !== undefined) {
      updateData.ressources = body.ressources;
    }
    if (body.archive !== undefined) {
      updateData.archive = body.archive;
    }
    if (body.corrige !== undefined) {
      updateData.corrige = body.corrige;
    }
    if (body.corrigeDisponible !== undefined) {
      updateData.corrigeDisponible = body.corrigeDisponible;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, message: 'Aucune donnee a mettre a jour' },
        { status: 400 }
      );
    }

    await docRef.update(updateData);

    // Si corrigeDisponible change, bulk-set visibleParEleve sur toutes les corrections du devoir
    if (body.corrigeDisponible !== undefined) {
      const correctionsSnap = await adminDb
        .collection('corrections')
        .where('devoirId', '==', id)
        .get();

      if (!correctionsSnap.empty) {
        const batch = adminDb.batch();
        for (const doc of correctionsSnap.docs) {
          batch.update(doc.ref, { visibleParEleve: body.corrigeDisponible });
        }
        await batch.commit();
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Devoir mis a jour avec succes',
    });
  } catch (error) {
    console.error('Erreur PATCH /api/devoirs/[id]:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  if (auth.role !== 'prof') {
    return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const docRef = adminDb.collection('devoirs').doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json(
        { success: false, message: 'Devoir non trouve' },
        { status: 404 }
      );
    }

    await docRef.delete();

    return NextResponse.json({
      success: true,
      message: 'Devoir supprime avec succes',
    });
  } catch (error) {
    console.error('Erreur DELETE /api/devoirs/[id]:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
