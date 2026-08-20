import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import type { RessourceInteractif } from '@/types/devoir';

// Sert EN GRAND une animation HTML déposée dans les ressources d'une activité.
//
// Route publique, comme celle des images de ressources : un onglet ouvert par
// l'élève ne peut pas plus envoyer d'en-tête d'authentification qu'une balise
// <img>. Les deux identifiants aléatoires font office de « lien secret ».
// Contenu pédagogique écrit par l'administrateur — jamais de donnée
// personnelle. Seules les entrées `kind: 'code'` sortent d'ici.
//
// ═══ POURQUOI CETTE ROUTE EXISTE ═══
//
// Ouvrir l'animation avec `window.open` puis y écrire le code, ou passer par
// un lien `blob:`, lui donnerait L'ORIGINE DE L'APPLICATION : elle pourrait
// alors lire la session Firebase de l'élève et appeler nos routes en son nom.
// C'est précisément ce que le bac à sable de l'iframe empêche.
//
// L'en-tête `Content-Security-Policy: sandbox allow-scripts` place la page
// dans une ORIGINE OPAQUE bien qu'elle soit servie par notre domaine : le
// script s'exécute, mais sans accès aux cookies, au stockage ni à quoi que ce
// soit de l'application. C'est l'équivalent, pour un document servi, du
// `sandbox="allow-scripts"` de l'iframe.
//
// ⚠️ Ne jamais ajouter `allow-same-origin` à cette directive : ce seul mot
// rendrait à la page l'origine de l'application, et toute la précaution
// ci-dessus avec elle.

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ devoirId: string; id: string }> }
) {
  try {
    const { devoirId, id } = await params;
    const snap = await adminDb.collection('devoirs').doc(devoirId).get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Activité non trouvée' }, { status: 404 });
    }

    const ressources = snap.data()?.ressources as
      | { interactifs?: RessourceInteractif[] }
      | null
      | undefined;
    const trouve = (ressources?.interactifs ?? []).find(
      (it) => it.id === id && it.kind === 'code' && !!it.code
    );
    if (!trouve) {
      return NextResponse.json({ error: 'Contenu non trouvé' }, { status: 404 });
    }

    return new NextResponse(trouve.code, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        // Le bac à sable — voir l'explication en tête de fichier.
        'Content-Security-Policy': 'sandbox allow-scripts',
        // Sans quoi un navigateur pourrait deviner un autre type que celui
        // qu'on annonce, et l'interpréter autrement.
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        // Une animation modifiée doit se voir à la réouverture : elle garde
        // son identifiant, contrairement aux images.
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Erreur GET /api/ressources/interactif:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
