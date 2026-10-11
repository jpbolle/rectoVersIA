import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/api-auth';
import { contexteGroupe, ecrire, lireEcriture, prendreLaMain, remettre, rendreLaMain } from '@/lib/ecriture-groupe-server';

// LA COPIE DE GROUPE d'une activité d'écriture (étape collective d'un
// portfolio — voir `src/lib/ecriture-groupe-server.ts`).
//
//  GET  ?devoirId=  → { actif: false } (copie individuelle) ou l'état commun :
//                     texte, version, qui a la main. Interrogé toutes les 3 s.
//  POST { devoirId, action: 'prendre' | 'rendre' | 'ecrire' | 'remettre', contenu? }
//
// L'accès est porté par le contexte : seul un membre d'un groupe ACCEPTÉ d'un
// portfolio ouvert, dont l'étape collective renvoie à cette activité, obtient
// autre chose que `{ actif: false }`.

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  if (auth.role !== 'eleve') return NextResponse.json({ success: true, data: { actif: false } });

  try {
    const devoirId = request.nextUrl.searchParams.get('devoirId') || '';
    const ctx = devoirId ? await contexteGroupe(devoirId, auth.uid, auth.email) : null;
    if (!ctx) return NextResponse.json({ success: true, data: { actif: false } });
    return NextResponse.json({ success: true, data: await lireEcriture(ctx, auth.uid, auth.email) });
  } catch (error) {
    console.error('Erreur GET /api/travaux/groupe:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  if (auth.role !== 'eleve') return NextResponse.json({ success: false, message: 'Réservé aux élèves' }, { status: 403 });

  try {
    const body = await request.json();
    const devoirId = typeof body.devoirId === 'string' ? body.devoirId : '';
    const ctx = devoirId ? await contexteGroupe(devoirId, auth.uid, auth.email) : null;
    if (!ctx) return NextResponse.json({ success: false, message: 'Pas de copie de groupe ici' }, { status: 404 });

    switch (body.action) {
      case 'prendre':
        return NextResponse.json({ success: true, data: await prendreLaMain(ctx, auth.uid, auth.email) });
      case 'rendre':
        return NextResponse.json({ success: true, data: await rendreLaMain(ctx, auth.uid) });
      case 'ecrire': {
        if (typeof body.contenu !== 'string') {
          return NextResponse.json({ success: false, message: 'Contenu manquant' }, { status: 400 });
        }
        const r = await ecrire(ctx, auth.uid, body.contenu);
        // Refusé : quelqu'un d'autre a la main — l'élève reçoit l'état pour se recaler
        return NextResponse.json({ success: r.ok, data: r.etat, message: r.ok ? undefined : 'Un camarade a la main' }, { status: r.ok ? 200 : 409 });
      }
      case 'remettre':
        return NextResponse.json({ success: true, data: await remettre(ctx, auth.uid, auth.email) });
      default:
        return NextResponse.json({ success: false, message: 'Action inconnue' }, { status: 400 });
    }
  } catch (error) {
    console.error('Erreur POST /api/travaux/groupe:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
