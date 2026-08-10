import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { decrypt, decryptFields, encrypt, hashEmail, SENSITIVE_ELEVE_FIELDS } from '@/lib/crypto';
import type { Eleve } from '@/types/classe';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Récupérer un élève
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
    const doc = await adminDb.collection('eleves').doc(id).get();

    if (!doc.exists) {
      return NextResponse.json(
        { success: false, message: 'Élève non trouvé' },
        { status: 404 }
      );
    }

    const data = decryptFields(doc.data()!, SENSITIVE_ELEVE_FIELDS);

    // Vérifier que le prof est propriétaire de la classe
    const classeDoc = await adminDb.collection('classes').doc(data.classeId).get();
    if (!classeDoc.exists || classeDoc.data()?.profId !== auth.uid) {
      return NextResponse.json(
        { success: false, message: 'Non autorisé' },
        { status: 403 }
      );
    }

    const eleve: Eleve = {
      id: doc.id,
      nom: data.nom || '',
      prenom: data.prenom || '',
      email: data.email || '',
      classeId: data.classeId || '',
      googleClassroomId: data.googleClassroomId,
      createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || '',
    };

    return NextResponse.json({ success: true, data: eleve });
  } catch (error) {
    console.error('Erreur GET eleve:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// PATCH - Modifier un élève
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
    const doc = await adminDb.collection('eleves').doc(id).get();

    if (!doc.exists) {
      return NextResponse.json(
        { success: false, message: 'Élève non trouvé' },
        { status: 404 }
      );
    }

    const data = doc.data()!;

    // Vérifier que le prof est propriétaire de la classe
    const classeDoc = await adminDb.collection('classes').doc(data.classeId).get();
    if (!classeDoc.exists || classeDoc.data()?.profId !== auth.uid) {
      return NextResponse.json(
        { success: false, message: 'Non autorisé' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const clearUpdates: Record<string, string> = {};

    if (body.nom !== undefined) clearUpdates.nom = body.nom.trim();
    if (body.prenom !== undefined) clearUpdates.prenom = body.prenom.trim();
    if (body.email !== undefined) clearUpdates.email = body.email.trim().toLowerCase();

    const updates: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(clearUpdates)) {
      updates[field] = encrypt(value);
    }
    if (clearUpdates.email !== undefined) {
      updates.emailHash = hashEmail(clearUpdates.email);
    }

    await adminDb.collection('eleves').doc(id).update(updates);

    const updatedEleve: Eleve = {
      id,
      nom: clearUpdates.nom ?? decrypt(data.nom),
      prenom: clearUpdates.prenom ?? decrypt(data.prenom),
      email: clearUpdates.email ?? decrypt(data.email),
      classeId: data.classeId,
      googleClassroomId: data.googleClassroomId,
      createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || '',
    };

    return NextResponse.json({ success: true, data: updatedEleve });
  } catch (error) {
    console.error('Erreur PATCH eleve:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// DELETE - Supprimer un élève
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
    const doc = await adminDb.collection('eleves').doc(id).get();

    if (!doc.exists) {
      return NextResponse.json(
        { success: false, message: 'Élève non trouvé' },
        { status: 404 }
      );
    }

    const data = doc.data()!;

    // Vérifier que le prof est propriétaire de la classe
    const classeDoc = await adminDb.collection('classes').doc(data.classeId).get();
    if (!classeDoc.exists || classeDoc.data()?.profId !== auth.uid) {
      return NextResponse.json(
        { success: false, message: 'Non autorisé' },
        { status: 403 }
      );
    }

    const classeId = data.classeId;

    // Supprimer le doc racine
    await adminDb.collection('eleves').doc(id).delete();

    // Supprimer le doc dans la sous-collection de la classe (documents legacy, email en clair)
    if (classeId) {
      const subDocs = await adminDb
        .collection('classes')
        .doc(classeId)
        .collection('eleves')
        .where('email', '==', decrypt(data.email)?.toLowerCase?.() || '')
        .get();

      const batch = adminDb.batch();
      subDocs.docs.forEach((d) => batch.delete(d.ref));
      if (!subDocs.empty) await batch.commit();
    }

    // Supprimer le doc users/{firebaseUid} si lié
    if (data.firebaseUid) {
      try {
        await adminDb.collection('users').doc(data.firebaseUid).delete();
      } catch {
        // Silently fail — le doc users peut ne pas exister
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur DELETE eleve:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
