import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { generateAnnonceId, normalizeLien } from '@/types/annonce';
import type { Annonce, AnnonceCible } from '@/types/annonce';

// Annonces de l'administration — écrites ici, lues par /api/notifications.
// GET reste réservé à l'admin : personne d'autre n'a à voir la liste complète
// (une annonce aux profs n'existe pas pour un élève).
//
// POST connaît DEUX auteurs possibles :
//   - l'admin, qui s'adresse à un public (profs / élèves / tout le monde) ;
//   - un PROF, qui s'adresse à UN de ses élèves (`cible: 'eleve'`) — un
//     encouragement, un rappel, un mot. C'est la même mécanique de cloche, et
//     rien ne justifiait d'en construire une seconde.
//
// L'appartenance de l'élève à une classe du prof est vérifiée ICI. Sans quoi
// n'importe quel prof pourrait écrire à n'importe quel élève de l'école.

const CIBLES_ADMIN: AnnonceCible[] = ['profs', 'eleves', 'tous'];
const TONS = ['felicitation', 'rappel'] as const;
const MAX_MESSAGE = 500;

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth || !auth.isAdmin) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const snap = await adminDb
      .collection('annonces')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Annonce);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Erreur GET /api/annonces:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const cible = body.cible as AnnonceCible;

    if (!message) {
      return NextResponse.json(
        { success: false, message: 'Le message est vide.' },
        { status: 400 }
      );
    }

    let destinataireUid: string | undefined;

    if (cible === 'eleve') {
      // ── Mot d'un prof à UN de ses élèves ──
      if (auth.role !== 'prof') {
        return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
      }
      destinataireUid = typeof body.destinataireUid === 'string' ? body.destinataireUid : '';
      if (!destinataireUid) {
        return NextResponse.json(
          { success: false, message: 'Destinataire manquant.' },
          { status: 400 }
        );
      }
      if (!(await estMonEleve(auth.uid, destinataireUid)) && !auth.isAdmin) {
        return NextResponse.json(
          { success: false, message: 'Cet élève n’est pas dans vos classes.' },
          { status: 403 }
        );
      }
    } else {
      // ── Annonce de l'administration ──
      if (!auth.isAdmin) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
      }
      if (!CIBLES_ADMIN.includes(cible)) {
        return NextResponse.json(
          { success: false, message: 'Destinataires invalides.' },
          { status: 400 }
        );
      }
    }

    const ton = TONS.includes(body.ton) ? (body.ton as 'felicitation' | 'rappel') : null;

    const annonce: Annonce = {
      id: generateAnnonceId(),
      message: message.slice(0, MAX_MESSAGE),
      cible,
      lien: normalizeLien(body.lien),
      auteurUid: auth.uid,
      createdAt: new Date().toISOString(),
      // Firestore refuse `undefined` : on n'écrit ces champs que s'ils existent
      ...(destinataireUid ? { destinataireUid } : {}),
      ...(ton ? { ton } : {}),
    };

    await adminDb.collection('annonces').doc(annonce.id).set(annonce);
    return NextResponse.json({ success: true, data: annonce });
  } catch (error) {
    console.error('Erreur POST /api/annonces:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

/**
 * L'élève (par son UID Firebase) est-il dans une classe de ce prof ?
 *
 * On part de `eleves.firebaseUid` puis on remonte à `classes.profId`. Le
 * chemin inverse — lister les classes du prof puis leurs élèves — coûterait
 * une requête par classe.
 */
async function estMonEleve(profUid: string, eleveUid: string): Promise<boolean> {
  const snap = await adminDb
    .collection('eleves')
    .where('firebaseUid', '==', eleveUid)
    .limit(5)
    .get();
  if (snap.empty) return false;

  const classeIds = [
    ...new Set(snap.docs.map((d) => d.data().classeId as string).filter(Boolean)),
  ];
  for (const classeId of classeIds) {
    const classe = await adminDb.collection('classes').doc(classeId).get();
    if (classe.exists && classe.data()?.profId === profUid) return true;
  }
  return false;
}
