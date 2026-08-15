// Bibliothèque d'œuvres — liste et création.
//
// Partage calqué sur les grilles (/api/grilles) : chaque prof voit les siennes,
// les œuvres marquées « exemple » par l'admin, et celles des autres profs —
// qu'il peut dupliquer pour les remanier (POST /api/oeuvres/[id]/dupliquer).

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { calculateSchoolYear } from '@/lib/auth-utils';
import { docToOeuvre } from '@/lib/oeuvre-server';
import { generateOeuvreId } from '@/types/oeuvre';

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

  try {
    let snapshot;
    try {
      snapshot = await adminDb.collection('oeuvres').orderBy('titre', 'asc').get();
    } catch (queryError: unknown) {
      // Code 5 = collection absente : la bibliothèque est simplement vide
      if ((queryError as { code?: number }).code === 5) {
        return NextResponse.json({ success: true, data: [], shared: [], otherProfs: [] });
      }
      throw queryError;
    }

    const toutes = snapshot.docs.map(docToOeuvre);

    if (auth.role === 'eleve') {
      // Un élève n'a pas de bibliothèque : il ouvre l'œuvre par son activité.
      return NextResponse.json({ success: true, data: [] });
    }

    return NextResponse.json({
      success: true,
      data: toutes.filter((o) => o.profId === auth.uid),
      shared: toutes.filter((o) => o.shared && o.profId !== auth.uid && !o.archive),
      otherProfs: toutes.filter((o) => o.profId !== auth.uid && !o.shared && !o.archive),
    });
  } catch (error) {
    console.error('Erreur GET /api/oeuvres:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  if (auth.role !== 'prof') return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });

  try {
    const body = await request.json();
    const titre = typeof body.titre === 'string' ? body.titre.trim() : '';
    if (!titre) {
      return NextResponse.json({ success: false, message: 'Titre requis' }, { status: 400 });
    }

    const id = generateOeuvreId();
    const now = new Date();

    const profDoc = await adminDb.collection('professeurs').doc(auth.email.toLowerCase()).get();
    const profData = profDoc.exists ? profDoc.data() : null;
    const profName = profData ? `${profData.prenom || ''} ${profData.nom || ''}`.trim() : auth.email;

    // Seul l'admin peut marquer une œuvre comme exemple partagé — même règle
    // que les grilles.
    const shared = auth.isAdmin && body.shared === true;

    const oeuvre = {
      id,
      titre,
      auteur: typeof body.auteur === 'string' ? body.auteur.trim() : '',
      description: typeof body.description === 'string' ? body.description.trim() : '',
      chapitres: [],
      profId: auth.uid,
      profName,
      shared,
      archive: false,
      anneeScolaire: calculateSchoolYear(),
      createdAt: now,
      updatedAt: now,
    };

    await adminDb.collection('oeuvres').doc(id).set(oeuvre);

    return NextResponse.json({
      success: true,
      data: { ...oeuvre, createdAt: now.toISOString(), updatedAt: now.toISOString() },
      message: `Œuvre « ${titre} » créée`,
    });
  } catch (error) {
    console.error('Erreur POST /api/oeuvres:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
