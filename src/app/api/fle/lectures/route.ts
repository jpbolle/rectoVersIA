import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { importerCours } from '@/lib/import-cours';
import type { DemandeImport } from '@/lib/import-cours';
import {
  COLL_LECTURES,
  ficheFleDeLEleve,
  genererIdLecture,
  lecturesDe,
  profPeutLire,
} from '@/lib/lecture-cours-server';
import { profilLinguistique } from '@/lib/niveaux-fle-server';
import { sectionsVides } from '@/types/lecture-cours';

// Lectures de cours FLE (lecturesCours/{id}) — plan du 2026-10-08.
//
//  GET            — l'élève connecté liste SES lectures (résumés)
//  GET ?eleveId=  — un prof liste celles d'un élève de sa classe FLE
//  POST           — l'élève importe un cours (multipart : lien, PDF ou texte)

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 });

  const eleveId = new URL(request.url).searchParams.get('eleveId');
  try {
    if (eleveId) {
      if (auth.role !== 'prof') {
        return NextResponse.json({ success: false, message: 'Accès réservé aux professeurs' }, { status: 403 });
      }
      if (!(await profPeutLire(auth, eleveId))) {
        return NextResponse.json({ success: false, message: 'Cet élève n’est pas dans vos classes' }, { status: 403 });
      }
      return NextResponse.json({ success: true, data: await lecturesDe('eleveId', eleveId) });
    }
    if (auth.role !== 'eleve') {
      return NextResponse.json({ success: false, message: 'Accès réservé aux élèves' }, { status: 403 });
    }
    return NextResponse.json({ success: true, data: await lecturesDe('eleveUid', auth.uid) });
  } catch (error) {
    console.error('Erreur GET /api/fle/lectures:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 });
  if (auth.role !== 'eleve') {
    return NextResponse.json({ success: false, message: 'Accès réservé aux élèves' }, { status: 403 });
  }

  try {
    // Réservé aux élèves d'une classe FLE : c'est leur outil
    const fiche = await ficheFleDeLEleve(auth.uid, auth.email);
    if (!fiche) {
      return NextResponse.json(
        { success: false, message: 'La lecture de cours est réservée aux classes FLE.' },
        { status: 403 }
      );
    }

    const form = await request.formData();
    const mode = String(form.get('mode') || '');
    const titre = String(form.get('titre') || '');
    let demande: DemandeImport;
    if (mode === 'lien') {
      const url = String(form.get('url') || '').trim();
      if (!url) return NextResponse.json({ success: false, message: 'Colle un lien.' }, { status: 400 });
      demande = { mode: 'lien', url, titre };
    } else if (mode === 'texte') {
      const texte = String(form.get('texte') || '');
      demande = { mode: 'texte', texte, titre };
    } else if (mode === 'pdf') {
      const fichier = form.get('fichier');
      if (!(fichier instanceof File)) {
        return NextResponse.json({ success: false, message: 'Dépose un fichier PDF.' }, { status: 400 });
      }
      demande = {
        mode: 'pdf',
        buffer: Buffer.from(await fichier.arrayBuffer()),
        nomFichier: fichier.name || 'cours.pdf',
        titre,
      };
    } else {
      return NextResponse.json({ success: false, message: 'Mode d’import inconnu.' }, { status: 400 });
    }

    // L'extraction dit elle-même pourquoi elle refuse (pages, partage, longueur)
    let resultat;
    try {
      resultat = await importerCours(demande);
    } catch (err) {
      return NextResponse.json(
        { success: false, message: err instanceof Error ? err.message : 'Import impossible.' },
        { status: 422 }
      );
    }

    // Langue et niveau copiés au moment de l'import : la lecture reste
    // cohérente même si le prof bouge les curseurs ensuite
    const profil = await profilLinguistique(fiche.eleveId);

    const id = genererIdLecture();
    const now = new Date();
    await adminDb.collection(COLL_LECTURES).doc(id).set({
      id,
      eleveUid: auth.uid,
      eleveId: fiche.eleveId,
      classeId: fiche.classeId,
      titre: resultat.titre,
      source: resultat.source,
      texte: resultat.texte,
      langue: profil.langue,
      niveau: profil.niveau ?? 'a1',
      sections: sectionsVides(),
      reponses: {},
      ...(resultat.usage ? { usageImport: resultat.usage } : {}),
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Erreur POST /api/fle/lectures:', error);
    // En développement, la cause s'affiche dans la popup ; en production, rien de plus
    const detail = process.env.NODE_ENV !== 'production' && error instanceof Error ? ` — ${error.message}` : '';
    return NextResponse.json({ success: false, message: `Erreur serveur${detail}` }, { status: 500 });
  }
}
