import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import type { UpdateCorrectionData } from '@/types/correction';

// PATCH - Mettre a jour une correction
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(request);
  if (!auth || auth.role !== 'prof') {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body: UpdateCorrectionData = await request.json();

    const docRef = adminDb.collection('corrections').doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json(
        { success: false, message: 'Correction non trouvee' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.evaluation !== undefined) {
      updateData.evaluation = body.evaluation;
    }

    if (body.commentaireGeneral !== undefined) {
      updateData.commentaireGeneral = body.commentaireGeneral;
    }

    if (body.commentairesCriteres !== undefined) {
      updateData.commentairesCriteres = body.commentairesCriteres;
    }

    if (body.score !== undefined) {
      updateData.score = body.score;
    }

    if (body.status !== undefined) {
      updateData.status = body.status;
      if (body.status === 'finalized') {
        updateData.finalizedAt = new Date().toISOString();
      }
    }

    if (body.visibleParEleve !== undefined) {
      updateData.visibleParEleve = body.visibleParEleve;
    }

    if (body.annotatedContent !== undefined) {
      updateData.annotatedContent = body.annotatedContent;
    }

    if (body.audioAnnotations !== undefined) {
      updateData.audioAnnotations = body.audioAnnotations;
    }

    if (body.draftAnnotations !== undefined) {
      updateData.draftAnnotations = body.draftAnnotations;
    }

    if (body.commentaireGeneralAudio !== undefined) {
      updateData.commentaireGeneralAudio = body.commentaireGeneralAudio;
    }

    await docRef.update(updateData);

    return NextResponse.json({
      success: true,
      message: 'Correction mise a jour',
    });
  } catch (error) {
    console.error('Erreur PATCH /api/corrections/[id]:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
