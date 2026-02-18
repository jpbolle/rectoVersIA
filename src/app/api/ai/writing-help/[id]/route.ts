import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';

// PATCH : Marquer une suggestion comme traitée (dismissed)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { id } = await params;

  let body: { itemId: string; dismissed: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const { itemId, dismissed } = body;
  if (!itemId || typeof dismissed !== 'boolean') {
    return NextResponse.json({ error: 'itemId et dismissed requis' }, { status: 400 });
  }

  try {
    const docRef = adminDb.collection('aiSuggestions').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Suggestion non trouvée' }, { status: 404 });
    }

    const data = doc.data()!;

    // Vérifier que l'élève est bien le propriétaire
    if (data.studentId !== auth.uid) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    // Mettre à jour l'item spécifique
    const updatedSuggestions = data.suggestions.map(
      (s: { id: string; dismissed: boolean }) =>
        s.id === itemId ? { ...s, dismissed } : s
    );

    await docRef.update({ suggestions: updatedSuggestions });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Erreur PATCH aiSuggestion:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
