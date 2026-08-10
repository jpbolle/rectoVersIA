import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { queryElevesByEmail } from '@/lib/eleve-lookup';
import { LEVEL_PERCENTAGES } from '@/types/grille';
import type {
  StudentProfil, CriterionStats, SectionStats,
  CriterionHistory, DevoirStat, DevoirCriterionStat,
} from '@/types/profil';

type LanguageType = 'ortho' | 'syntaxe' | 'lexique' | 'ponctuation';

function detectLanguageType(name: string): LanguageType | null {
  if (/orthograph/i.test(name)) return 'ortho';
  if (/ponctuat/i.test(name)) return 'ponctuation';
  if (/syntaxe|syntact/i.test(name)) return 'syntaxe';
  if (/lexiqu|vocabul/i.test(name)) return 'lexique';
  return null;
}

type CorrEntry = {
  id: string;
  travailId: string;
  devoirId: string;
  evaluation: Record<string, number>;
  score: number;
};

type ClassCorrEntry = {
  score: number;
  evaluation: Record<string, number>;
};

type GrilleEntry = { criteria: { id: string; name: string; weight: number }[] };

function buildSectionStats(
  corrsList: CorrEntry[],
  devoirGrilleMap: Map<string, string>,
  grilleMap: Map<string, GrilleEntry>,
  devoirNameMap: Map<string, string>,
  devoirDateMap: Map<string, string>,
  classCorrsPerDevoir: Map<string, ClassCorrEntry[]>
): SectionStats | null {
  if (corrsList.length === 0) return null;

  const criterionAgg = new Map<string, {
    totalWeightedScore: number; totalWeight: number;
    count: number; history: CriterionHistory[];
  }>();
  let globalScoreSum = 0;

  for (const corr of corrsList) {
    globalScoreSum += corr.score;
    const grilleRef = devoirGrilleMap.get(corr.devoirId);
    if (!grilleRef) continue;
    const grille = grilleMap.get(grilleRef);
    if (!grille) continue;

    for (const crit of grille.criteria) {
      const level = corr.evaluation[crit.id];
      if (level === undefined) continue;
      const pct = LEVEL_PERCENTAGES[level as keyof typeof LEVEL_PERCENTAGES] ?? 0;
      if (!criterionAgg.has(crit.name)) {
        criterionAgg.set(crit.name, { totalWeightedScore: 0, totalWeight: 0, count: 0, history: [] });
      }
      const agg = criterionAgg.get(crit.name)!;
      agg.totalWeightedScore += pct * crit.weight;
      agg.totalWeight += crit.weight;
      agg.count += 1;
      agg.history.push({
        devoirName: devoirNameMap.get(corr.devoirId) || '',
        date: devoirDateMap.get(corr.devoirId) || '',
        score: pct,
      });
    }
  }

  const devoirIdsInSection = [...new Set(corrsList.map((c) => c.devoirId))];
  const classScoresByCrit = new Map<string, number[]>();
  const allClassGlobalScores: number[] = [];

  for (const devoirId of devoirIdsInSection) {
    const grilleRef = devoirGrilleMap.get(devoirId);
    const grille = grilleRef ? grilleMap.get(grilleRef) : undefined;
    const classCorrsList = classCorrsPerDevoir.get(devoirId) || [];
    for (const corr of classCorrsList) {
      allClassGlobalScores.push(corr.score);
      if (!grille) continue;
      for (const crit of grille.criteria) {
        const level = corr.evaluation[crit.id];
        if (level === undefined) continue;
        const pct = LEVEL_PERCENTAGES[level as keyof typeof LEVEL_PERCENTAGES] ?? 0;
        if (!classScoresByCrit.has(crit.name)) classScoresByCrit.set(crit.name, []);
        classScoresByCrit.get(crit.name)!.push(pct);
      }
    }
  }

  const classeAvg = allClassGlobalScores.length > 0
    ? Math.round(allClassGlobalScores.reduce((s, v) => s + v, 0) / allClassGlobalScores.length)
    : null;
  const classeMax = allClassGlobalScores.length > 0 ? Math.max(...allClassGlobalScores) : null;

  const criteria: CriterionStats[] = [];
  for (const [name, agg] of criterionAgg) {
    const classScores = classScoresByCrit.get(name) || [];
    criteria.push({
      name,
      averageScore: agg.totalWeight > 0 ? Math.round(agg.totalWeightedScore / agg.totalWeight) : 0,
      count: agg.count,
      history: agg.history.sort((a, b) => a.date.localeCompare(b.date)),
      classeAvg: classScores.length > 0
        ? Math.round(classScores.reduce((s, v) => s + v, 0) / classScores.length) : null,
      classeMax: classScores.length > 0 ? Math.max(...classScores) : null,
      languageType: detectLanguageType(name) || undefined,
    });
  }
  criteria.sort((a, b) => a.name.localeCompare(b.name));

  return {
    totalEvaluations: corrsList.length,
    globalScore: Math.round(globalScoreSum / corrsList.length),
    classeAvg, classeMax, criteria,
  };
}

// GET - Profil d'écrilecteur de l'élève connecté
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 });
  }

  try {
    // 1. Trouver les docs élève
    const byUid = await adminDb.collection('eleves').where('firebaseUid', '==', auth.uid).get();
    const byEmail = await queryElevesByEmail(auth.email);
    const eleveIds = new Set<string>();
    [...byUid.docs, ...byEmail.docs].forEach((d) => eleveIds.add(d.id));

    const empty: StudentProfil = {
      globalScore: 0, totalEvaluations: 0, travauxRemis: 0,
      reussites: 0, echecs: 0, criteria: [],
      ecritureStats: null, lectureStats: null, devoirStats: [],
    };
    if (eleveIds.size === 0) return NextResponse.json({ success: true, data: empty });

    // 2. Trouver les travaux de l'élève
    const travauxSnapshot = await adminDb
      .collection('travaux').where('studentId', '==', auth.uid).get();
    if (travauxSnapshot.empty) return NextResponse.json({ success: true, data: empty });

    const travailIds = travauxSnapshot.docs.map((d) => d.id);
    const travailDevoirMap = new Map<string, string>();
    const travailStatusMap = new Map<string, string>();
    travauxSnapshot.docs.forEach((d) => {
      travailDevoirMap.set(d.id, d.data().devoirId);
      travailStatusMap.set(d.id, d.data().status || 'draft');
    });

    // 3. Charger les corrections visibles
    const corrections: CorrEntry[] = [];
    for (let i = 0; i < travailIds.length; i += 30) {
      const batch = travailIds.slice(i, i + 30).map((id) => `CORR-${id}`);
      const corrSnapshot = await adminDb
        .collection('corrections').where('__name__', 'in', batch).get();
      for (const doc of corrSnapshot.docs) {
        const data = doc.data();
        if (data.visibleParEleve && data.evaluation) {
          corrections.push({
            id: doc.id, travailId: data.travailId, devoirId: data.devoirId,
            evaluation: data.evaluation as Record<string, number>,
            score: data.score || 0,
          });
        }
      }
    }
    if (corrections.length === 0) return NextResponse.json({ success: true, data: empty });

    // 4. Charger les devoirs
    const devoirIds = [...new Set(corrections.map((c) => c.devoirId))];
    const devoirGrilleMap = new Map<string, string>();
    const devoirNameMap = new Map<string, string>();
    const devoirDateMap = new Map<string, string>();
    const devoirTypeMap = new Map<string, 'ecrire' | 'lire' | 'rechercher'>();

    for (let i = 0; i < devoirIds.length; i += 30) {
      const batch = devoirIds.slice(i, i + 30);
      const devSnapshot = await adminDb
        .collection('devoirs').where('__name__', 'in', batch).get();
      for (const doc of devSnapshot.docs) {
        const data = doc.data();
        devoirGrilleMap.set(doc.id, data.grille || '');
        devoirNameMap.set(doc.id, data.intitule || '');
        // dateRemise peut être un Timestamp Firestore — le convertir en string ISO
        const rawDate = data.dateRemise || data.createdAt;
        const dateStr = rawDate
          ? (typeof rawDate === 'string' ? rawDate : rawDate.toDate().toISOString())
          : '';
        devoirDateMap.set(doc.id, dateStr);
        devoirTypeMap.set(doc.id, data.typeTravail || 'ecrire');
      }
    }

    // 5. Charger les grilles (en parallèle)
    const grilleRefs = [...new Set(devoirGrilleMap.values())].filter(Boolean);
    const grilleMap = new Map<string, GrilleEntry>();
    await Promise.all(grilleRefs.map(async (ref) => {
      let doc = await adminDb.collection('grilles').doc(ref).get();
      if (!doc.exists) {
        const byName = await adminDb.collection('grilles').where('name', '==', ref).limit(1).get();
        if (!byName.empty) doc = byName.docs[0];
      }
      if (doc.exists) {
        const data = doc.data()!;
        grilleMap.set(ref, {
          criteria: (data.criteria || []).map((c: { id: string; name: string; weight: number }) => ({
            id: c.id, name: c.name, weight: c.weight,
          })),
        });
      }
    }));

    // 6. Charger les corrections de la classe pour chaque devoir (en parallèle)
    const classCorrsPerDevoir = new Map<string, ClassCorrEntry[]>();
    await Promise.all(devoirIds.map(async (devoirId) => {
      const allTrSnap = await adminDb
        .collection('travaux').where('devoirId', '==', devoirId).get();
      const allTravailIds = allTrSnap.docs.map((d) => d.id);
      if (allTravailIds.length === 0) { classCorrsPerDevoir.set(devoirId, []); return; }

      const classCorrsList: ClassCorrEntry[] = [];
      await Promise.all(
        Array.from({ length: Math.ceil(allTravailIds.length / 30) }, (_, i) =>
          allTravailIds.slice(i * 30, (i + 1) * 30)
        ).map(async (batchIds) => {
          const batch = batchIds.map((id) => `CORR-${id}`);
          const corrSnap = await adminDb
            .collection('corrections').where('__name__', 'in', batch).get();
          for (const doc of corrSnap.docs) {
            const d = doc.data();
            if (d.score > 0 && d.evaluation) {
              classCorrsList.push({
                score: d.score, evaluation: d.evaluation as Record<string, number>,
              });
            }
          }
        })
      );
      classCorrsPerDevoir.set(devoirId, classCorrsList);
    }));

    // 7. Séparer par type
    const corrEcriture = corrections.filter(
      (c) => (devoirTypeMap.get(c.devoirId) || 'ecrire') === 'ecrire'
    );
    const corrLecture = corrections.filter(
      (c) => devoirTypeMap.get(c.devoirId) === 'lire'
    );

    // 8. Sections agrégées
    const ecritureStats = buildSectionStats(
      corrEcriture, devoirGrilleMap, grilleMap, devoirNameMap, devoirDateMap, classCorrsPerDevoir
    );
    const lectureStats = buildSectionStats(
      corrLecture, devoirGrilleMap, grilleMap, devoirNameMap, devoirDateMap, classCorrsPerDevoir
    );

    // 9. Stats par devoir
    const devoirStatsList: DevoirStat[] = [];
    for (const corr of corrections) {
      const type = devoirTypeMap.get(corr.devoirId) || 'ecrire';
      if (type === 'rechercher') continue;

      const grilleRef = devoirGrilleMap.get(corr.devoirId);
      const grille = grilleRef ? grilleMap.get(grilleRef) : undefined;
      const classCorrsList = classCorrsPerDevoir.get(corr.devoirId) || [];

      const classeScores = classCorrsList.map((c) => c.score);
      const classeAvg = classeScores.length > 0
        ? Math.round(classeScores.reduce((s, v) => s + v, 0) / classeScores.length) : null;
      const classeMax = classeScores.length > 0 ? Math.max(...classeScores) : null;

      const devoirCriteria: DevoirCriterionStat[] = [];
      if (grille) {
        for (const crit of grille.criteria) {
          const level = corr.evaluation[crit.id];
          if (level === undefined) continue;
          const myScore = LEVEL_PERCENTAGES[level as keyof typeof LEVEL_PERCENTAGES] ?? 0;

          const classCritScores = classCorrsList
            .map((c) => {
              const l = c.evaluation[crit.id];
              return l !== undefined ? (LEVEL_PERCENTAGES[l as keyof typeof LEVEL_PERCENTAGES] ?? 0) : null;
            })
            .filter((v): v is number => v !== null);

          devoirCriteria.push({
            name: crit.name,
            score: myScore,
            classeAvg: classCritScores.length > 0
              ? Math.round(classCritScores.reduce((s, v) => s + v, 0) / classCritScores.length) : null,
            classeMax: classCritScores.length > 0 ? Math.max(...classCritScores) : null,
            languageType: detectLanguageType(crit.name) || undefined,
          });
        }
      }

      devoirStatsList.push({
        devoirId: corr.devoirId,
        name: devoirNameMap.get(corr.devoirId) || '',
        date: devoirDateMap.get(corr.devoirId) || '',
        type,
        myScore: corr.score,
        classeAvg, classeMax,
        criteria: devoirCriteria,
      });
    }
    devoirStatsList.sort((a, b) => a.date.localeCompare(b.date));

    // 10. Compteurs écriture
    const ecritureCorrections = corrections.filter(
      (c) => (devoirTypeMap.get(c.devoirId) || 'ecrire') === 'ecrire'
    );
    const reussites = ecritureCorrections.filter((c) => c.score >= 60).length;
    const echecs = ecritureCorrections.filter((c) => c.score < 60).length;

    // Comptage travaux remis (écriture soumis)
    let travauxRemis = 0;
    for (const [travailId, status] of travailStatusMap) {
      const devoirId = travailDevoirMap.get(travailId);
      if (!devoirId) continue;
      const type = devoirTypeMap.get(devoirId) || 'ecrire';
      if (type === 'ecrire' && status === 'submitted') travauxRemis++;
    }

    // 11. Stats globales (rétrocompat)
    const globalCriterionAgg = new Map<string, {
      totalWeightedScore: number; totalWeight: number;
      count: number; history: CriterionHistory[];
    }>();
    let globalScoreSum = 0;
    for (const corr of corrections) {
      globalScoreSum += corr.score;
      const grilleRef = devoirGrilleMap.get(corr.devoirId);
      if (!grilleRef) continue;
      const grille = grilleMap.get(grilleRef);
      if (!grille) continue;
      for (const crit of grille.criteria) {
        const level = corr.evaluation[crit.id];
        if (level === undefined) continue;
        const pct = LEVEL_PERCENTAGES[level as keyof typeof LEVEL_PERCENTAGES] ?? 0;
        if (!globalCriterionAgg.has(crit.name)) {
          globalCriterionAgg.set(crit.name, { totalWeightedScore: 0, totalWeight: 0, count: 0, history: [] });
        }
        const agg = globalCriterionAgg.get(crit.name)!;
        agg.totalWeightedScore += pct * crit.weight;
        agg.totalWeight += crit.weight;
        agg.count += 1;
        agg.history.push({
          devoirName: devoirNameMap.get(corr.devoirId) || '',
          date: devoirDateMap.get(corr.devoirId) || '',
          score: pct,
        });
      }
    }
    const globalCriteria: CriterionStats[] = [];
    for (const [name, agg] of globalCriterionAgg) {
      globalCriteria.push({
        name,
        averageScore: agg.totalWeight > 0 ? Math.round(agg.totalWeightedScore / agg.totalWeight) : 0,
        count: agg.count,
        history: agg.history.sort((a, b) => a.date.localeCompare(b.date)),
        classeAvg: null, classeMax: null,
        languageType: detectLanguageType(name) || undefined,
      });
    }
    globalCriteria.sort((a, b) => a.name.localeCompare(b.name));

    const profil: StudentProfil = {
      globalScore: corrections.length > 0 ? Math.round(globalScoreSum / corrections.length) : 0,
      totalEvaluations: corrections.length,
      travauxRemis, reussites, echecs,
      criteria: globalCriteria,
      ecritureStats, lectureStats,
      devoirStats: devoirStatsList,
    };

    return NextResponse.json({ success: true, data: profil });
  } catch (error) {
    console.error('Erreur GET profil:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
