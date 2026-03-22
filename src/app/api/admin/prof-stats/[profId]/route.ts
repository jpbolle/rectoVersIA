import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';

interface ClasseStat {
  id: string;
  nom: string;
  nbEleves: number;
}

interface DevoirStat {
  id: string;
  titre: string;
  accesIA: boolean;
  nbSoumis: number;
  nbCorrections: number;
  nbGridIA: number;
}

interface GrilleStat {
  id: string;
  nom: string;
  nbCriteres: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ profId: string }> },
) {
  const auth = await verifyAuth(request);
  if (!auth || !auth.isAdmin) {
    return NextResponse.json({ success: false, message: 'Accès réservé' }, { status: 403 });
  }

  const { profId } = await params;
  const profEmail = decodeURIComponent(profId).toLowerCase();

  try {
    // Résoudre email → UID Firebase
    let profUid: string;
    try {
      const userRecord = await adminAuth.getUserByEmail(profEmail);
      profUid = userRecord.uid;
    } catch {
      // Compte Firebase non encore créé (prof jamais connecté)
      return NextResponse.json({
        success: true,
        data: {
          classes: [],
          devoirs: [],
          grilles: [],
          aiStats: { devoirsAvecIA: 0, totalGridIA: 0 },
        },
      });
    }

    // 1. Classes + devoirs + grilles en parallele (profId = uid Firebase)
    const [classesSnap, devoirsSnap, grillesSnap] = await Promise.all([
      adminDb.collection('classes').where('profId', '==', profUid).get(),
      adminDb.collection('devoirs').where('profId', '==', profUid).get(),
      adminDb.collection('grilles').where('profId', '==', profUid).get(),
    ]);

    // 2. Compter les élèves par classe (sous-collection)
    const classesStats: ClasseStat[] = await Promise.all(
      classesSnap.docs.map(async (doc) => {
        const elevesSnap = await adminDb
          .collection('classes')
          .doc(doc.id)
          .collection('eleves')
          .count()
          .get();
        return {
          id: doc.id,
          nom: doc.data().nom || doc.id,
          nbEleves: elevesSnap.data().count,
        };
      }),
    );

    // 3. IDs des devoirs pour les requêtes suivantes
    const devoirIds = devoirsSnap.docs.map((d) => d.id);

    // 4. Pour chaque devoir : travaux soumis, corrections, grille IA
    const devoirsStats: DevoirStat[] = devoirIds.length > 0
      ? await Promise.all(
          devoirsSnap.docs.map(async (doc) => {
            const data = doc.data();
            const [travauxSnap, correctionsSnap, gridIASnap] = await Promise.all([
              adminDb.collection('travaux').where('devoirId', '==', doc.id).where('status', '==', 'submitted').count().get(),
              adminDb.collection('corrections').where('devoirId', '==', doc.id).count().get(),
              data.accesIA
                ? adminDb.collection('aiGridEvaluations').where('devoirId', '==', doc.id).count().get()
                : null,
            ]);
            return {
              id: doc.id,
              titre: data.titre || 'Sans titre',
              accesIA: data.accesIA ?? false,
              nbSoumis: travauxSnap.data().count,
              nbCorrections: correctionsSnap.data().count,
              nbGridIA: gridIASnap ? gridIASnap.data().count : 0,
            };
          }),
        )
      : [];

    // 5. Grilles (hors shared)
    const grillesStats: GrilleStat[] = grillesSnap.docs.map((doc) => {
      const data = doc.data();
      const criteres = Array.isArray(data.criteres) ? data.criteres : [];
      return {
        id: doc.id,
        nom: data.name || data.nom || doc.id,
        nbCriteres: criteres.length,
      };
    });

    // 6. Stats IA globales
    const nbDevoirsIA = devoirsStats.filter((d) => d.accesIA).length;
    const nbGridIA = devoirsStats.reduce((sum, d) => sum + d.nbGridIA, 0);

    return NextResponse.json({
      success: true,
      data: {
        classes: classesStats,
        devoirs: devoirsStats,
        grilles: grillesStats,
        aiStats: {
          devoirsAvecIA: nbDevoirsIA,
          totalGridIA: nbGridIA,
        },
      },
    });
  } catch (error) {
    console.error('Erreur GET /api/admin/prof-stats:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
