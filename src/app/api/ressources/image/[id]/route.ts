import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

// Sert une image de ressource stockée en base64 dans Firestore.
// Route publique volontairement : les balises <img> ne peuvent pas envoyer
// d'en-tête d'authentification. L'ID Firestore aléatoire fait office de
// « lien secret » (même modèle que « toute personne disposant du lien ») —
// contenu pédagogique uniquement, jamais de donnée personnelle.

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const doc = await adminDb.collection('ressourceImages').doc(id).get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Image non trouvée' }, { status: 404 });
    }

    const { data, mimeType } = doc.data() as { data: string; mimeType: string };
    const buffer = Buffer.from(data, 'base64');

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': mimeType || 'image/jpeg',
        'Content-Length': String(buffer.length),
        // L'image ne change jamais (une nouvelle image = un nouvel ID)
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Erreur GET /api/ressources/image/[id]:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
