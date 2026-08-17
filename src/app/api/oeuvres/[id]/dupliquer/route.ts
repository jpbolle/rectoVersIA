// Dupliquer une œuvre — le geste qui rend la bibliothèque partageable.
//
// Un prof ne modifie jamais l'œuvre d'un collègue : il en prend une copie,
// qu'il remanie librement (« un prof peut dupliquer une œuvre pour la
// modifier, y ajouter, y retrancher » — JP, 2026-08-15). Même logique que la
// duplication des grilles.
//
// La copie recrée les sections une à une, avec de NOUVEAUX identifiants : deux
// œuvres ne doivent jamais partager un id de section, sans quoi la progression
// des élèves de l'une compterait dans l'autre.

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { calculateSchoolYear } from '@/lib/auth-utils';
import { docToOeuvre, docToSection } from '@/lib/oeuvre-server';
import { generateOeuvreId, generateChapitreId, generateSectionId } from '@/types/oeuvre';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  if (auth.role !== 'prof') return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });

  try {
    const { id } = await params;
    const sourceRef = adminDb.collection('oeuvres').doc(id);
    const sourceSnap = await sourceRef.get();
    if (!sourceSnap.exists) {
      return NextResponse.json({ success: false, message: 'Œuvre introuvable' }, { status: 404 });
    }

    const source = docToOeuvre(sourceSnap);
    const sectionsSnap = await sourceRef.collection('sections').get();
    const parId = new Map(sectionsSnap.docs.map((d) => [d.id, docToSection(d)]));

    const nouvelId = generateOeuvreId();
    const nouvelleRef = adminDb.collection('oeuvres').doc(nouvelId);
    const now = new Date();

    const profDoc = await adminDb.collection('professeurs').doc(auth.email.toLowerCase()).get();
    const profData = profDoc.exists ? profDoc.data() : null;
    const profName = profData ? `${profData.prenom || ''} ${profData.nom || ''}`.trim() : auth.email;

    // Firestore limite un batch à 500 écritures. Une anthologie de 10 pièces
    // tourne autour de 100 sections — on reste très en deçà, mais le découpage
    // en lots évite d'y penser le jour où quelqu'un encodera une intégrale.
    const chapitres = [];
    let batch = adminDb.batch();
    let ecritures = 0;

    for (const chapitre of source.chapitres) {
      const nouveauChapitreId = generateChapitreId();
      const refs = [];

      for (const ref of chapitre.sections) {
        const section = parId.get(ref.id);
        if (!section) continue;
        const nouveauSectionId = generateSectionId();
        batch.set(nouvelleRef.collection('sections').doc(nouveauSectionId), {
          ...section,
          id: nouveauSectionId,
          chapitreId: nouveauChapitreId,
          // `docToSection` pose `undefined` sur les champs vides — parfait
          // pour le rendu, FATAL à l'écriture : Firestore refuse `undefined`
          // et l'écriture entière échoue. Même piège que
          // `chapitresPourFirestore`, ici sur une section entière.
          groupe: section.groupe || '',
          chapeau: section.chapeau || '',
          facesInversees: section.facesInversees === true,
          commentaires: section.commentaires ?? [],
        });
        refs.push({
          id: nouveauSectionId,
          titre: section.titre,
          groupe: section.groupe || '',
          aQuestions: section.questions.length > 0,
        });
        if (++ecritures >= 450) {
          await batch.commit();
          batch = adminDb.batch();
          ecritures = 0;
        }
      }

      chapitres.push({
        id: nouveauChapitreId,
        titre: chapitre.titre,
        sousTitre: chapitre.sousTitre || '',
        sections: refs,
      });
    }

    batch.set(nouvelleRef, {
      id: nouvelId,
      titre: `${source.titre} (copie)`,
      auteur: source.auteur || '',
      description: source.description || '',
      // La couverture suit la copie : elle pointe vers la même ressourceImages
      // (base64 partagé, pas dupliqué). Deux copies du même livre auront donc
      // la même image tant que le collègue ne la remplace pas — c'est voulu :
      // recopier 200 Ko de base64 pour rien serait un gâchis.
      couverture: source.couverture || null,
      chapitres,
      profId: auth.uid,
      profName,
      shared: false,          // une copie n'hérite jamais du statut d'exemple
      archive: false,
      anneeScolaire: calculateSchoolYear(),
      createdAt: now,
      updatedAt: now,
    });
    await batch.commit();

    const cree = await nouvelleRef.get();
    return NextResponse.json({
      success: true,
      data: docToOeuvre(cree),
      message: `« ${source.titre} » dupliquée — elle est à toi, modifie-la`,
    });
  } catch (error) {
    console.error('Erreur POST /api/oeuvres/[id]/dupliquer:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
