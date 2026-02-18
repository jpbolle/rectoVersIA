import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { generateTravailId } from '@/lib/travail-utils';
import { ensureTravaux } from '@/lib/precreate-travaux';
import type { Travail, CreateTravailData } from '@/types/travail';

// POST - Creer un nouveau travail (eleve uniquement)
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  if (auth.role !== 'eleve') {
    return NextResponse.json({ error: 'Seuls les eleves peuvent creer des travaux' }, { status: 403 });
  }

  try {
    const body: CreateTravailData = await request.json();

    if (!body.devoirId) {
      return NextResponse.json(
        { success: false, message: 'devoirId est requis' },
        { status: 400 }
      );
    }

    // Verifier que le devoir existe et est disponible
    const devoirRef = adminDb.collection('devoirs').doc(body.devoirId);
    const devoirSnap = await devoirRef.get();

    if (!devoirSnap.exists) {
      return NextResponse.json(
        { success: false, message: 'Devoir non trouve' },
        { status: 404 }
      );
    }

    const devoirData = devoirSnap.data()!;
    if (!devoirData.disponible) {
      return NextResponse.json(
        { success: false, message: 'Ce devoir n\'est pas disponible' },
        { status: 403 }
      );
    }

    // Generer l'ID du travail
    const travailId = generateTravailId(body.devoirId, auth.uid);

    // Verifier si un travail existe deja
    const existingRef = adminDb.collection('travaux').doc(travailId);
    const existingSnap = await existingRef.get();

    if (existingSnap.exists) {
      return NextResponse.json(
        { success: false, message: 'Un travail existe deja pour ce devoir' },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const travail: Travail = {
      id: travailId,
      devoirId: body.devoirId,
      studentId: auth.uid,
      studentEmail: auth.email,
      studentName: auth.email.split('@')[0],
      content: body.content || '',
      status: 'draft',
      selfEvaluation: null,
      createdAt: now,
      updatedAt: now,
      submittedAt: null,
    };

    await existingRef.set(travail);

    return NextResponse.json({
      success: true,
      data: travail,
      message: 'Travail cree avec succes',
    });
  } catch (error) {
    console.error('Erreur POST /api/travaux:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// GET - Liste des travaux (prof uniquement, filtre par devoirId optionnel)
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  if (auth.role !== 'prof') {
    return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const devoirId = searchParams.get('devoirId');

    // Pre-creer les travaux manquants pour les eleves des classes du devoir
    if (devoirId) {
      try {
        await ensureTravaux(devoirId, auth.uid);
      } catch (err) {
        console.error('Erreur ensureTravaux:', err);
      }
    }

    let query = adminDb.collection('travaux').orderBy('updatedAt', 'desc');

    if (devoirId) {
      query = adminDb.collection('travaux')
        .where('devoirId', '==', devoirId)
        .orderBy('updatedAt', 'desc');
    }

    const snapshot = await query.get();
    const travaux: Travail[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      travaux.push({
        id: data.id || doc.id,
        devoirId: data.devoirId,
        studentId: data.studentId,
        studentEmail: data.studentEmail,
        studentName: data.studentName,
        content: data.content || '',
        status: data.status || 'draft',
        selfEvaluation: data.selfEvaluation || null,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        submittedAt: data.submittedAt || null,
      });
    });

    return NextResponse.json({ success: true, data: travaux });
  } catch (error) {
    console.error('Erreur GET /api/travaux:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
