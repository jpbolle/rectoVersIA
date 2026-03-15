import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import type { Professeur } from '@/types/professeur';

// GET - Lister tous les professeurs (admin uniquement)
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 });
  }

  if (!auth.isAdmin) {
    return NextResponse.json({ success: false, message: 'Accès réservé à l\'administrateur' }, { status: 403 });
  }

  try {
    const snapshot = await adminDb.collection('professeurs').orderBy('nom').get();
    const professeurs: Professeur[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Professeur[];

    return NextResponse.json({ success: true, data: professeurs });
  } catch (error) {
    console.error('Erreur GET professeurs:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

// POST - Créer un professeur (admin uniquement)
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 });
  }

  if (!auth.isAdmin) {
    return NextResponse.json({ success: false, message: 'Accès réservé à l\'administrateur' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { nom, prenom, email } = body;

    if (!nom || !prenom || !email) {
      return NextResponse.json(
        { success: false, message: 'Nom, prénom et email sont requis' },
        { status: 400 }
      );
    }

    const emailLower = email.toLowerCase().trim();
    const docId = emailLower;

    // Vérifier que le professeur n'existe pas déjà
    const existing = await adminDb.collection('professeurs').doc(docId).get();
    if (existing.exists) {
      return NextResponse.json(
        { success: false, message: 'Un professeur avec cet email existe déjà' },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const professeur: Professeur = {
      id: docId,
      nom: nom.trim(),
      prenom: prenom.trim(),
      email: emailLower,
      createdAt: now,
      expiresAt: body.expiresAt || null,
    };

    await adminDb.collection('professeurs').doc(docId).set(professeur);

    return NextResponse.json({ success: true, data: professeur }, { status: 201 });
  } catch (error) {
    console.error('Erreur POST professeur:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
