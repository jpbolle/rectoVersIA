import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { isAdmin } from '@/lib/auth-utils';

interface RouteParams {
  params: Promise<{ id: string }>;
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
