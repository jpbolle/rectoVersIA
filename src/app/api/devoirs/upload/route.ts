import { NextRequest, NextResponse } from 'next/server';
import { getAdminStorage } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

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
    const devoirId = formData.get('devoirId') as string;
    const files = formData.getAll('files') as File[];

    if (!devoirId) {
      return NextResponse.json(
        { success: false, message: 'devoirId requis' },
        { status: 400 }
      );
    }

    if (!files || files.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Aucun fichier fourni' },
        { status: 400 }
      );
    }

    // Validation des fichiers
    for (const file of files) {
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return NextResponse.json(
          {
            success: false,
            message: `Type de fichier non autorise: ${file.name} (${file.type}). Formats acceptes: PDF, images, Word`,
          },
          { status: 400 }
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        return NextResponse.json(
          {
            success: false,
            message: `Fichier trop volumineux: ${file.name} (${sizeMB}MB). Max: 10MB`,
          },
          { status: 400 }
        );
      }
    }

    // Upload des fichiers vers Firebase Storage
    const storage = getAdminStorage();
    const bucket = storage.bucket();
    console.log(`[Upload] Bucket: ${bucket.name}, Devoir: ${devoirId}, Fichiers: ${files.length}`);

    const uploadedFiles: { url: string; name: string; type: string }[] = [];

    for (const file of files) {
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `devoirs/${devoirId}/${timestamp}_${safeName}`;

      console.log(`[Upload] Uploading ${file.name} (${file.size} bytes, ${file.type}) -> ${filePath}`);

      const buffer = Buffer.from(await file.arrayBuffer());
      const fileRef = bucket.file(filePath);

      await fileRef.save(buffer, {
        metadata: {
          contentType: file.type,
        },
      });

      console.log(`[Upload] File saved to Storage: ${filePath}`);

      // Generer une URL signee valable 7 jours
      const [signedUrl] = await fileRef.getSignedUrl({
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
      });

      console.log(`[Upload] Signed URL generated for ${file.name}`);

      uploadedFiles.push({
        url: signedUrl,
        name: file.name,
        type: file.type,
      });
    }

    console.log(`[Upload] Success: ${uploadedFiles.length} fichier(s) uploade(s)`);

    return NextResponse.json({
      success: true,
      data: { files: uploadedFiles },
      message: `${uploadedFiles.length} fichier(s) uploade(s) avec succes`,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : '';
    console.error(`[Upload] ERREUR: ${errMsg}`);
    console.error(`[Upload] Stack: ${errStack}`);
    return NextResponse.json(
      { success: false, message: `Erreur lors de l'upload: ${errMsg}` },
      { status: 500 }
    );
  }
}
