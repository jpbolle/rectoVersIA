import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';

// GET - Stats globales de l'app (admin uniquement)
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth || !auth.isAdmin) {
    return NextResponse.json({ success: false, message: 'Accès réservé' }, { status: 403 });
  }

  try {
    // Compter en parallele
    const [devoirsSnap, elevesSnap, classesSnap, travauxSnap, correctionsSnap, profsSnap] =
      await Promise.all([
        adminDb.collection('devoirs').count().get(),
        adminDb.collection('eleves').count().get(),
        adminDb.collection('classes').count().get(),
        adminDb.collection('travaux').count().get(),
        adminDb.collection('corrections').count().get(),
        adminDb.collection('professeurs').count().get(),
      ]);

    // Travaux soumis
    const travauxSoumisSnap = await adminDb
      .collection('travaux')
      .where('status', '==', 'submitted')
      .count()
      .get();

    // Corrections finalisees
    const correctionsFinSnap = await adminDb
      .collection('corrections')
      .where('status', '==', 'finalized')
      .count()
      .get();

    // Usage IA (onglet « Gestion des coûts ») : compteurs des collections
    // alimentées par les appels IA — pas encore de suivi en tokens/euros
    const [gridEvalSnap, devoirsIASnap, dictionarySnap] = await Promise.all([
      adminDb.collection('aiGridEvaluations').count().get(),
      adminDb.collection('devoirs').where('accesIA', '==', true).count().get(),
      adminDb.collection('dictionaryCache').count().get(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        professeurs: profsSnap.data().count,
        classes: classesSnap.data().count,
        eleves: elevesSnap.data().count,
        devoirs: devoirsSnap.data().count,
        travaux: travauxSnap.data().count,
        travauxSoumis: travauxSoumisSnap.data().count,
        corrections: correctionsSnap.data().count,
        correctionsFinalisees: correctionsFinSnap.data().count,
        ia: {
          gridEvaluations: gridEvalSnap.data().count,
          devoirsAvecIA: devoirsIASnap.data().count,
          dictionaryEntries: dictionarySnap.data().count,
        },
      },
    });
  } catch (error) {
    console.error('Erreur GET /api/admin/stats:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
