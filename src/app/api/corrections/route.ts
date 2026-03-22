import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import type { Correction } from '@/types/correction';

// GET - Recuperer la correction d'un travail
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const travailId = searchParams.get('travailId');
  const devoirId = searchParams.get('devoirId');

  if (!travailId && !devoirId) {
    return NextResponse.json(
      { success: false, message: 'travailId ou devoirId requis' },
      { status: 400 }
    );
  }

  try {
    // Fetch par devoirId — retourne toutes les corrections du devoir
    if (devoirId && !travailId) {
      if (auth.role !== 'prof') {
        return NextResponse.json({ success: false, message: 'Acces refuse' }, { status: 403 });
      }

      // Verifier que le devoir appartient au prof
      const devoirDoc = await adminDb.collection('devoirs').doc(devoirId).get();
      if (!devoirDoc.exists || devoirDoc.data()?.profId !== auth.uid) {
        return NextResponse.json({ success: false, message: 'Acces refuse' }, { status: 403 });
      }

      const snapshot = await adminDb
        .collection('corrections')
        .where('devoirId', '==', devoirId)
        .get();

      const corrections: Correction[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: data.id || doc.id,
          travailId: data.travailId,
          devoirId: data.devoirId,
          studentId: data.studentId,
          profId: data.profId,
          profEmail: data.profEmail,
          evaluation: data.evaluation || {},
          commentaireGeneral: data.commentaireGeneral || '',
          commentaireGeneralAudio: data.commentaireGeneralAudio || undefined,
          commentairesCriteres: data.commentairesCriteres || {},
          score: data.score || 0,
          status: data.status || 'draft',
          visibleParEleve: data.visibleParEleve || false,
          annotatedContent: data.annotatedContent || undefined,
          audioAnnotations: data.audioAnnotations || [],
          draftAnnotations: data.draftAnnotations || undefined,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          finalizedAt: data.finalizedAt || null,
          version: data.version || 1,
        };
      });

      return NextResponse.json({ success: true, data: corrections });
    }

    // Fetch par travailId — retourne une seule correction
    const correctionId = `CORR-${travailId}`;
    const docRef = adminDb.collection('corrections').doc(correctionId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json({ success: true, data: null });
    }

    const data = docSnap.data()!;

    // Pour les élèves : vérifier que c'est bien leur travail
    if (auth.role === 'eleve') {
      if (data.studentId !== auth.uid) {
        return NextResponse.json(
          { success: false, message: 'Acces refuse' },
          { status: 403 }
        );
      }
    }

    const visible = data.visibleParEleve || false;
    // Les annotations du prof (texte souligné) sont toujours visibles pour l'élève.
    // L'évaluation (grille + note) n'est visible que si visibleParEleve = true.
    const correction: Correction = {
      id: data.id || docSnap.id,
      travailId: data.travailId,
      devoirId: data.devoirId,
      studentId: data.studentId,
      profId: data.profId,
      profEmail: data.profEmail,
      evaluation: (auth.role !== 'eleve' || visible) ? (data.evaluation || {}) : {},
      commentaireGeneral: (auth.role !== 'eleve' || visible) ? (data.commentaireGeneral || '') : '',
      commentaireGeneralAudio: (auth.role !== 'eleve' || visible) ? (data.commentaireGeneralAudio || undefined) : undefined,
      commentairesCriteres: data.commentairesCriteres || {},
      score: (auth.role !== 'eleve' || visible) ? (data.score || 0) : 0,
      status: data.status || 'draft',
      visibleParEleve: visible,
      annotatedContent: data.annotatedContent || undefined,
      audioAnnotations: data.audioAnnotations || [],
      draftAnnotations: data.draftAnnotations || undefined,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      finalizedAt: data.finalizedAt || null,
      version: data.version || 1,
    };

    return NextResponse.json({ success: true, data: correction });
  } catch (error) {
    console.error('Erreur GET /api/corrections:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// POST - Creer une correction
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth || auth.role !== 'prof') {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { travailId, devoirId, studentId } = body;

    if (!travailId || !devoirId || !studentId) {
      return NextResponse.json(
        { success: false, message: 'travailId, devoirId et studentId requis' },
        { status: 400 }
      );
    }

    const correctionId = `CORR-${travailId}`;
    const now = new Date().toISOString();

    const correction = {
      id: correctionId,
      travailId,
      devoirId,
      studentId,
      profId: auth.uid,
      profEmail: auth.email,
      evaluation: body.evaluation || {},
      commentaireGeneral: body.commentaireGeneral || '',
      commentairesCriteres: {},
      score: body.score || 0,
      status: 'draft',
      visibleParEleve: false,
      annotatedContent: null,
      audioAnnotations: [],
      createdAt: now,
      updatedAt: now,
      finalizedAt: null,
      version: 1,
    };

    await adminDb.collection('corrections').doc(correctionId).set(correction);

    return NextResponse.json({
      success: true,
      data: correction,
      message: 'Correction creee',
    });
  } catch (error) {
    console.error('Erreur POST /api/corrections:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
