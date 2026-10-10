import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { accesDevoir } from '@/lib/classe-acces';
import { docToOeuvre, docToSection } from '@/lib/oeuvre-server';
import { cibleSuivi, suiviDe } from '@/lib/portfolio-suivi-server';
import { identiteEleve, sequenceOuverteA } from '@/lib/sequence-server';

// Le TEXTE d'une valeur attribuée « œuvre » (plan 2026-10-10) : l'œuvre
// entière ou une scène, servie à l'élève À QUI ELLE A ÉTÉ ATTRIBUÉE (son
// groupe), ou au prof de l'activité (`?eleve={uid}`).
//
// Le portfolio ne recopie jamais le texte : il garde la référence, et c'est
// ici qu'on le lit. Seuls les BLOCS partent — pas les questions (et leurs
// corrigés) de la section, qui n'ont rien à faire dans un portfolio.
//
// GET ?devoirId=&valeurId=[&sectionId=][&eleve=]
//  → { titre, oeuvreTitre, sections: [{ id, titre }], section: { id, titre, blocs } }
//  Œuvre entière : toutes ses scènes sont lisibles, une à la fois.

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

  try {
    const params = request.nextUrl.searchParams;
    const devoirId = params.get('devoirId') || '';
    const valeurId = params.get('valeurId') || '';
    const devoirSnap = await adminDb.collection('devoirs').doc(devoirId).get();
    if (!devoirSnap.exists || devoirSnap.data()?.typeTravail !== 'portfolio') {
      return NextResponse.json({ success: false, message: 'Portfolio introuvable' }, { status: 404 });
    }

    let uid = auth.uid;
    let email = auth.email;
    if (auth.role === 'prof') {
      if (!auth.isAdmin && !(await accesDevoir(devoirId, auth))) {
        return NextResponse.json({ success: false, message: 'Acces refuse' }, { status: 403 });
      }
      uid = params.get('eleve') || '';
      email = '';
    } else {
      const identite = await identiteEleve(auth.uid, auth.email);
      if (!(await sequenceOuverteA({ id: devoirId, ...devoirSnap.data() }, identite))) {
        return NextResponse.json({ success: false, message: 'Devoir non disponible' }, { status: 403 });
      }
    }
    if (!uid) return NextResponse.json({ success: false, message: 'Élève manquant' }, { status: 400 });

    // La valeur doit être attribuée à CE groupe (ou à cet élève)
    const suivi = await suiviDe((await cibleSuivi(devoirId, uid, email)).cle);
    const valeur = suivi.valeurs[valeurId];
    if (!valeur || valeur.genre !== 'oeuvre' || !valeur.oeuvreId) {
      return NextResponse.json({ success: false, message: 'Rien d’attribué' }, { status: 404 });
    }

    const oeuvreSnap = await adminDb.collection('oeuvres').doc(valeur.oeuvreId).get();
    if (!oeuvreSnap.exists) return NextResponse.json({ success: false, message: 'Œuvre introuvable' }, { status: 404 });
    const oeuvre = docToOeuvre(oeuvreSnap);
    const toutes = oeuvre.chapitres.flatMap((c) =>
      c.sections.map((s) => ({ id: s.id, titre: [c.titre, s.groupe, s.titre].filter(Boolean).join(' — ') }))
    );
    // Une scène attribuée : elle seule. L'œuvre entière : toutes ses scènes.
    const permises = valeur.sectionId ? toutes.filter((s) => s.id === valeur.sectionId) : toutes;
    const demandee = params.get('sectionId');
    const choisie = permises.find((s) => s.id === demandee) ?? permises[0];
    if (!choisie) {
      return NextResponse.json({ success: true, data: { titre: valeur.titre, oeuvreTitre: oeuvre.titre, sections: [], section: null } });
    }

    const sectionSnap = await adminDb.collection('oeuvres').doc(oeuvre.id).collection('sections').doc(choisie.id).get();
    const section = sectionSnap.exists ? docToSection(sectionSnap) : null;
    return NextResponse.json({
      success: true,
      data: {
        titre: valeur.titre,
        oeuvreTitre: oeuvre.titre,
        sections: permises,
        section: section ? { id: section.id, titre: choisie.titre, blocs: section.blocs } : null,
      },
    });
  } catch (error) {
    console.error('Erreur GET /api/portfolio/valeur:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
