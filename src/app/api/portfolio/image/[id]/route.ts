import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { accesTravail } from '@/lib/classe-acces';
import { lireContenuEleve } from '@/lib/portfolio-etat';

// Une image de portfolio — route AUTHENTIFIÉE (voir `../route.ts`).
//  GET    : l'élève auteur, ou un prof qui a accès à la copie (auteur de
//           l'activité, titulaire, coprofesseur — `accesTravail`).
//  DELETE : l'élève auteur seulement, copie non remise ; la clé est retirée
//           de la copie en même temps.
//
// Une balise <img> ne sait pas envoyer le jeton de connexion : l'écran
// télécharge l'image avec `fetch` + en-têtes, puis l'affiche
// (`PortfolioDepotImage`).

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

  try {
    const { id } = await params;
    const snap = await adminDb.collection('portfolioImages').doc(id).get();
    if (!snap.exists) return NextResponse.json({ error: 'Image introuvable' }, { status: 404 });
    const image = snap.data()!;

    let autorise = false;
    if (auth.role === 'eleve') {
      autorise = image.eleveUid === auth.uid;
    } else if (auth.role === 'prof') {
      const travail = await adminDb.collection('travaux').doc(String(image.travailId || '')).get();
      autorise = travail.exists && (await accesTravail(travail.data()!, auth)) !== null;
    }
    if (!autorise) return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });

    const buffer = Buffer.from(String(image.data || ''), 'base64');
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': image.mimeType || 'image/jpeg',
        'Content-Length': String(buffer.length),
        // Jamais dans un cache partagé : c'est une image d'élève
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Erreur GET /api/portfolio/image/[id]:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  if (auth.role !== 'eleve') return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });

  try {
    const { id } = await params;
    const snap = await adminDb.collection('portfolioImages').doc(id).get();
    if (!snap.exists) return NextResponse.json({ success: true });
    const image = snap.data()!;
    if (image.eleveUid !== auth.uid) return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });

    const travailRef = adminDb.collection('travaux').doc(String(image.travailId || ''));
    const travail = await travailRef.get();
    if (travail.exists && travail.data()?.status === 'submitted') {
      return NextResponse.json({ success: false, message: 'Le travail a déjà été remis' }, { status: 403 });
    }

    // Retirer de la copie toute clé qui pointe vers cette image
    if (travail.exists) {
      await adminDb.runTransaction(async (tx) => {
        const t = await tx.get(travailRef);
        const contenu = lireContenuEleve(typeof t.data()?.content === 'string' ? t.data()!.content : '');
        const reponses = Object.fromEntries(Object.entries(contenu.reponses).filter(([, v]) => v !== id));
        if (Object.keys(reponses).length === Object.keys(contenu.reponses).length) return;
        tx.update(travailRef, {
          content: JSON.stringify({ ...contenu, reponses }),
          updatedAt: new Date().toISOString(),
        });
      });
    }
    await snap.ref.delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur DELETE /api/portfolio/image/[id]:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
