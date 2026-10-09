import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { calculateSchoolYear } from '@/lib/auth-utils';
import { docToPortfolioMatrice, etapesPortfolioPourFirestore } from '@/lib/portfolio-server';
import { sanitizeRessources } from '@/lib/ressources-server';
import { generatePortfolioId } from '@/types/portfolio';

// Les MATRICES de portfolio du prof (Mes Ressources › Portfolios).
//  GET  : les miennes (archivées comprises, drapeau `archive`) + `autres` : celles des
//         collègues, non archivées, à dupliquer (bloc « des professeurs », JP 2026-10-09)
//  POST : créer une matrice (titre requis)
// Accès serveur uniquement (adminDb) : aucune règle Firestore.

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  if (auth.role !== 'prof') return NextResponse.json({ success: true, data: [], autres: [] });

  try {
    let snapshot;
    try {
      snapshot = await adminDb.collection('portfolios').get();
    } catch (queryError: unknown) {
      // Code 5 = collection absente : rien de créé encore
      if ((queryError as { code?: number }).code === 5) return NextResponse.json({ success: true, data: [], autres: [] });
      throw queryError;
    }
    const toutes = snapshot.docs.map(docToPortfolioMatrice).sort((a, b) => a.titre.localeCompare(b.titre));
    return NextResponse.json({
      success: true,
      data: toutes.filter((m) => m.profId === auth.uid),
      autres: toutes.filter((m) => m.profId !== auth.uid && !m.archive),
    });
  } catch (error) {
    console.error('Erreur GET /api/portfolios:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  if (auth.role !== 'prof') return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });

  try {
    const body = await request.json();
    const titre = typeof body.titre === 'string' ? body.titre.trim().slice(0, 200) : '';
    if (!titre) return NextResponse.json({ success: false, message: 'Titre requis' }, { status: 400 });

    const id = generatePortfolioId();
    const now = new Date();
    const matrice = {
      id,
      titre,
      description: typeof body.description === 'string' ? body.description.trim().slice(0, 1000) : '',
      tacheFinale: typeof body.tacheFinale === 'string' ? body.tacheFinale.trim().slice(0, 2000) : '',
      consignes: typeof body.consignes === 'string' ? body.consignes.slice(0, 10000) : '',
      ressources: body.ressources ? sanitizeRessources(body.ressources, { codeAutorise: auth.isAdmin }) : null,
      etapes: etapesPortfolioPourFirestore(body.etapes, { codeAutorise: auth.isAdmin }),
      profId: auth.uid,
      archive: false,
      anneeScolaire: calculateSchoolYear(),
      createdAt: now,
      updatedAt: now,
    };
    await adminDb.collection('portfolios').doc(id).set(matrice);
    return NextResponse.json({
      success: true,
      data: { ...matrice, createdAt: now.toISOString(), updatedAt: now.toISOString() },
      message: `Portfolio « ${titre} » créé`,
    });
  } catch (error) {
    console.error('Erreur POST /api/portfolios:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
