import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { accesClasseDepuisDoc } from '@/lib/classe-acces';
import { classesDeLEleve } from '@/lib/session-server';
import { COLL_FICHIERS } from '@/lib/evaluations-fle-server';

// GET — le PDF d'une évaluation (base64 dans `fichiersFle`), servi en ligne.
// Un prof de la classe, ou un élève de la classe.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 });
  const { id } = await params;
  try {
    const doc = await adminDb.collection(COLL_FICHIERS).doc(id).get();
    if (!doc.exists) return NextResponse.json({ success: false, message: 'Introuvable' }, { status: 404 });
    const data = doc.data()!;
    const classeId = String(data.classeId ?? '');
    let autorise = false;
    if (auth.role === 'prof') {
      const classe = await adminDb.collection('classes').doc(classeId).get();
      autorise = classe.exists && !!accesClasseDepuisDoc(classe.data(), auth);
    } else {
      autorise = (await classesDeLEleve(auth.uid, auth.email)).includes(classeId);
    }
    if (!autorise) return NextResponse.json({ success: false, message: 'Accès refusé' }, { status: 403 });
    const buffer = Buffer.from(String(data.data ?? ''), 'base64');
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': String(data.mime ?? 'application/pdf'),
        'Content-Disposition': `inline; filename="${encodeURIComponent(String(data.nom ?? 'evaluation.pdf'))}"`,
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (error) {
    console.error('Erreur GET /api/fle/evaluations/fichier/[id]:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
