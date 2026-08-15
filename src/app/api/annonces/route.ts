import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { generateAnnonceId, normalizeLien } from '@/types/annonce';
import type { Annonce, AnnonceCible } from '@/types/annonce';

// Annonces de l'administration — écrites ici, lues par /api/notifications.
// GET et POST sont réservés à l'admin : personne d'autre n'a à voir la liste
// complète (une annonce aux profs n'existe pas pour un élève).

const CIBLES: AnnonceCible[] = ['profs', 'eleves', 'tous'];
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
  if (!auth || !auth.isAdmin) {
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
    if (!CIBLES.includes(cible)) {
      return NextResponse.json(
        { success: false, message: 'Destinataires invalides.' },
        { status: 400 }
      );
    }

    const annonce: Annonce = {
      id: generateAnnonceId(),
      message: message.slice(0, MAX_MESSAGE),
      cible,
      lien: normalizeLien(body.lien),
      auteurUid: auth.uid,
      createdAt: new Date().toISOString(),
    };

    await adminDb.collection('annonces').doc(annonce.id).set(annonce);
    return NextResponse.json({ success: true, data: annonce });
  } catch (error) {
    console.error('Erreur POST /api/annonces:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
