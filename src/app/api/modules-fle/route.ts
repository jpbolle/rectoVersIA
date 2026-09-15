import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { calculateSchoolYear } from '@/lib/auth-utils';
import { docToModuleFle, idsPourFirestore, nomDuProf } from '@/lib/module-fle-server';
import { sanitizeRessources } from '@/lib/ressources-server';
import { generateModuleFleId } from '@/types/module-fle';

// Bibliothèque de modules FLE.
//  GET  : trois paniers — les miens, les exemples partagés, ceux des collègues
//  POST : créer un module (titre, type, niveau au minimum)

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  if (auth.role === 'eleve') {
    // Un élève n'a pas de bibliothèque : il rencontre le module par sa séquence
    return NextResponse.json({ success: true, data: [], shared: [], otherProfs: [] });
  }

  try {
    let snapshot;
    try {
      snapshot = await adminDb.collection('modulesFle').orderBy('titre', 'asc').get();
    } catch (queryError: unknown) {
      // Code 5 = collection absente : la bibliothèque est simplement vide
      if ((queryError as { code?: number }).code === 5) {
        return NextResponse.json({ success: true, data: [], shared: [], otherProfs: [] });
      }
      throw queryError;
    }
    const tous = snapshot.docs.map(docToModuleFle);
    return NextResponse.json({
      success: true,
      data: tous.filter((m) => m.profId === auth.uid),
      shared: tous.filter((m) => m.shared && m.profId !== auth.uid && !m.archive),
      otherProfs: tous.filter((m) => m.profId !== auth.uid && !m.shared && !m.archive),
    });
  } catch (error) {
    console.error('Erreur GET /api/modules-fle:', error);
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
    if (!titre) {
      return NextResponse.json({ success: false, message: 'Titre requis' }, { status: 400 });
    }

    const id = generateModuleFleId();
    const now = new Date();
    const moduleFle = {
      id,
      titre,
      description: typeof body.description === 'string' ? body.description.trim().slice(0, 1000) : '',
      type: typeof body.type === 'string' ? body.type.trim().slice(0, 60) : '',
      niveau: typeof body.niveau === 'string' ? body.niveau.trim().slice(0, 60) : '',
      competences: idsPourFirestore(body.competences),
      introduction: typeof body.introduction === 'string' ? body.introduction : '',
      // Même garde-fou que les activités : l'onglet Interactif y met du code
      ressources: sanitizeRessources(body.ressources, { codeAutorise: auth.isAdmin }),
      profId: auth.uid,
      profName: await nomDuProf(auth),
      shared: auth.isAdmin && body.shared === true,
      archive: false,
      anneeScolaire: calculateSchoolYear(),
      createdAt: now,
      updatedAt: now,
    };
    await adminDb.collection('modulesFle').doc(id).set(moduleFle);

    return NextResponse.json({
      success: true,
      data: { ...moduleFle, createdAt: now.toISOString(), updatedAt: now.toISOString() },
      message: `Module « ${titre} » créé`,
    });
  } catch (error) {
    console.error('Erreur POST /api/modules-fle:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
