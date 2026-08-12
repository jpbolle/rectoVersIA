import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import type { Classe } from '@/types/classe';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Récupérer une classe
export async function GET(request: NextRequest, { params }: RouteParams) {
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
    const { id } = await params;
    const doc = await adminDb.collection('classes').doc(id).get();

    if (!doc.exists) {
      return NextResponse.json(
        { success: false, message: 'Classe non trouvée' },
        { status: 404 }
      );
    }

    const data = doc.data()!;

    // Vérifier que le prof est propriétaire
    if (data.profId !== auth.uid) {
      return NextResponse.json(
        { success: false, message: 'Non autorisé' },
        { status: 403 }
      );
    }

    const classe: Classe = {
      id: doc.id,
      nom: data.nom || '',
      description: data.description || '',
      profId: data.profId || '',
      anneeScolaire: data.anneeScolaire || '',
      archive: data.archive || false,
      googleClassroomId: data.googleClassroomId,
      createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || '',
      updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt || '',
    };

    return NextResponse.json({ success: true, data: classe });
  } catch (error) {
    console.error('Erreur GET classe:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// PATCH - Modifier une classe
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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
    const { id } = await params;
    const doc = await adminDb.collection('classes').doc(id).get();

    if (!doc.exists) {
      return NextResponse.json(
        { success: false, message: 'Classe non trouvée' },
        { status: 404 }
      );
    }

    const data = doc.data()!;
    if (data.profId !== auth.uid) {
      return NextResponse.json(
        { success: false, message: 'Non autorisé' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const now = new Date();
    const updates: Record<string, unknown> = {
      updatedAt: now,
    };

    if (body.nom !== undefined) updates.nom = body.nom.trim();
    if (body.description !== undefined) updates.description = body.description.trim();
    if (body.archive !== undefined) updates.archive = body.archive;

    await adminDb.collection('classes').doc(id).update(updates);

    // Les devoirs référencent les classes par NOM : un renommage doit se
    // propager, sinon les devoirs existants deviennent invisibles pour les
    // élèves (incident forcoGosselies → forcoBraine, 2026-08-12).
    const newNom = updates.nom as string | undefined;
    if (newNom && newNom !== data.nom) {
      // Requête par profId seul (index simple), filtre du nom en code — pas
      // d'index composite requis
      const devoirsSnap = await adminDb
        .collection('devoirs')
        .where('profId', '==', auth.uid)
        .get();
      const toUpdate = devoirsSnap.docs.filter((d) =>
        Array.isArray(d.data().classes) && d.data().classes.includes(data.nom)
      );
      if (toUpdate.length > 0) {
        const batch = adminDb.batch();
        for (const devoirDoc of toUpdate) {
          const classes = (devoirDoc.data().classes as string[]).map((n) =>
            n === data.nom ? newNom : n
          );
          batch.update(devoirDoc.ref, { classes });
        }
        await batch.commit();
      }
    }

    const updatedClasse: Classe = {
      id,
      nom: (updates.nom as string) ?? data.nom,
      description: (updates.description as string) ?? data.description ?? '',
      profId: data.profId,
      anneeScolaire: data.anneeScolaire,
      archive: (updates.archive as boolean) ?? data.archive ?? false,
      googleClassroomId: data.googleClassroomId,
      createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || '',
      updatedAt: now.toISOString(),
    };

    return NextResponse.json({ success: true, data: updatedClasse });
  } catch (error) {
    console.error('Erreur PATCH classe:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// DELETE - Supprimer une classe (et ses élèves)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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
    const { id } = await params;
    const doc = await adminDb.collection('classes').doc(id).get();

    if (!doc.exists) {
      return NextResponse.json(
        { success: false, message: 'Classe non trouvée' },
        { status: 404 }
      );
    }

    const data = doc.data()!;
    if (data.profId !== auth.uid) {
      return NextResponse.json(
        { success: false, message: 'Non autorisé' },
        { status: 403 }
      );
    }

    // Supprimer tous les élèves de la classe
    const elevesSnapshot = await adminDb
      .collection('eleves')
      .where('classeId', '==', id)
      .get();

    const batch = adminDb.batch();
    elevesSnapshot.forEach((eleveDoc) => {
      batch.delete(eleveDoc.ref);
    });
    batch.delete(adminDb.collection('classes').doc(id));
    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur DELETE classe:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
