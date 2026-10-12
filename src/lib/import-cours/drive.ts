// PDF d'origine des lectures de cours, rangés dans Google Drive — SERVEUR UNIQUEMENT.
//
// Plan du 2026-10-12 (`harnais/plans/2026-10-12-pdf-original-lecture-cours.md`) :
// le PDF importé est conservé pour que l'élève garde ses repères (pages,
// images, mise en page). Il est déposé par le compte de service (celui de
// Google Sheets) dans un dossier d'un DRIVE PARTAGÉ de l'école — un compte de
// service n'a pas d'espace à lui dans un Drive ordinaire. Le fichier n'est
// partagé avec personne : seul le serveur le lit, et le sert à l'élève et à
// ses profs (`/api/fle/lectures/[id]/pdf`). Son nom ne porte jamais celui de
// l'élève (RGPD) : identifiant du document + titre.

import { Readable } from 'stream';
import { google, type drive_v3 } from 'googleapis';

let client: drive_v3.Drive | null = null;

function clientDrive(): drive_v3.Drive {
  if (!client) {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    client = google.drive({ version: 'v3', auth });
  }
  return client;
}

/** Le dossier est-il configuré ? Sans lui, l'import marche toujours, sans PDF conservé. */
export function driveConfigure(): boolean {
  return !!process.env.DRIVE_COURS_FOLDER_ID && !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
}

/** Dépose un PDF dans le dossier ; rend l'identifiant Drive du fichier. */
export async function deposerPdf(buffer: Buffer, nom: string): Promise<string> {
  const res = await clientDrive().files.create({
    requestBody: {
      name: nom.replace(/[\\/]/g, '-').slice(0, 150),
      parents: [process.env.DRIVE_COURS_FOLDER_ID!],
      mimeType: 'application/pdf',
    },
    media: { mimeType: 'application/pdf', body: Readable.from(buffer) },
    fields: 'id',
    supportsAllDrives: true,
  });
  if (!res.data.id) throw new Error('Drive n’a pas rendu d’identifiant.');
  return res.data.id;
}

/** Relit un PDF déposé. */
export async function lirePdf(fileId: string): Promise<Buffer> {
  const res = await clientDrive().files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' }
  );
  return Buffer.from(res.data as ArrayBuffer);
}
