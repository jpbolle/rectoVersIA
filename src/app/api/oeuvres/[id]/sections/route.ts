// Création d'une section (un écran de la liseuse) dans une œuvre.
// La lecture d'une section précise passe par [sectionId] : c'est ce qui rend
// le chargement paresseux — l'élève ne télécharge que la scène qu'il ouvre.

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { chapitresPourFirestore, docToOeuvre, docToSection } from '@/lib/oeuvre-server';
import { generateSectionId } from '@/types/oeuvre';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  if (auth.role !== 'prof') return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });

  try {
    const { id } = await params;
    const oeuvreRef = adminDb.collection('oeuvres').doc(id);
    const snap = await oeuvreRef.get();
    if (!snap.exists) {
      return NextResponse.json({ success: false, message: 'Œuvre introuvable' }, { status: 404 });
    }

    const oeuvre = docToOeuvre(snap);
    if (oeuvre.profId !== auth.uid && !auth.isAdmin) {
      return NextResponse.json({ success: false, message: 'Acces refuse' }, { status: 403 });
    }

    const body = await request.json();
    const chapitreId = typeof body.chapitreId === 'string' ? body.chapitreId : '';
    if (!chapitreId || !oeuvre.chapitres.some((c) => c.id === chapitreId)) {
      return NextResponse.json({ success: false, message: 'Chapitre inconnu' }, { status: 400 });
    }

    const sectionId = generateSectionId();
    const section = {
      id: sectionId,
      chapitreId,
      titre: typeof body.titre === 'string' && body.titre.trim() ? body.titre.trim() : 'Nouvelle section',
      groupe: typeof body.groupe === 'string' ? body.groupe.trim() : '',
      chapeau: typeof body.chapeau === 'string' ? body.chapeau : '',
      colonnes: body.colonnes === 2 ? 2 : 1,
      blocs: [],
      questions: [],
    };

    await oeuvreRef.collection('sections').doc(sectionId).set(section);

    // Le sommaire du document parent suit : c'est lui que la liseuse charge.
    const chapitres = oeuvre.chapitres.map((c) =>
      c.id === chapitreId
        ? {
            ...c,
            sections: [
              ...c.sections,
              { id: sectionId, titre: section.titre, groupe: section.groupe, aQuestions: false },
            ],
          }
        : c
    );
    // Le sommaire relu porte des `undefined` sur les valeurs vides : Firestore
    // les refuse, d'où le passage obligé par chapitresPourFirestore.
    await oeuvreRef.update({ chapitres: chapitresPourFirestore(chapitres), updatedAt: new Date() });

    const cree = await oeuvreRef.collection('sections').doc(sectionId).get();
    return NextResponse.json({ success: true, data: docToSection(cree) });
  } catch (error) {
    console.error('Erreur POST /api/oeuvres/[id]/sections:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
