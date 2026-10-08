// Import d'un Google Docs / Slides / Sheets PARTAGÉ PAR LIEN — SERVEUR UNIQUEMENT.
//
// Même méthode que l'import de vocabulaire (`sheet-url.ts`, KitSchool) : le
// document doit être en « Tous les utilisateurs disposant du lien », et le
// serveur télécharge l'export texte sans identifiant Google. Pas d'OAuth
// Drive (option 2-A du plan du 2026-10-08) ; JP a confirmé que les élèves du
// Collège peuvent partager ainsi.

import { toSheetExportUrl } from '@/lib/sheet-url';
import type { SourceLectureType } from '@/types/lecture-cours';

export interface CibleGoogle {
  type: Extract<SourceLectureType, 'gdoc' | 'gslides' | 'gsheet'>;
  exportUrl: string;
}

/** Reconnaît un lien Google et rend l'URL d'export texte ; null sinon. */
export function cibleGoogle(rawUrl: string): CibleGoogle | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  if (parsed.hostname !== 'docs.google.com') return null;

  const doc = parsed.pathname.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
  if (doc) return { type: 'gdoc', exportUrl: `https://docs.google.com/document/d/${doc[1]}/export?format=txt` };

  const slides = parsed.pathname.match(/\/presentation\/d\/([a-zA-Z0-9-_]+)/);
  if (slides) {
    return { type: 'gslides', exportUrl: `https://docs.google.com/presentation/d/${slides[1]}/export/txt` };
  }

  const sheet = toSheetExportUrl(rawUrl);
  if (sheet) return { type: 'gsheet', exportUrl: sheet };

  return null;
}

/**
 * Télécharge l'export. Un document non partagé renvoie la page de connexion
 * Google (HTML, ou redirection vers accounts.google.com) : on le dit en clair.
 */
export async function texteGoogle(cible: CibleGoogle): Promise<string> {
  const res = await fetch(cible.exportUrl, { redirect: 'follow' });
  const contentType = res.headers.get('content-type') || '';
  if (!res.ok || res.url.includes('accounts.google.com') || contentType.includes('text/html')) {
    throw new Error(
      'Google refuse l’accès : le document doit être partagé en « Tous les utilisateurs disposant du lien ».'
    );
  }
  const texte = await res.text();
  if (cible.type === 'gsheet') {
    // CSV → une ligne par rangée, cellules séparées par un tiret
    return texte
      .split(/\r?\n/)
      .map((l) => l.replace(/"/g, '').split(',').filter(Boolean).join(' — '))
      .filter(Boolean)
      .join('\n');
  }
  return texte.replace(/\r\n/g, '\n');
}
