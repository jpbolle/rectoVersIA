import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { generateTravailId } from '@/lib/travail-utils';
import { decrypt, encrypt, hashEmail } from '@/lib/crypto';
import type { Travail } from '@/types/travail';

// GET - Recuperer le travail de l'eleve connecte pour un devoir specifique
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  if (auth.role !== 'eleve') {
    return NextResponse.json({ error: 'Acces reserve aux eleves' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const devoirId = searchParams.get('devoirId');

    if (!devoirId) {
      return NextResponse.json(
        { success: false, message: 'devoirId est requis' },
        { status: 400 }
      );
    }

    // Verifier que le devoir existe et est disponible
    const devoirRef = adminDb.collection('devoirs').doc(devoirId);
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

    // Chercher le travail de l'eleve par ID genere
    const travailId = generateTravailId(devoirId, auth.uid);
    const travailRef = adminDb.collection('travaux').doc(travailId);
    let travailSnap = await travailRef.get();

    // Fallback : chercher par email (travail pre-cree par ensureTravaux)
    // — d'abord par empreinte (documents chiffrés), puis par email en clair (legacy)
    if (!travailSnap.exists) {
      let emailQuery = await adminDb
        .collection('travaux')
        .where('devoirId', '==', devoirId)
        .where('studentEmailHash', '==', hashEmail(auth.email))
        .limit(1)
        .get();

      if (emailQuery.empty) {
        emailQuery = await adminDb
          .collection('travaux')
          .where('devoirId', '==', devoirId)
          .where('studentEmail', '==', auth.email.toLowerCase())
          .limit(1)
          .get();
      }

      if (!emailQuery.empty) {
        // Reclamer le travail pre-cree : mettre a jour le studentId
        const preCreatedDoc = emailQuery.docs[0];
        const now = new Date().toISOString();
        await preCreatedDoc.ref.update({
          studentId: auth.uid,
          updatedAt: now,
        });

        // Mettre a jour la correction associee si elle existe
        const correctionId = `CORR-${preCreatedDoc.id}`;
        const correctionRef = adminDb.collection('corrections').doc(correctionId);
        const correctionSnap = await correctionRef.get();
        if (correctionSnap.exists) {
          await correctionRef.update({ studentId: auth.uid });
        }

        travailSnap = await preCreatedDoc.ref.get();
      }
    }

    if (!travailSnap.exists) {
      // Pas de travail existant ni pre-cree - creer un nouveau
      const now = new Date().toISOString();
      const newTravail: Travail = {
        id: travailId,
        devoirId: devoirId,
        studentId: auth.uid,
        studentEmail: auth.email,
        studentName: auth.email.split('@')[0],
        content: '',
        status: 'draft',
        selfEvaluation: null,
        createdAt: now,
        updatedAt: now,
        submittedAt: null,
      };

      await travailRef.set({
        ...newTravail,
        studentEmail: encrypt(newTravail.studentEmail),
        studentEmailHash: hashEmail(newTravail.studentEmail),
        studentName: encrypt(newTravail.studentName),
      });

      return NextResponse.json({
        success: true,
        data: newTravail,
        created: true,
      });
    }

    const data = travailSnap.data()!;
    const travail: Travail = {
      id: data.id || travailSnap.id,
      devoirId: data.devoirId,
      studentId: data.studentId,
      studentEmail: decrypt(data.studentEmail),
      studentName: decrypt(data.studentName),
      content: data.content || '',
      draftContent: data.draftContent || null,
      ressourceAnnotations: data.ressourceAnnotations || '',
      ressourceNotes: data.ressourceNotes || {},
      ressourceImageShapes: data.ressourceImageShapes || {},
      status: data.status || 'draft',
      selfEvaluation: data.selfEvaluation || null,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      submittedAt: data.submittedAt || null,
    };

    return NextResponse.json({
      success: true,
      data: travail,
      created: false,
    });
  } catch (error) {
    console.error('Erreur GET /api/travaux/mine:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
