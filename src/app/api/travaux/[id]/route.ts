import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import type { Travail, UpdateTravailData } from '@/types/travail';

// GET - Recuperer un travail par ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const docRef = adminDb.collection('travaux').doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json(
        { success: false, message: 'Travail non trouve' },
        { status: 404 }
      );
    }

    const data = docSnap.data()!;

    // Les eleves ne peuvent voir que leurs propres travaux
    if (auth.role === 'eleve' && data.studentId !== auth.uid) {
      return NextResponse.json(
        { success: false, message: 'Acces refuse' },
        { status: 403 }
      );
    }

    const travail: Travail = {
      id: data.id || docSnap.id,
      devoirId: data.devoirId,
      studentId: data.studentId,
      studentEmail: data.studentEmail,
      studentName: data.studentName,
      content: data.content || '',
      draftContent: data.draftContent || null,
      ressourceAnnotations: data.ressourceAnnotations || '',
      ressourceNotes: data.ressourceNotes || {},
      status: data.status || 'draft',
      selfEvaluation: data.selfEvaluation || null,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      submittedAt: data.submittedAt || null,
    };

    return NextResponse.json({ success: true, data: travail });
  } catch (error) {
    console.error('Erreur GET /api/travaux/[id]:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// PATCH - Mettre a jour un travail
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body: UpdateTravailData = await request.json();

    const docRef = adminDb.collection('travaux').doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json(
        { success: false, message: 'Travail non trouve' },
        { status: 404 }
      );
    }

    const data = docSnap.data()!;

    // Seul l'eleve proprietaire peut modifier son travail
    if (auth.role === 'eleve' && data.studentId !== auth.uid) {
      return NextResponse.json(
        { success: false, message: 'Acces refuse' },
        { status: 403 }
      );
    }

    // Un travail soumis ne peut plus etre modifie par l'eleve
    if (auth.role === 'eleve' && data.status === 'submitted' && body.content !== undefined) {
      return NextResponse.json(
        { success: false, message: 'Le travail a deja ete soumis et ne peut plus etre modifie' },
        { status: 403 }
      );
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.content !== undefined) {
      updateData.content = body.content;
    }

    if (body.selfEvaluation !== undefined) {
      updateData.selfEvaluation = body.selfEvaluation;
    }

    if (body.ressourceAnnotations !== undefined) {
      updateData.ressourceAnnotations = body.ressourceAnnotations;
    }

    if (body.ressourceNotes !== undefined) {
      updateData.ressourceNotes = body.ressourceNotes;
    }

    if (body.draftContent !== undefined) {
      updateData.draftContent = body.draftContent;
    }

    if (body.status !== undefined) {
      updateData.status = body.status;
      if (body.status === 'submitted') {
        updateData.submittedAt = new Date().toISOString();
      } else if (body.status === 'draft' && auth.role === 'prof') {
        // Le prof renvoie le travail en correction
        updateData.submittedAt = null;
      }
    }

    await docRef.update(updateData);

    return NextResponse.json({
      success: true,
      message: 'Travail mis a jour avec succes',
    });
  } catch (error) {
    console.error('Erreur PATCH /api/travaux/[id]:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
