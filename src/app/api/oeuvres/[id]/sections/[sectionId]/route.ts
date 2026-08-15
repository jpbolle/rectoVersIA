// Une section — l'écran que la liseuse affiche.
//
// C'est ici que se joue le chargement paresseux : la liseuse appelle cette
// route à chaque changement de scène, et ne transporte donc jamais l'œuvre
// entière.
//
// ⚠️ RAPPEL : dans cet atelier, le corrigé part AVEC la section (voir
// src/lib/oeuvre-server.ts). Décision assumée de JP — la lecture d'œuvre est
// un outil pour l'élève, rien n'y est noté.

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { chapitresPourFirestore, docToOeuvre, docToSection } from '@/lib/oeuvre-server';
import { sanitizeLectureQuiz } from '@/lib/lecture-server';
import type { OeuvreBloc } from '@/types/oeuvre';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

  try {
    const { id, sectionId } = await params;
    const snap = await adminDb
      .collection('oeuvres')
      .doc(id)
      .collection('sections')
      .doc(sectionId)
      .get();

    if (!snap.exists) {
      return NextResponse.json({ success: false, message: 'Section introuvable' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: docToSection(snap) });
  } catch (error) {
    console.error('Erreur GET section:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  if (auth.role !== 'prof') return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });

  try {
    const { id, sectionId } = await params;
    const oeuvreRef = adminDb.collection('oeuvres').doc(id);
    const oeuvreSnap = await oeuvreRef.get();
    if (!oeuvreSnap.exists) {
      return NextResponse.json({ success: false, message: 'Œuvre introuvable' }, { status: 404 });
    }
    const oeuvre = docToOeuvre(oeuvreSnap);
    if (oeuvre.profId !== auth.uid && !auth.isAdmin) {
      return NextResponse.json({ success: false, message: 'Acces refuse' }, { status: 403 });
    }

    const sectionRef = oeuvreRef.collection('sections').doc(sectionId);
    const existant = await sectionRef.get();
    if (!existant.exists) {
      return NextResponse.json({ success: false, message: 'Section introuvable' }, { status: 404 });
    }

    const body = await request.json();

    const blocs: OeuvreBloc[] = Array.isArray(body.blocs) ? body.blocs : [];
    // Les questions passent par le nettoyage du questionnaire de lecture :
    // c'est le même modèle de question, autant réutiliser le même garde-fou.
    const quiz = sanitizeLectureQuiz({ mode: 'worksheet', questions: body.questions || [] });

    const section = {
      id: sectionId,
      chapitreId: existant.data()?.chapitreId || '',
      titre: typeof body.titre === 'string' && body.titre.trim() ? body.titre.trim() : 'Sans titre',
      groupe: typeof body.groupe === 'string' ? body.groupe.trim() : '',
      chapeau: typeof body.chapeau === 'string' ? body.chapeau : '',
      colonnes: body.colonnes === 2 ? 2 : 1,
      blocs,
      questions: quiz?.questions || [],
    };

    await sectionRef.set(section);

    // Le sommaire porte le titre et la présence d'un formulaire : il suit.
    const chapitres = oeuvre.chapitres.map((c) => ({
      ...c,
      sections: c.sections.map((s) =>
        s.id === sectionId
          ? { ...s, titre: section.titre, groupe: section.groupe, aQuestions: section.questions.length > 0 }
          : s
      ),
    }));
    await oeuvreRef.update({ chapitres: chapitresPourFirestore(chapitres), updatedAt: new Date() });

    const apres = await sectionRef.get();
    return NextResponse.json({ success: true, data: docToSection(apres) });
  } catch (error) {
    console.error('Erreur PUT section:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  if (auth.role !== 'prof') return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });

  try {
    const { id, sectionId } = await params;
    const oeuvreRef = adminDb.collection('oeuvres').doc(id);
    const oeuvreSnap = await oeuvreRef.get();
    if (!oeuvreSnap.exists) {
      return NextResponse.json({ success: false, message: 'Œuvre introuvable' }, { status: 404 });
    }
    const oeuvre = docToOeuvre(oeuvreSnap);
    if (oeuvre.profId !== auth.uid && !auth.isAdmin) {
      return NextResponse.json({ success: false, message: 'Acces refuse' }, { status: 403 });
    }

    await oeuvreRef.collection('sections').doc(sectionId).delete();
    const chapitres = oeuvre.chapitres.map((c) => ({
      ...c,
      sections: c.sections.filter((s) => s.id !== sectionId),
    }));
    await oeuvreRef.update({ chapitres: chapitresPourFirestore(chapitres), updatedAt: new Date() });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur DELETE section:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
