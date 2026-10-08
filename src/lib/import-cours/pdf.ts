// Import d'un PDF — SERVEUR UNIQUEMENT, SANS DÉPENDANCE.
//
// L'API Claude lit les PDF nativement (bloc `document`) : on lui demande une
// transcription fidèle, qui vaut aussi pour un PDF scanné (images). Le PDF
// lui-même n'est PAS conservé — seul le texte l'est — ce qui épargne un
// stockage de fichiers que le projet n'a pas (tout est dans Firestore).
//
// La limite des 5 pages (demande JP) force l'élève à CHOISIR une partie du
// cours plutôt que d'y verser le cours entier. Deux comptages : un comptage
// rapide dans le flux PDF (`/Type /Page`, fiable sur les PDF courants, aveugle
// sur les flux d'objets compressés), puis celui de Claude, qui fait foi.

import { appelerClaudeJson } from '@/lib/claude';
import { PDF_OCTETS_MAX, PDF_PAGES_MAX } from '@/types/lecture-cours';
import type { UsageClaude } from '@/types/lecture-cours';

/** Compte approximatif des pages lu dans le flux ; 0 = indéterminé. */
export function compterPagesPdf(buffer: Buffer): number {
  const brut = buffer.toString('latin1');
  const pages = brut.match(/\/Type\s*\/Page(?![s\w])/g)?.length ?? 0;
  return pages;
}

export async function textePdf(
  buffer: Buffer,
  nomFichier: string
): Promise<{ texte: string; pages: number; usage: UsageClaude }> {
  if (buffer.length > PDF_OCTETS_MAX) {
    throw new Error(`Fichier trop lourd (${Math.round(buffer.length / 1024 / 1024)} Mo) : 4 Mo maximum.`);
  }
  if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
    throw new Error('Ce fichier n’est pas un PDF.');
  }
  const estime = compterPagesPdf(buffer);
  if (estime > PDF_PAGES_MAX) {
    throw new Error(
      `${estime} pages : ${PDF_PAGES_MAX} pages maximum. Choisis la partie du cours que tu veux lire.`
    );
  }

  const { data, usage } = await appelerClaudeJson<{ pages: number; texte: string }>({
    system:
      'Tu transcris des documents scolaires pour une application pédagogique. Tu réponds en JSON brut, sans commentaire.',
    user: [
      {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') },
      },
      {
        type: 'text',
        text: `Transcris FIDÈLEMENT tout le texte de ce document (titres, paragraphes, listes, texte des tableaux et des schémas), dans l'ordre de lecture, sans rien résumer ni ajouter. Ignore les en-têtes et pieds de page répétés et les numéros de page.
Réponds en JSON brut : {"pages": <nombre de pages du document>, "texte": "<le texte, avec des retours à la ligne>"}. Commence par { et termine par }.`,
      },
    ],
    maxTokens: 16000,
  });

  const pages = typeof data.pages === 'number' && data.pages > 0 ? data.pages : estime;
  if (pages > PDF_PAGES_MAX) {
    throw new Error(
      `${pages} pages : ${PDF_PAGES_MAX} pages maximum. Choisis la partie du cours que tu veux lire.`
    );
  }
  const texte = typeof data.texte === 'string' ? data.texte.trim() : '';
  if (!texte) throw new Error(`Aucun texte lisible dans ${nomFichier}.`);
  return { texte, pages, usage };
}
