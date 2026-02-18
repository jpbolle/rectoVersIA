import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { calculateSchoolYear } from '@/lib/auth-utils';
import { generateGrilleId, generateCriterionId } from '@/lib/grille-utils';
import type { Grille, GrilleCriterion } from '@/types/grille';

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
        return NextResponse.json({ success: true, data: [] });
      }
      throw queryError;
    }

    let grilles = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: data.id || doc.id,
        name: data.name || '',
        description: data.description || '',
        uaa: data.uaa || [],
        profId: data.profId || '',
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
      } as Grille;
    });

    // Les eleves ne voient que les grilles non archivees
    if (auth.role === 'eleve') {
      grilles = grilles.filter((g) => !g.archive);
    }

    return NextResponse.json({ success: true, data: grilles });
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
    const { name, description, uaa, criteria } = body;

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

    await adminDb.collection('grilles').doc(id).set({
      id,
      name,
      description: description || '',
      uaa: Array.isArray(uaa) ? uaa : [],
      profId: auth.uid,
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
        profId: auth.uid,
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
