import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { accesClasseDepuisDoc, peutAgir } from '@/lib/classe-acces';
import { COLL_EVALUATIONS, COLL_FICHIERS, lireEvaluation } from '@/lib/evaluations-fle-server';

// DELETE — le prof retire une évaluation de sa classe (et son PDF s'il y en a un).
// L'activité rattachée, elle, n'est pas touchée.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 });
  if (auth.role !== 'prof') return NextResponse.json({ success: false, message: 'Accès réservé aux professeurs' }, { status: 403 });
  const { id } = await params;
  try {
    const doc = await adminDb.collection(COLL_EVALUATIONS).doc(id).get();
    if (!doc.exists) return NextResponse.json({ success: false, message: 'Introuvable' }, { status: 404 });
    const evaluation = lireEvaluation(doc.id, doc.data()!);
    const classe = await adminDb.collection('classes').doc(evaluation.classeId).get();
    const acces = classe.exists ? accesClasseDepuisDoc(classe.data(), auth) : null;
    if (!acces || !peutAgir(acces)) return NextResponse.json({ success: false, message: 'Classe inaccessible' }, { status: 403 });
    if (evaluation.source.kind === 'pdf') {
      await adminDb.collection(COLL_FICHIERS).doc(evaluation.source.fichierId).delete();
    }
    await doc.ref.delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur DELETE /api/fle/evaluations/[id]:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
