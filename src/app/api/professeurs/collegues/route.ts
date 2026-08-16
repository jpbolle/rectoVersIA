// Liste des collègues — pour choisir avec QUI partager une ressource.
//
// Route séparée de /api/professeurs, qui reste réservée à l'admin : celle-ci
// est lisible par tout professeur, mais ne renvoie donc QUE le strict
// nécessaire au sélecteur — un nom et l'email qui sert d'identifiant. Ni date
// de création, ni date d'expiration d'accès : ce sont des informations de
// gestion, elles ne regardent que l'administration.
//
// L'appelant ne figure jamais dans sa propre liste : on ne se partage pas une
// ressource à soi-même.

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';

export interface Collegue {
  email: string;   // = id du document, en minuscules
  nom: string;     // « Prénom Nom », déjà assemblé
}

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  if (auth.role !== 'prof') return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });

  try {
    const snap = await adminDb.collection('professeurs').get();
    const moi = (auth.email || '').toLowerCase();

    const collegues: Collegue[] = snap.docs
      .map((d) => {
        const p = d.data() as { nom?: string; prenom?: string; email?: string };
        const email = (p.email || d.id).toLowerCase();
        const nom = `${p.prenom || ''} ${p.nom || ''}`.trim();
        return { email, nom: nom || email };
      })
      .filter((c) => c.email && c.email !== moi)
      .sort((a, b) => a.nom.localeCompare(b.nom));

    return NextResponse.json({ success: true, data: collegues });
  } catch (error) {
    console.error('Erreur GET /api/professeurs/collegues:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
