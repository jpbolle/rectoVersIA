import { google } from 'googleapis';

let sheetsClient: ReturnType<typeof google.sheets> | null = null;

function getSheetsClient() {
  if (sheetsClient) return sheetsClient;

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

const EXCLUDED_SHEETS = ['dataEleves', 'Evaluations', 'Résultats'];

export async function getGrilleTypes(): Promise<string[]> {
  const sheets = getSheetsClient();
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
  });

  const sheetNames = spreadsheet.data.sheets?.map(s => s.properties?.title || '') || [];
  return sheetNames.filter(name => name && !EXCLUDED_SHEETS.includes(name));
}

export interface GrilleLevel {
  level: number;
  description: string;
}

export interface GrilleCriterion {
  id: string;
  name: string;
  weight: number;
  levels: GrilleLevel[];
}

export interface GrilleData {
  name: string;
  criteria: GrilleCriterion[];
}

/**
 * Recupere le contenu d'une grille specifique depuis Google Sheets
 * Structure attendue de la feuille:
 * - Ligne 1: En-tetes (Critere, Poids, Niveau 0, Niveau 1, Niveau 2, Niveau 3, ...)
 * - Lignes suivantes: Donnees des criteres
 */
export async function getGrilleContent(grilleName: string): Promise<GrilleData | null> {
  const sheets = getSheetsClient();

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: `'${grilleName}'!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length < 2) {
      return null;
    }

    const headers = rows[0];
    const criteria: GrilleCriterion[] = [];

    // Trouver les indices des colonnes de niveaux
    const levelColumns: number[] = [];
    for (let i = 2; i < headers.length; i++) {
      const header = headers[i]?.toString().toLowerCase() || '';
      if (header.includes('niveau') || header.match(/^n\s*\d+$/i) || header.match(/^\d+$/)) {
        levelColumns.push(i);
      }
    }

    // Si aucune colonne de niveau trouvee, utiliser toutes les colonnes apres Poids
    if (levelColumns.length === 0) {
      for (let i = 2; i < headers.length; i++) {
        if (headers[i]) {
          levelColumns.push(i);
        }
      }
    }

    // Parser chaque ligne de critere
    for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      if (!row || !row[0]) continue;

      const criterionName = row[0]?.toString().trim() || '';
      const weight = parseFloat(row[1]?.toString() || '1') || 1;

      const levels: GrilleLevel[] = [];
      levelColumns.forEach((colIndex, levelIndex) => {
        const description = row[colIndex]?.toString().trim() || '';
        if (description) {
          levels.push({
            level: levelIndex,
            description,
          });
        }
      });

      if (criterionName && levels.length > 0) {
        criteria.push({
          id: `criterion-${rowIndex}`,
          name: criterionName,
          weight,
          levels,
        });
      }
    }

    return {
      name: grilleName,
      criteria,
    };
  } catch (error) {
    console.error(`Erreur lors de la recuperation de la grille ${grilleName}:`, error);
    return null;
  }
}
