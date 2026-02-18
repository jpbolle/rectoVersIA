import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  type FirebaseStorage,
} from 'firebase/storage';
import { getFirebaseApp } from './config';

let _storage: FirebaseStorage | null = null;

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

export function getFirebaseStorage(): FirebaseStorage {
  if (!_storage) {
    _storage = getStorage(getFirebaseApp());
  }
  return _storage;
}

export function validateFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Type de fichier non autorise: ${file.type}. Formats acceptes: PDF, images (jpg, png, gif, webp), Word (.doc, .docx)`,
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `Fichier trop volumineux (${sizeMB}MB). Taille maximale: 10MB`,
    };
  }

  return { valid: true };
}

export async function uploadDevoirFile(
  file: File,
  devoirId: string
): Promise<{ url: string; name: string; type: string }> {
  const validation = validateFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const storage = getFirebaseStorage();
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const filePath = `devoirs/${devoirId}/${timestamp}_${safeName}`;
  const fileRef = ref(storage, filePath);

  await uploadBytes(fileRef, file);
  const url = await getDownloadURL(fileRef);

  return {
    url,
    name: file.name,
    type: file.type,
  };
}

export async function uploadMultipleFiles(
  files: File[],
  devoirId: string
): Promise<{ url: string; name: string; type: string }[]> {
  const results = await Promise.all(
    files.map((file) => uploadDevoirFile(file, devoirId))
  );
  return results;
}

export async function deleteDevoirFile(fileUrl: string): Promise<void> {
  const storage = getFirebaseStorage();
  const fileRef = ref(storage, fileUrl);
  await deleteObject(fileRef);
}

export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

export function getFileIcon(mimeType: string): string {
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.startsWith('image/')) return '🖼️';
  if (
    mimeType === 'application/msword' ||
    mimeType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return '📝';
  }
  return '📎';
}
