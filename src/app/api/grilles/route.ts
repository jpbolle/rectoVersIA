import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { calculateSchoolYear } from '@/lib/auth-utils';
import { generateGrilleId, generateCriterionId } from '@/lib/grille-utils';
import { decrypt } from '@/lib/crypto';
import type { Grille, GrilleCriterion } from '@/types/grille';

function docToGrilleList(doc: FirebaseFirestore.DocumentSnapshot): Grille {
  const data = doc.data()!;
  return {
    id: data.id || doc.id,
    name: data.name || '',
    description: data.description || '',
    uaa: data.uaa || [],
    ateliers: Array.isArray(data.ateliers) ? data.ateliers : [],
    profId: data.profId || '',
    profName: data.profName || '',
    shared: data.shared ?? false,
    anneeScolaire: data.anneeScolaire || '',
    archive: data.archive ?? false,
    criteria: (data.criteria || []).map((c: GrilleCriterion) => ({
      id: c.id || '',
      name: c.name || '',
      weight: c.weight || 1,
      order: c.order ?? 0,
      levels: (c.levels || []).map((l) => ({
        level: l.level ?? 0,
        indicators: l.indicators || [],
      })),
    })),
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || '',
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt || '',
  };
}

// GET - Lister les grilles
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  try {
    let snapshot;
    try {
      snapshot = await adminDb
        .collection('grilles')
        .orderBy('name', 'asc')
        .get();
    } catch (queryError: unknown) {
      const error = queryError as { code?: number };
      if (error.code === 5) {
        return NextResponse.json({ success: true, data: [], shared: [], otherProfs: [] });
      }
      throw queryError;
    }

    const allGrilles = snapshot.docs.map(docToGrilleList);

    // Enrichir les profName manquants
    const uidsWithoutName = [...new Set(allGrilles.filter((g) => !g.profName && g.profId).map((g) => g.profId))];
    if (uidsWithoutName.length > 0) {
      // Charger les professeurs (email → nom complet)
      const profsSnap = await adminDb.collection('professeurs').get();
      const nameByEmail = new Map<string, string>();
      for (const doc of profsSnap.docs) {
        const data = doc.data();
        nameByEmail.set(data.email, `${data.prenom || ''} ${data.nom || ''}`.trim());
      }

      // Pour chaque UID, trouver l'email dans users/{uid} puis le nom dans professeurs
      for (const uid of uidsWithoutName) {
        const userDoc = await adminDb.collection('users').doc(uid).get();
        const email = userDoc.exists ? (decrypt(userDoc.data()?.email)?.toLowerCase() || '') : '';
        const displayName = userDoc.exists ? (decrypt(userDoc.data()?.displayName) || '') : '';
        const profName = nameByEmail.get(email) || displayName || email || 'Professeur';

        for (const g of allGrilles) {
          if (g.profId === uid && !g.profName) {
            g.profName = profName;
          }
        }
      }
    }

    if (auth.role === 'eleve') {
      // Les eleves ne voient que les grilles non archivees (toutes confondues)
      const grilles = allGrilles.filter((g) => !g.archive);
      return NextResponse.json({ success: true, data: grilles });
    }

    // Prof : separer mes grilles, grilles partagees, grilles des autres profs
    const myGrilles = allGrilles.filter((g) => g.profId === auth.uid);
    const sharedGrilles = allGrilles.filter((g) => g.shared && g.profId !== auth.uid && !g.archive);
    const otherProfsGrilles = allGrilles.filter(
      (g) => g.profId !== auth.uid && !g.shared && !g.archive
    );

    return NextResponse.json({
      success: true,
      data: myGrilles,
      shared: sharedGrilles,
      otherProfs: otherProfsGrilles,
    });
  } catch (error) {
    console.error('Erreur GET /api/grilles:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// POST - Creer une grille
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  if (auth.role !== 'prof') {
    return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, description, uaa, ateliers, criteria } = body;

    if (!name || !criteria || !Array.isArray(criteria) || criteria.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Nom et au moins un critere requis' },
        { status: 400 }
      );
    }

    const id = generateGrilleId();
    const anneeScolaire = calculateSchoolYear();

    // Ajouter un id unique a chaque critere
    const criteriaWithIds: GrilleCriterion[] = criteria.map(
      (c: Omit<GrilleCriterion, 'id'>, index: number) => ({
        id: generateCriterionId(),
        name: c.name || '',
        weight: c.weight || 1,
        order: c.order ?? index,
        levels: (c.levels || []).map((l) => ({
          level: l.level ?? 0,
          indicators: l.indicators || [],
        })),
      })
    );

    const now = new Date();

    // Recuperer le nom du prof pour l'affichage
    const profDoc = await adminDb.collection('professeurs').doc(auth.email.toLowerCase()).get();
    const profData = profDoc.exists ? profDoc.data() : null;
    const profName = profData ? `${profData.prenom || ''} ${profData.nom || ''}`.trim() : auth.email;

    // Seul l'admin peut marquer une grille comme partagee
    const shared = auth.isAdmin && body.shared === true;

    await adminDb.collection('grilles').doc(id).set({
      id,
      name,
      description: description || '',
      uaa: Array.isArray(uaa) ? uaa : [],
      ateliers: Array.isArray(ateliers) ? ateliers.filter((a: unknown) => typeof a === 'string') : [],
      profId: auth.uid,
      profName,
      shared,
      anneeScolaire,
      archive: false,
      criteria: criteriaWithIds,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      success: true,
      data: {
        id,
        name,
        description: description || '',
        uaa: Array.isArray(uaa) ? uaa : [],
      ateliers: Array.isArray(ateliers) ? ateliers.filter((a: unknown) => typeof a === 'string') : [],
        profId: auth.uid,
        profName,
        shared,
        anneeScolaire,
        archive: false,
        criteria: criteriaWithIds,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
      message: `Grille "${name}" creee avec succes`,
    });
  } catch (error) {
    console.error('Erreur POST /api/grilles:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
