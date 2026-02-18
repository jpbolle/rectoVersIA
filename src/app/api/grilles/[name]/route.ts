import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { generateCriterionId } from '@/lib/grille-utils';
import type { Grille, GrilleCriterion } from '@/types/grille';

function docToGrille(doc: FirebaseFirestore.DocumentSnapshot): Grille {
  const data = doc.data()!;
  return {
    id: data.id || doc.id,
    name: data.name || '',
    description: data.description || '',
    uaa: data.uaa || [],
    profId: data.profId || '',
    anneeScolaire: data.anneeScolaire || '',
    archive: data.archive ?? false,
    criteria: (data.criteria || []).map((c: GrilleCriterion) => ({
      id: c.id || '',
      name: c.name || '',
      weight: c.weight || 1,
      order: c.order ?? 0,
      levels: (c.levels || []).map((l) => ({
        level: l.level ?? 0,
        indicators: l.indicators || [],
      })),
    })),
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || '',
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt || '',
  };
}

// GET - Recuperer une grille par ID (ou par nom pour retrocompat)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  try {
    const { name } = await params;
    const decodedName = decodeURIComponent(name);

    // D'abord essayer par ID
    const docById = await adminDb.collection('grilles').doc(decodedName).get();
    if (docById.exists) {
      return NextResponse.json({ success: true, data: docToGrille(docById) });
    }

    // Sinon chercher par nom (retrocompat)
    const snapshot = await adminDb
      .collection('grilles')
      .where('name', '==', decodedName)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json(
        { success: false, message: 'Grille non trouvee' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: docToGrille(snapshot.docs[0]) });
  } catch (error) {
    console.error('Erreur GET /api/grilles/[name]:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// PATCH - Modifier une grille
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const auth = await verifyAuth(request);
  if (!auth || auth.role !== 'prof') {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  try {
    const { name: id } = await params;
    const doc = await adminDb.collection('grilles').doc(id).get();

    if (!doc.exists) {
      return NextResponse.json(
        { success: false, message: 'Grille non trouvee' },
        { status: 404 }
      );
    }

    const existingData = doc.data()!;
    if (existingData.profId !== auth.uid) {
      return NextResponse.json(
        { success: false, message: 'Non autorise' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.uaa !== undefined) updateData.uaa = Array.isArray(body.uaa) ? body.uaa : [];
    if (body.archive !== undefined) updateData.archive = body.archive;

    if (body.criteria !== undefined && Array.isArray(body.criteria)) {
      updateData.criteria = body.criteria.map(
        (c: GrilleCriterion, index: number) => ({
          id: c.id || generateCriterionId(),
          name: c.name || '',
          weight: c.weight || 1,
          order: c.order ?? index,
          levels: (c.levels || []).map((l) => ({
            level: l.level ?? 0,
            indicators: l.indicators || [],
          })),
        })
      );
    }

    await adminDb.collection('grilles').doc(id).update(updateData);

    const updatedDoc = await adminDb.collection('grilles').doc(id).get();
    return NextResponse.json({ success: true, data: docToGrille(updatedDoc) });
  } catch (error) {
    console.error('Erreur PATCH /api/grilles/[name]:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// DELETE - Supprimer une grille
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const auth = await verifyAuth(request);
  if (!auth || auth.role !== 'prof') {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  try {
    const { name: id } = await params;
    const doc = await adminDb.collection('grilles').doc(id).get();

    if (!doc.exists) {
      return NextResponse.json(
        { success: false, message: 'Grille non trouvee' },
        { status: 404 }
      );
    }

    const existingData = doc.data()!;
    if (existingData.profId !== auth.uid) {
      return NextResponse.json(
        { success: false, message: 'Non autorise' },
        { status: 403 }
      );
    }

    await adminDb.collection('grilles').doc(id).delete();

    return NextResponse.json({
      success: true,
      message: 'Grille supprimee avec succes',
    });
  } catch (error) {
    console.error('Erreur DELETE /api/grilles/[name]:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
