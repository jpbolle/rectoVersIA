// Point d'entrée de l'import : d'une demande (lien, PDF ou texte collé) au
// texte borné + la description de la source. SERVEUR UNIQUEMENT.

import { cibleGoogle, texteGoogle } from './google';
import { textePageWeb } from './web';
import { textePdf } from './pdf';
import { TEXTE_MAX } from '@/types/lecture-cours';
import type { SourceLecture, UsageClaude } from '@/types/lecture-cours';

export type DemandeImport =
  | { mode: 'lien'; url: string; titre?: string }
  | { mode: 'texte'; texte: string; titre?: string }
  | { mode: 'pdf'; buffer: Buffer; nomFichier: string; titre?: string };

export interface ResultatImport {
  titre: string;
  texte: string;
  source: SourceLecture;
  usage?: UsageClaude;
}

function borner(texte: string): string {
  const t = texte.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (t.length < 200) throw new Error('Texte trop court pour une lecture de cours (200 caractères au moins).');
  if (t.length > TEXTE_MAX) {
    throw new Error(
      `Texte trop long (${Math.round(t.length / 1000)} 000 caractères) : l’équivalent de 5 pages au plus. Choisis la partie du cours que tu veux lire.`
    );
  }
  return t;
}

function titreParDefaut(): string {
  return `Cours du ${new Date().toLocaleDateString('fr-BE', { day: 'numeric', month: 'long' })}`;
}

export async function importerCours(demande: DemandeImport): Promise<ResultatImport> {
  const titreDonne = demande.titre?.trim().slice(0, 120) || '';

  if (demande.mode === 'texte') {
    return {
      titre: titreDonne || titreParDefaut(),
      texte: borner(demande.texte),
      source: { type: 'texte' },
    };
  }

  if (demande.mode === 'pdf') {
    const { texte, pages, usage } = await textePdf(demande.buffer, demande.nomFichier);
    return {
      titre: titreDonne || demande.nomFichier.replace(/\.pdf$/i, '').slice(0, 120) || titreParDefaut(),
      texte: borner(texte),
      source: { type: 'pdf', nomFichier: demande.nomFichier, pages },
      usage,
    };
  }

  const google = cibleGoogle(demande.url);
  if (google) {
    const texte = await texteGoogle(google);
    return {
      titre: titreDonne || titreParDefaut(),
      texte: borner(texte),
      source: { type: google.type, url: demande.url.trim() },
    };
  }

  const page = await textePageWeb(demande.url);
  return {
    titre: titreDonne || page.titre.slice(0, 120) || titreParDefaut(),
    texte: borner(page.texte),
    source: { type: 'web', url: page.url },
  };
}
