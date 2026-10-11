import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { accesDevoir } from '@/lib/classe-acces';
import { docToOeuvre, docToSection } from '@/lib/oeuvre-server';
import { lirePortfolioContenu } from '@/lib/portfolio-server';
import { identiteEleve, sequenceOuverteA } from '@/lib/sequence-server';
import { typesDuDepot } from '@/types/portfolio';

// Le dépôt « SCÈNE D'UNE ŒUVRE » (JP, 2026-10-11) : l'élève choisit la pièce
// puis la scène dans l'œuvre fixée par le prof, au lieu d'un champ libre — on
// ne peut plus se tromper de texte.
//
// GET ?devoirId={portfolio}&etapeId=&depotId=[&sectionId=]
//  → { oeuvreTitre, pieces: [{ titre, scenes: [{ id, titre }] }],
//      section?: { id, titre, blocs } }
// La table des pièces vient de l'œuvre du DÉPÔT, jamais d'une œuvre passée par
// le client ; seuls les BLOCS de la scène partent (pas ses questions).

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

  try {
    const params = request.nextUrl.searchParams;
    const devoirId = params.get('devoirId') || '';
    const etapeId = params.get('etapeId') || '';
    const depotId = params.get('depotId') || '';
    const devoirSnap = await adminDb.collection('devoirs').doc(devoirId).get();
    if (!devoirSnap.exists || devoirSnap.data()?.typeTravail !== 'portfolio') {
      return NextResponse.json({ success: false, message: 'Portfolio introuvable' }, { status: 404 });
    }

    // L'élève à qui le portfolio est ouvert, ou un prof de l'activité (aperçu, copie)
    if (auth.role === 'prof') {
      if (!auth.isAdmin && !(await accesDevoir(devoirId, auth))) {
        return NextResponse.json({ success: false, message: 'Acces refuse' }, { status: 403 });
      }
    } else {
      const identite = await identiteEleve(auth.uid, auth.email);
      if (!(await sequenceOuverteA({ id: devoirId, ...devoirSnap.data() }, identite))) {
        return NextResponse.json({ success: false, message: 'Devoir non disponible' }, { status: 403 });
      }
    }

    const etape = lirePortfolioContenu(devoirSnap.data()?.portfolio).etapes.find((e) => e.id === etapeId);
    const depot = etape?.depots?.find((d) => d.id === depotId);
    if (!depot || !typesDuDepot(depot).includes('scene') || !depot.oeuvreId) {
      return NextResponse.json({ success: false, message: 'Aucune œuvre choisie pour ce dépôt' }, { status: 404 });
    }

    const oeuvreSnap = await adminDb.collection('oeuvres').doc(depot.oeuvreId).get();
    if (!oeuvreSnap.exists) return NextResponse.json({ success: false, message: 'Œuvre introuvable' }, { status: 404 });
    const oeuvre = docToOeuvre(oeuvreSnap);
    // Une PIÈCE = un chapitre de l'œuvre ; une SCÈNE = une de ses sections
    // (« Acte I — Scène 2 — DOM JUAN, SGANARELLE »). Les chapitres sans section
    // ne servent à rien ici.
    const pieces = oeuvre.chapitres
      .map((c) => ({
        titre: c.titre,
        scenes: c.sections.map((s) => ({ id: s.id, titre: [s.groupe, s.titre].filter(Boolean).join(' — ') })),
      }))
      .filter((p) => p.scenes.length > 0);

    const sectionId = params.get('sectionId');
    let section: { id: string; titre: string; blocs: unknown[] } | null = null;
    if (sectionId) {
      const piece = pieces.find((p) => p.scenes.some((s) => s.id === sectionId));
      const scene = piece?.scenes.find((s) => s.id === sectionId);
      if (piece && scene) {
        const sectionSnap = await adminDb.collection('oeuvres').doc(oeuvre.id).collection('sections').doc(sectionId).get();
        if (sectionSnap.exists) {
          section = { id: sectionId, titre: `${piece.titre} — ${scene.titre}`, blocs: docToSection(sectionSnap).blocs };
        }
      }
    }

    return NextResponse.json({ success: true, data: { oeuvreTitre: oeuvre.titre, pieces, section } });
  } catch (error) {
    console.error('Erreur GET /api/portfolio/scene:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
