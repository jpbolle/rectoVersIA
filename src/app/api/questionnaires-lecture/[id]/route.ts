import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { sanitizeLectureQuiz } from '@/lib/lecture-server';
import { lireQuestionnaire, quizPourFirestore } from '@/lib/questionnaire-lecture-server';

const COLLECTION = 'questionnairesLecture';

// GET — un questionnaire complet (contenu compris), pour l'éditer.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 });
  }
  if (auth.role !== 'prof') {
    return NextResponse.json({ success: false, message: 'Accès refusé' }, { status: 403 });
  }

  const { id } = await params;
  try {
    const q = await lireQuestionnaire(id);
    if (!q) {
      return NextResponse.json({ success: false, message: 'Introuvable' }, { status: 404 });
    }
    // Le sien, ou un exemple partagé qu'il peut lire (et dupliquer) sans
    // pouvoir le modifier — même doctrine que les grilles.
    if (q.profId !== auth.uid && !q.shared) {
      return NextResponse.json({ success: false, message: 'Accès refusé' }, { status: 403 });
    }
    return NextResponse.json({ success: true, data: q });
  } catch (error) {
    console.error('Erreur GET /api/questionnaires-lecture/[id]:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

// PATCH — nom, description, archivage, contenu.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 });
  }

  const { id } = await params;
  try {
    const ref = adminDb.collection(COLLECTION).doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ success: false, message: 'Introuvable' }, { status: 404 });
    }
    // SEUL l'auteur modifie. Un exemple partagé se duplique, il ne se retouche
    // pas — sinon un prof changerait le questionnaire d'un autre.
    if (snap.data()?.profId !== auth.uid) {
      return NextResponse.json({ success: false, message: 'Accès refusé' }, { status: 403 });
    }

    const body = await request.json();
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body.nom === 'string' && body.nom.trim()) patch.nom = body.nom.trim();
    if (typeof body.description === 'string') patch.description = body.description.trim();
    if (body.archive !== undefined) patch.archive = body.archive === true;
    if (body.quiz !== undefined) {
      patch.quiz = quizPourFirestore(sanitizeLectureQuiz(body.quiz));
    }
    // `shared` reste à l'admin : c'est lui qui décide des exemples du projet.
    if (body.shared !== undefined && auth.isAdmin) patch.shared = body.shared === true;

    await ref.update(patch);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur PATCH /api/questionnaires-lecture/[id]:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

// DELETE — suppression, refusée tant qu'une activité s'en sert.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 });
  }

  const { id } = await params;
  try {
    const ref = adminDb.collection(COLLECTION).doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ success: false, message: 'Introuvable' }, { status: 404 });
    }
    if (snap.data()?.profId !== auth.uid) {
      return NextResponse.json({ success: false, message: 'Accès refusé' }, { status: 403 });
    }

    // ⚠ Une activité qui pointe un questionnaire supprimé deviendrait muette
    // pour ses élèves. On refuse, et on dit laquelle.
    const usages = await adminDb
      .collection('devoirs')
      .where('lectureQuizId', '==', id)
      .select('intitule')
      .get();
    if (!usages.empty) {
      const noms = usages.docs.map((d) => d.data().intitule || d.id).slice(0, 3);
      return NextResponse.json(
        {
          success: false,
          message: `Utilisé par ${usages.size} activité${usages.size > 1 ? 's' : ''} (${noms.join(', ')}${
            usages.size > 3 ? '…' : ''
          }). Archivez-le plutôt que de le supprimer.`,
        },
        { status: 409 }
      );
    }

    await ref.delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur DELETE /api/questionnaires-lecture/[id]:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
