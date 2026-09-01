import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { figerQuizDeLaSession } from '@/lib/session-server';

// PATCH /api/sessions/[id] — ouvrir, fermer, dater ou archiver UNE classe.
//
// C'est la raison d'être des sessions : ouvrir le corrigé de la 4C sans le
// livrer à la 4D, qui passe l'épreuve le lendemain.
export async function PATCH(
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
    const ref = adminDb.collection('sessions').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ success: false, message: 'Session non trouvée' }, { status: 404 });
    }
    const session = snap.data()!;
    if (session.profId !== auth.uid) {
      return NextResponse.json({ success: false, message: 'Accès refusé' }, { status: 403 });
    }

    const body = await request.json();
    const patch: Record<string, unknown> = { updatedAt: new Date() };

    if (body.disponible !== undefined) {
      patch.disponible = body.disponible === true;
      // Horodatage posé au basculement — c'est lui qui alimente la cloche.
      // On ne le repose pas si la session était déjà ouverte : la notification
      // remonterait une seconde fois pour la même chose.
      if (body.disponible === true && session.disponible !== true) {
        patch.disponibleAt = new Date();
      }
    }
    if (body.dateRemise !== undefined) {
      patch.dateRemise = body.dateRemise ? new Date(body.dateRemise) : null;
    }
    if (body.archive !== undefined) {
      patch.archive = body.archive === true;
    }

    const changeCorrige =
      body.corrigeDisponible !== undefined &&
      body.corrigeDisponible === true !== (session.corrigeDisponible === true);

    if (body.corrigeDisponible !== undefined) {
      patch.corrigeDisponible = body.corrigeDisponible === true;
      if (body.corrigeDisponible === true && session.corrigeDisponible !== true) {
        patch.corrigeDisponibleAt = new Date();
      }
    }

    await ref.update(patch);

    // ── L'OUVERTURE FIGE LE QUESTIONNAIRE ──
    // À partir d'ici, cette classe lira toujours ces questions-là, même si le
    // questionnaire de la bibliothèque est amélioré ensuite. C'est ce qui
    // permet de relire leurs réponses dans dix ans. Ne fige qu'une fois.
    if (patch.disponible === true) {
      await figerQuizDeLaSession(id, String(session.devoirId));
    }

    // ── Le corrigé, classe par classe ──
    // La visibilité de chaque correction vit AUSSI sur la correction elle-même
    // (`visibleParEleve`). Il faut donc la répercuter — mais seulement sur les
    // copies de CETTE session, sans quoi on rouvrirait tout le devoir.
    if (changeCorrige) {
      const travauxSnap = await adminDb
        .collection('travaux')
        .where('sessionId', '==', id)
        .get();

      let batch = adminDb.batch();
      let ops = 0;
      for (const travail of travauxSnap.docs) {
        const correctionRef = adminDb.collection('corrections').doc(`CORR-${travail.id}`);
        const correction = await correctionRef.get();
        if (!correction.exists) continue;
        batch.update(correctionRef, { visibleParEleve: body.corrigeDisponible === true });
        ops++;
        // Firestore limite un lot à 500 opérations
        if (ops >= 400) {
          await batch.commit();
          batch = adminDb.batch();
          ops = 0;
        }
      }
      if (ops > 0) await batch.commit();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur PATCH /api/sessions/[id]:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
