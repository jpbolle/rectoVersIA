// Import d'un PDF — SERVEUR UNIQUEMENT, SANS DÉPENDANCE.
//
// L'API Claude lit les PDF nativement (bloc `document`) : on lui demande une
// transcription fidèle, qui vaut aussi pour un PDF scanné (images). Le PDF
// lui-même n'est PAS conservé — seul le texte l'est — ce qui épargne un
// stockage de fichiers que le projet n'a pas (tout est dans Firestore).
//
// La limite des 5 pages (demande JP) force l'élève à CHOISIR une partie du
// cours plutôt que d'y verser le cours entier. Deux comptages : un comptage
// dans le flux PDF, AVANT tout appel (flux d'objets compressés compris depuis
// le 2026-10-12) — il fait foi ; celui de Claude ne sert que s'il a échoué.

import { inflateSync } from 'zlib';
import { MODELE_RAPIDE, appelerClaude } from '@/lib/claude';
import { PDF_OCTETS_MAX, PDF_PAGES_MAX } from '@/types/lecture-cours';
import type { UsageClaude } from '@/types/lecture-cours';

/** Pages lues dans un morceau de PDF (flux en clair ou décompressé). */
function pagesDans(brut: string): { feuilles: number; racine: number } {
  const feuilles = brut.match(/\/Type\s*\/Page(?![s\w])/g)?.length ?? 0;
  // Le nœud racine de l'arbre des pages porte le total : /Type /Pages … /Count N
  let racine = 0;
  for (const m of brut.matchAll(/<<(?:(?!<<|>>)[\s\S])*\/Type\s*\/Pages\b(?:(?!<<|>>)[\s\S])*>>/g)) {
    const n = m[0].match(/\/Count\s+(\d+)/);
    if (n) racine = Math.max(racine, Number(n[1]));
  }
  return { feuilles, racine };
}

/**
 * Compte des pages lu dans le flux ; 0 = indéterminé.
 * Les PDF récents (Word, Google Docs…) rangent souvent leurs objets dans des
 * « flux d'objets » compressés, invisibles à une lecture en clair : on les
 * décompresse (zlib, inclus dans Node) pour y chercher les pages aussi.
 * Le total déclaré (/Count) prime sur le nombre d'objets « page » : un PDF
 * modifié après coup garde ses anciennes pages dans le fichier (testé sur
 * 25 PDF le 2026-10-12 : compte exact partout).
 */
export function compterPagesPdf(buffer: Buffer): number {
  const brut = buffer.toString('latin1');
  const morceaux = [pagesDans(brut)];
  for (const m of brut.matchAll(/\/ObjStm[\s\S]{0,400}?stream\r?\n/g)) {
    const debut = (m.index ?? 0) + m[0].length;
    const fin = brut.indexOf('endstream', debut);
    if (fin < 0) continue;
    try {
      morceaux.push(pagesDans(inflateSync(buffer.subarray(debut, fin)).toString('latin1')));
    } catch {
      // Flux non compressé en Flate ou abîmé : on garde le compte en clair
    }
  }
  const racine = Math.max(...morceaux.map((x) => x.racine));
  return racine > 0 ? racine : morceaux.reduce((t, x) => t + x.feuilles, 0);
}

/** Sépare la ligne « PAGES: n » du texte ; 0 page si la ligne manque. */
function lireTranscription(brut: string): { pages: number; texte: string } {
  let t = brut.trim();
  // Une clôture ``` éventuelle autour de la réponse
  if (t.startsWith('```')) t = t.split('\n').slice(1).join('\n').replace(/```\s*$/, '').trim();
  const m = t.match(/^PAGES\s*:\s*(\d+)\s*(?:\n|$)/i);
  if (!m) return { pages: 0, texte: t };
  return { pages: Number(m[1]), texte: t.slice(m[0].length).trim() };
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

  // Texte brut, PAS de JSON : un cours entier glissé dans une chaîne JSON
  // (guillemets, retours à la ligne) cassait le décodage — « Réponse du
  // modèle illisible » à l'import d'un PDF de géographie, 2026-10-12.
  const { texte: brut, usage } = await appelerClaude({
    system:
      'Tu transcris des documents scolaires pour une application pédagogique. Tu réponds sans commentaire.',
    user: [
      {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') },
      },
      {
        type: 'text',
        text: `Transcris FIDÈLEMENT tout le texte de ce document (titres, paragraphes, listes, texte des tableaux et des schémas), dans l'ordre de lecture, sans rien résumer ni ajouter. Ignore les en-têtes et pieds de page répétés et les numéros de page.
Première ligne de ta réponse : PAGES: <nombre de pages du document>. À partir de la deuxième ligne : le texte transcrit, avec ses retours à la ligne. Rien d'autre.`,
      },
    ],
    maxTokens: 16000,
    // Recopie fidèle = de l'extraction : Haiku suffit (décision JP, 2026-10-12)
    modele: MODELE_RAPIDE,
  });

  const { pages: pagesLues, texte } = lireTranscription(brut);
  const pages = estime > 0 ? estime : pagesLues;
  if (pages > PDF_PAGES_MAX) {
    throw new Error(
      `${pages} pages : ${PDF_PAGES_MAX} pages maximum. Choisis la partie du cours que tu veux lire.`
    );
  }
  if (!texte) throw new Error(`Aucun texte lisible dans ${nomFichier}.`);
  return { texte, pages, usage };
}
