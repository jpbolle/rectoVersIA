import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { COLL_LECTURES, chargerLecture, profPeutLire } from '@/lib/lecture-cours-server';
import { profilLinguistique } from '@/lib/niveaux-fle-server';

// Une lecture de cours.
//  GET    — son auteur (élève) ou un prof de sa classe FLE : le document entier
//  PATCH  — l'élève enregistre ses réponses (`reponses`, fusionnées par clé)
//  DELETE — l'élève supprime sa lecture

async function acces(
  auth: { uid: string; email: string; role: 'prof' | 'eleve' },
  id: string
): Promise<{ lecture: Awaited<ReturnType<typeof chargerLecture>>; statut: number; message?: string }> {
  const lecture = await chargerLecture(id);
  if (!lecture) return { lecture: null, statut: 404, message: 'Lecture introuvable' };
  if (auth.role === 'eleve') {
    if (lecture.eleveUid !== auth.uid) return { lecture: null, statut: 403, message: 'Cette lecture n’est pas la tienne' };
    return { lecture, statut: 200 };
  }
  if (!(await profPeutLire(auth, lecture.eleveId))) {
    return { lecture: null, statut: 403, message: 'Cet élève n’est pas dans vos classes' };
  }
  return { lecture, statut: 200 };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 });
  const { id } = await params;
  try {
    const r = await acces(auth, id);
    if (!r.lecture) return NextResponse.json({ success: false, message: r.message }, { status: r.statut });
    // Langue posée dans la fiche APRÈS l'import : la traduction au clic l'utilise
    // quand même (les sections, elles, restent telles qu'elles ont été générées)
    let lecture = r.lecture;
    if (!lecture.langue) {
      const profil = await profilLinguistique(lecture.eleveId);
      if (profil.langue) lecture = { ...lecture, langue: profil.langue };
    }
    return NextResponse.json({ success: true, data: lecture });
  } catch (error) {
    console.error('Erreur GET /api/fle/lectures/[id]:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 });
  if (auth.role !== 'eleve') {
    return NextResponse.json({ success: false, message: 'Accès réservé aux élèves' }, { status: 403 });
  }
  const { id } = await params;
  try {
    const r = await acces(auth, id);
    if (!r.lecture) return NextResponse.json({ success: false, message: r.message }, { status: r.statut });
    const body = await request.json();
    const reponses = body?.reponses;
    if (!reponses || typeof reponses !== 'object') {
      return NextResponse.json({ success: false, message: 'reponses requis' }, { status: 400 });
    }
    // Fusion clé par clé : une réponse n'écrase que la sienne
    const update: Record<string, unknown> = { updatedAt: new Date() };
    Object.entries(reponses as Record<string, unknown>).forEach(([cle, valeur]) => {
      if (/^[a-zA-Z0-9_-]{1,80}$/.test(cle)) update[`reponses.${cle}`] = valeur;
    });
    await adminDb.collection(COLL_LECTURES).doc(id).update(update);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur PATCH /api/fle/lectures/[id]:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 });
  if (auth.role !== 'eleve') {
    return NextResponse.json({ success: false, message: 'Accès réservé aux élèves' }, { status: 403 });
  }
  const { id } = await params;
  try {
    const r = await acces(auth, id);
    if (!r.lecture) return NextResponse.json({ success: false, message: r.message }, { status: r.statut });
    await adminDb.collection(COLL_LECTURES).doc(id).delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur DELETE /api/fle/lectures/[id]:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
