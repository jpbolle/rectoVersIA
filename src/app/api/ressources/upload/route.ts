import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';

// Upload d'images de ressources — stockées en base64 dans Firestore
// (collection ressourceImages, accès serveur uniquement — pas de Storage).
// Limite : 1 Mo par document Firestore → images ≤ 700 Ko, compressées côté
// client avant envoi (src/lib/image-compress.ts). Les PDF et documents longs
// passent par l'onglet Lien.

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_IMAGE_BYTES = 700 * 1024;

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }
  if (auth.role !== 'prof') {
    return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Aucun fichier fourni' },
        { status: 400 }
      );
    }

    for (const file of files) {
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return NextResponse.json(
          {
            success: false,
            message: `Format non accepté : ${file.name}. Images uniquement (JPG, PNG, GIF, WebP) — pour un PDF ou un document long, utilisez l'onglet Lien.`,
          },
          { status: 400 }
        );
      }
      if (file.size > MAX_IMAGE_BYTES) {
        const sizeKB = Math.round(file.size / 1024);
        return NextResponse.json(
          {
            success: false,
            message: `Image trop volumineuse : ${file.name} (${sizeKB} Ko). Max : 700 Ko`,
          },
          { status: 400 }
        );
      }
    }

    const uploaded = [];
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const docRef = adminDb.collection('ressourceImages').doc();
      await docRef.set({
        name: file.name,
        mimeType: file.type,
        data: buffer.toString('base64'),
        profId: auth.uid,
        createdAt: new Date(),
      });

      uploaded.push({
        name: file.name,
        url: `/api/ressources/image/${docRef.id}`,
        fileId: docRef.id,
        mimeType: file.type,
      });
    }

    return NextResponse.json({ success: true, data: { files: uploaded } });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Erreur POST /api/ressources/upload:', msg);
    return NextResponse.json(
      { success: false, message: `Erreur lors de l'upload : ${msg}` },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }
  if (auth.role !== 'prof') {
    return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
  }

  const fileId = new URL(request.url).searchParams.get('id');
  if (!fileId) {
    return NextResponse.json(
      { success: false, message: 'Paramètre id requis' },
      { status: 400 }
    );
  }

  try {
    const docRef = adminDb.collection('ressourceImages').doc(fileId);
    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json({ success: true }); // déjà supprimée
    }
    // Seul le prof qui a déposé l'image peut la supprimer
    if (doc.data()?.profId !== auth.uid) {
      return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
    }
    await docRef.delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Erreur DELETE /api/ressources/upload:', msg);
    return NextResponse.json(
      { success: false, message: 'Erreur lors de la suppression' },
      { status: 500 }
    );
  }
}
