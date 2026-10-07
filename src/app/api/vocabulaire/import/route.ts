import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/api-auth';
import { parseCSV } from '@/lib/csv';
import { toSheetExportUrl } from '@/lib/sheet-url';
import type { VocabulaireWord } from '@/types/vocabulaire';

// Plafond de sécurité : au-delà, ce n'est plus une liste de vocabulaire
const MAX_WORDS = 300;

// En-têtes reconnus (comparés sans accents ni majuscules) → champ du mot.
// Seule la colonne « Terme » est obligatoire ; les autres sont facultatives
// et peuvent être dans n'importe quel ordre.
const COLUMN_MATCHERS: { field: keyof VocabulaireWord; prefixes: string[] }[] = [
  { field: 'word', prefixes: ['terme', 'mot'] },
  { field: 'definition', prefixes: ['definition'] },
  { field: 'example', prefixes: ['exemple'] },
  { field: 'synonyms', prefixes: ['synonyme'] },
  { field: 'antonyms', prefixes: ['antonyme'] },
  { field: 'wordFamily', prefixes: ['proxemie', 'famille'] },
];

function normalizeHeader(label: string): string {
  return label.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// POST - Lire une liste de vocabulaire depuis un Google Sheets public.
// Ne modifie rien : renvoie les mots lus, le client les ajoute à la liste
// (la sauvegarde reste celle du bouton « Sauvegarder »).
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth || auth.role !== 'prof') {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  try {
    const { url } = (await request.json()) as { url?: string };
    const exportUrl = url ? toSheetExportUrl(url) : null;
    if (!exportUrl) {
      return NextResponse.json(
        { success: false, message: 'Lien invalide. Format attendu : https://docs.google.com/spreadsheets/d/…' },
        { status: 400 }
      );
    }

    const response = await fetch(exportUrl, { redirect: 'follow' });
    const text = await response.text();

    // Un Sheet privé renvoie souvent une page de connexion Google (HTML, statut 200) :
    // sans ce contrôle, l'erreur remonterait en « colonne manquante », trompeuse.
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || contentType.includes('text/html') || text.trimStart().startsWith('<')) {
      return NextResponse.json(
        {
          success: false,
          message: 'Google refuse l\'accès au Sheet. Vérifiez qu\'il est partagé en « Tous les utilisateurs disposant du lien » et que l\'URL vient de la barre d\'adresse.',
        },
        { status: 502 }
      );
    }

    const rows = parseCSV(text);
    const headers = (rows[0] || []).map(normalizeHeader);

    // Colonne → champ, d'après les en-têtes de la première ligne
    const columnFields = new Map<number, keyof VocabulaireWord>();
    for (const { field, prefixes } of COLUMN_MATCHERS) {
      const index = headers.findIndex(
        (h, i) => !columnFields.has(i) && prefixes.some((p) => h.startsWith(p))
      );
      if (index !== -1) columnFields.set(index, field);
    }

    if (![...columnFields.values()].includes('word')) {
      return NextResponse.json(
        {
          success: false,
          message: `Colonne « Terme » introuvable dans la première ligne du Sheet (en-têtes lus : ${(rows[0] || []).filter(Boolean).join(', ') || 'aucun'}).`,
        },
        { status: 400 }
      );
    }

    const words: VocabulaireWord[] = [];
    for (const row of rows.slice(1)) {
      const entry: VocabulaireWord = {
        word: '', definition: '', example: '', synonyms: '', antonyms: '', wordFamily: '',
      };
      columnFields.forEach((field, index) => {
        entry[field] = (row[index] || '').trim();
      });
      if (entry.word) words.push(entry);
      if (words.length >= MAX_WORDS) break;
    }

    if (words.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Le Sheet ne contient aucun mot sous l\'en-tête « Terme ».' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data: words });
  } catch (error) {
    console.error('Erreur POST /api/vocabulaire/import:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
