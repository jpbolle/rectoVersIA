import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { isAdmin } from '@/lib/auth-utils';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH - Modifier la fiche d'un professeur (admin uniquement, 2026-10-11 :
// le crayon de la fiche). Prénom, nom, école, accès. L'ADRESSE ne change pas :
// elle est l'identifiant du document et celle de la connexion Google.
// L'école n'existe que pour un accès permanent (même règle qu'à la création).
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 });
  }
  if (!auth.isAdmin) {
    return NextResponse.json({ success: false, message: 'Accès réservé à l\'administrateur' }, { status: 403 });
  }

  const { id } = await params;
  try {
    const docRef = adminDb.collection('professeurs').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json({ success: false, message: 'Professeur non trouvé' }, { status: 404 });
    }
    const body = await request.json();
    const update: Record<string, unknown> = {};
    if (body.nom !== undefined) {
      const nom = typeof body.nom === 'string' ? body.nom.trim().slice(0, 80) : '';
      if (!nom) return NextResponse.json({ success: false, message: 'Le nom est requis' }, { status: 400 });
      update.nom = nom;
    }
    if (body.prenom !== undefined) {
      const prenom = typeof body.prenom === 'string' ? body.prenom.trim().slice(0, 80) : '';
      if (!prenom) return NextResponse.json({ success: false, message: 'Le prénom est requis' }, { status: 400 });
      update.prenom = prenom;
    }
    if (body.expiresAt !== undefined) {
      const iso = typeof body.expiresAt === 'string' && !Number.isNaN(new Date(body.expiresAt).getTime()) ? body.expiresAt : null;
      update.expiresAt = iso;
    }
    const permanent = (update.expiresAt !== undefined ? update.expiresAt : doc.data()?.expiresAt) == null;
    if (body.ecole !== undefined || !permanent) {
      update.ecole = permanent && typeof body.ecole === 'string' ? body.ecole.trim().slice(0, 120) : permanent ? doc.data()?.ecole ?? '' : '';
    }
    await docRef.update(update);
    const apres = await docRef.get();
    return NextResponse.json({ success: true, data: { id: apres.id, ...apres.data() } });
  } catch (error) {
    console.error('Erreur PATCH professeur:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

// DELETE - Supprimer un professeur (admin uniquement)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 });
  }

  if (!auth.isAdmin) {
    return NextResponse.json({ success: false, message: 'Accès réservé à l\'administrateur' }, { status: 403 });
  }

  const { id } = await params;

  // Empêcher la suppression de l'admin lui-même
  if (isAdmin(id)) {
    return NextResponse.json(
      { success: false, message: 'Impossible de supprimer le compte administrateur' },
      { status: 400 }
    );
  }

  try {
    const docRef = adminDb.collection('professeurs').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { success: false, message: 'Professeur non trouvé' },
        { status: 404 }
      );
    }

    await docRef.delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur DELETE professeur:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
