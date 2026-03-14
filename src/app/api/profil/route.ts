import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { LEVEL_PERCENTAGES } from '@/types/grille';
import type { StudentProfil, CriterionStats } from '@/types/profil';

// GET - Profil d'écrilecteur de l'élève connecté
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json(
      { success: false, message: 'Non autorisé' },
      { status: 401 }
    );
  }

  try {
    // 1. Trouver les docs eleve de cet utilisateur
    const byUid = await adminDb
      .collection('eleves')
      .where('firebaseUid', '==', auth.uid)
      .get();
    const byEmail = await adminDb
      .collection('eleves')
      .where('email', '==', auth.email)
      .get();

    const eleveIds = new Set<string>();
    [...byUid.docs, ...byEmail.docs].forEach((d) => eleveIds.add(d.id));

    if (eleveIds.size === 0) {
      const empty: StudentProfil = { globalScore: 0, totalEvaluations: 0, criteria: [] };
      return NextResponse.json({ success: true, data: empty });
    }

    // 2. Trouver les travaux de cet élève (par firebaseUid)
    const travauxSnapshot = await adminDb
      .collection('travaux')
      .where('studentId', '==', auth.uid)
      .get();

    if (travauxSnapshot.empty) {
      const empty: StudentProfil = { globalScore: 0, totalEvaluations: 0, criteria: [] };
      return NextResponse.json({ success: true, data: empty });
    }

    const travailIds = travauxSnapshot.docs.map((d) => d.id);
    const travailDevoirMap = new Map<string, string>(); // travailId → devoirId
    travauxSnapshot.docs.forEach((d) => {
      travailDevoirMap.set(d.id, d.data().devoirId);
    });

    // 3. Charger les corrections visibles par l'élève (par batches)
    const corrections = [];
    for (let i = 0; i < travailIds.length; i += 30) {
      const batch = travailIds.slice(i, i + 30).map((id) => `CORR-${id}`);
      const corrSnapshot = await adminDb
        .collection('corrections')
        .where('__name__', 'in', batch)
        .get();

      for (const doc of corrSnapshot.docs) {
        const data = doc.data();
        if (data.visibleParEleve && data.evaluation) {
          corrections.push({
            id: doc.id,
            travailId: data.travailId,
            devoirId: data.devoirId,
            evaluation: data.evaluation as Record<string, number>,
            score: data.score || 0,
          });
        }
      }
    }

    if (corrections.length === 0) {
      const empty: StudentProfil = { globalScore: 0, totalEvaluations: 0, criteria: [] };
      return NextResponse.json({ success: true, data: empty });
    }

    // 4. Charger les devoirs pour obtenir les grille IDs
    const devoirIds = [...new Set(corrections.map((c) => c.devoirId))];
    const devoirGrilleMap = new Map<string, string>(); // devoirId → grille (name or id)
    const devoirNameMap = new Map<string, string>(); // devoirId → intitulé
    const devoirDateMap = new Map<string, string>(); // devoirId → dateRemise

    for (let i = 0; i < devoirIds.length; i += 30) {
      const batch = devoirIds.slice(i, i + 30);
      const devSnapshot = await adminDb
        .collection('devoirs')
        .where('__name__', 'in', batch)
        .get();

      for (const doc of devSnapshot.docs) {
        const data = doc.data();
        devoirGrilleMap.set(doc.id, data.grille || '');
        devoirNameMap.set(doc.id, data.intitule || '');
        devoirDateMap.set(doc.id, data.dateRemise || data.createdAt || '');
      }
    }

    // 5. Charger les grilles
    const grilleRefs = [...new Set(devoirGrilleMap.values())].filter(Boolean);
    const grilleMap = new Map<string, { criteria: { id: string; name: string; weight: number }[] }>();

    for (const ref of grilleRefs) {
      // Essayer par ID d'abord
      let doc = await adminDb.collection('grilles').doc(ref).get();
      if (!doc.exists) {
        // Essayer par nom
        const byName = await adminDb
          .collection('grilles')
          .where('name', '==', ref)
          .limit(1)
          .get();
        if (!byName.empty) doc = byName.docs[0];
      }
      if (doc.exists) {
        const data = doc.data()!;
        grilleMap.set(ref, {
          criteria: (data.criteria || []).map((c: { id: string; name: string; weight: number }) => ({
            id: c.id,
            name: c.name,
            weight: c.weight,
          })),
        });
      }
    }

    // 6. Agréger par nom de critère
    const criterionAgg = new Map<string, { totalWeightedScore: number; totalWeight: number; count: number; history: { devoirName: string; date: string; score: number }[] }>();

    let globalScoreSum = 0;

    for (const corr of corrections) {
      const grilleRef = devoirGrilleMap.get(corr.devoirId);
      if (!grilleRef) continue;
      const grille = grilleMap.get(grilleRef);
      if (!grille) continue;

      globalScoreSum += corr.score;

      for (const crit of grille.criteria) {
        const level = corr.evaluation[crit.id];
        if (level === undefined) continue;

        const pct = LEVEL_PERCENTAGES[level] ?? 0;
        const critScore = pct; // Score en % pour ce critère

        if (!criterionAgg.has(crit.name)) {
          criterionAgg.set(crit.name, { totalWeightedScore: 0, totalWeight: 0, count: 0, history: [] });
        }
        const agg = criterionAgg.get(crit.name)!;
        agg.totalWeightedScore += critScore * crit.weight;
        agg.totalWeight += crit.weight;
        agg.count += 1;
        agg.history.push({
          devoirName: devoirNameMap.get(corr.devoirId) || '',
          date: devoirDateMap.get(corr.devoirId) || '',
          score: critScore,
        });
      }
    }

    // 7. Construire le résultat
    const criteria: CriterionStats[] = [];
    for (const [name, agg] of criterionAgg) {
      criteria.push({
        name,
        averageScore: agg.totalWeight > 0 ? Math.round(agg.totalWeightedScore / agg.totalWeight) : 0,
        count: agg.count,
        history: agg.history.sort((a, b) => a.date.localeCompare(b.date)),
      });
    }

    // Trier par nom de critère
    criteria.sort((a, b) => a.name.localeCompare(b.name));

    const profil: StudentProfil = {
      globalScore: corrections.length > 0 ? Math.round(globalScoreSum / corrections.length) : 0,
      totalEvaluations: corrections.length,
      criteria,
    };

    return NextResponse.json({ success: true, data: profil });
  } catch (error) {
    console.error('Erreur GET profil:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
