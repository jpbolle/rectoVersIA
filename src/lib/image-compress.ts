// Compression d'image côté navigateur avant upload — CLIENT UNIQUEMENT.
// Objectif : passer sous la limite d'un document Firestore (1 Mo), le base64
// gonflant le poids de ~33 % → cible ≤ 700 Ko par image.

export const MAX_IMAGE_BYTES = 700 * 1024;

// Dimension maximale (px) après redimensionnement — suffisant pour lire un scan
const MAX_DIMENSION = 1600;

export interface CompressedImage {
  blob: Blob;
  mimeType: string;
  /** Nom de fichier ajusté si le format a été converti en JPEG */
  name: string;
}

/**
 * Retourne l'image telle quelle si elle est déjà assez légère, sinon la
 * redimensionne et la convertit en JPEG à qualité décroissante.
 * Retourne null si l'image ne peut pas être réduite sous la limite
 * (ex. GIF animé trop lourd — la conversion perdrait l'animation).
 */
export async function compressImage(file: File): Promise<CompressedImage | null> {
  if (file.size <= MAX_IMAGE_BYTES) {
    return { blob: file, mimeType: file.type, name: file.name };
  }

  // Un GIF converti perd son animation : on refuse plutôt que de dégrader
  if (file.type === 'image/gif') return null;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  for (const quality of [0.82, 0.65, 0.5]) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality)
    );
    if (blob && blob.size <= MAX_IMAGE_BYTES) {
      const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
      return { blob, mimeType: 'image/jpeg', name };
    }
  }

  return null;
}
