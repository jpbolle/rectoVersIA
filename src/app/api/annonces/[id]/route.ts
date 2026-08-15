import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';

// Retrait d'une annonce. Une annonce sort d'elle-même de la cloche au bout de
// 14 jours (fenêtre de /api/notifications) — cette suppression sert à retirer
// tout de suite un message envoyé par erreur.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(request);
  if (!auth || !auth.isAdmin) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const { id } = await params;
    await adminDb.collection('annonces').doc(id).delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur DELETE /api/annonces/[id]:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
