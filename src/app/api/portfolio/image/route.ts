import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { lireContenuEleve } from '@/lib/portfolio-etat';
import { clePartie } from '@/types/portfolio';

// Dépôt d'une IMAGE dans un portfolio (plan 2026-10-10, séance c).
//
// ⚠️ RGPD : une image d'élève peut montrer un visage (affiche, selfie-BD).
// Elle ne va donc PAS dans `ressourceImages` (servie par une route publique à
// lien secret) mais dans `portfolioImages`, servie par une route AUTHENTIFIÉE
// (`/api/portfolio/image/[id]`) : l'élève auteur et les profs de sa copie.
// Accès serveur uniquement (adminDb) → aucune règle Firestore.
//
// Stockage en base64 dans le document, comme `ressourceImages` : ≤ 700 Ko,
// l'image est compressée dans le navigateur avant l'envoi
// (`src/lib/image-compress.ts`). Le contenu reste en clair (production
// d'élève, règle du projet) ; seul l'accès est restreint.
//
// La route écrit AUSSI la clé dans la copie (`reponses[{etape}/{depot}/image]`)
// et supprime l'image remplacée : l'image ne reste jamais orpheline si
// l'élève quitte la page aussitôt après l'envoi.

const TYPES_IMAGE = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_IMAGE_BYTES = 700 * 1024;

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  if (auth.role !== 'eleve') return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });

  try {
    const form = await request.formData();
    const fichier = form.get('file');
    const travailId = String(form.get('travailId') || '');
    const etapeId = String(form.get('etapeId') || '');
    const depotId = String(form.get('depotId') || '');

    if (!(fichier instanceof File)) {
      return NextResponse.json({ success: false, message: 'Aucune image reçue' }, { status: 400 });
    }
    if (!travailId || !etapeId || !depotId || etapeId.length > 40 || depotId.length > 40) {
      return NextResponse.json({ success: false, message: 'Requête incomplète' }, { status: 400 });
    }
    if (!TYPES_IMAGE.includes(fichier.type)) {
      return NextResponse.json(
        { success: false, message: 'Format non accepté : JPG, PNG, GIF ou WebP uniquement.' },
        { status: 400 }
      );
    }
    if (fichier.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { success: false, message: `Image trop lourde (${Math.round(fichier.size / 1024)} Ko, maximum 700 Ko).` },
        { status: 400 }
      );
    }

    // La copie doit être celle de l'élève, et pas encore remise
    const travailRef = adminDb.collection('travaux').doc(travailId);
    const travailSnap = await travailRef.get();
    const travail = travailSnap.data();
    if (!travailSnap.exists || !travail || travail.studentId !== auth.uid) {
      return NextResponse.json({ success: false, message: 'Acces refuse' }, { status: 403 });
    }
    if (travail.status === 'submitted') {
      return NextResponse.json({ success: false, message: 'Le travail a déjà été remis' }, { status: 403 });
    }

    const imageRef = adminDb.collection('portfolioImages').doc();
    await imageRef.set({
      data: Buffer.from(await fichier.arrayBuffer()).toString('base64'),
      mimeType: fichier.type,
      travailId,
      devoirId: String(travail.devoirId || ''),
      eleveUid: auth.uid,
      createdAt: new Date(),
    });

    // La clé dans la copie, posée dans une transaction (un autre champ peut
    // être enregistré au même instant) ; l'ancienne image est supprimée.
    const cle = clePartie(etapeId, depotId, 'image');
    const ancienne = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(travailRef);
      const contenu = lireContenuEleve(typeof snap.data()?.content === 'string' ? snap.data()!.content : '');
      const precedente = contenu.reponses[cle] ?? null;
      tx.update(travailRef, {
        content: JSON.stringify({ ...contenu, reponses: { ...contenu.reponses, [cle]: imageRef.id } }),
        updatedAt: new Date().toISOString(),
      });
      return precedente;
    });
    if (ancienne && ancienne !== imageRef.id) {
      const vieille = await adminDb.collection('portfolioImages').doc(ancienne).get();
      if (vieille.exists && vieille.data()?.eleveUid === auth.uid) await vieille.ref.delete();
    }

    return NextResponse.json({ success: true, data: { id: imageRef.id } });
  } catch (error) {
    console.error('Erreur POST /api/portfolio/image:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
