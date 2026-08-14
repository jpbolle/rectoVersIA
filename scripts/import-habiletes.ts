/**
 * Import des habiletés depuis la feuille « Ceintures et habiletés » du tableau
 * Google de JP vers la configuration didactique (configuration/didactique).
 *
 * Colonnes attendues : ID habileté | UAA | type modal | geste | habileté
 * La colonne « objet » n'existe pas dans le tableau : elle est laissée vide et
 * se remplit dans /admin → Gestion didactique.
 *
 * Usage :
 *   npx tsx scripts/import-habiletes.ts                  → simulation (dry run)
 *   npx tsx scripts/import-habiletes.ts --apply          → écrit dans Firestore
 *   npx tsx scripts/import-habiletes.ts --file x.csv     → autre CSV local
 *   npx tsx scripts/import-habiletes.ts --url            → retélécharge le Sheets
 *
 * Source par défaut : l'instantané scripts/data/ceintures-et-habiletes.csv,
 * figé le 2026-08-13. Le tableau Google n'est plus consulté — l'import ne
 * dépend donc pas de la survie d'un document externe.
 *
 * IMPORT UNIQUE — le tableau Google était une base de travail, il n'est PAS
 * tenu à jour. Après cet import, la source de vérité est l'application.
 * Conséquence sur le comportement du script : une habileté déjà présente
 * (même id) est laissée STRICTEMENT intacte — ni geste, ni libellé, ni type,
 * ni objet, ni UAA ne sont réécrits. Seules les lignes absentes sont ajoutées.
 * Le rejouer ne peut donc jamais écraser un travail fait dans l'app.
 *
 * Nécessite FIREBASE_ADMIN_* dans .env.local.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { ATELIER_PAR_MODE, DEFAULT_DIDACTIQUE, TYPES_MODAUX } from '../src/types/didactique';
import type { DidactiqueConfig, Habilete, TypeModal } from '../src/types/didactique';

const SHEET_ID = '1AKncx7n_1yB9zHpfF1snUDWZC4ANMk0C4U96eSd1tOY';
const SHEET_GID = '247584763'; // feuille « Ceintures et habiletés »
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;
const SNAPSHOT = 'scripts/data/ceintures-et-habiletes.csv';

// « Rechercher » n'est pas une modalité : le tableau classe d'ailleurs les
// gestes de recherche en Lire ou Écrire. La recherche est un atelier.
const TYPE_FROM_SHEET: Record<string, TypeModal> = {
  lire: 'lire',
  ecrire: 'ecrire',
  écrire: 'ecrire',
  parler: 'parler',
  meta: 'reflexif',
  méta: 'reflexif',
  lexique: 'lexique',
};

// Charger .env.local manuellement
function loadEnvFile(filePath: string) {
  const content = readFileSync(resolve(filePath), 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function initFirebase(): Firestore {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Variables Firebase Admin manquantes dans .env.local');
  }
  const app = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, '\n') }),
  });
  return getFirestore(app);
}

// Parseur CSV minimal (guillemets, virgules et sauts de ligne échappés)
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim()));
}

const norm = (s: string) =>
  s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

async function readSource(): Promise<string> {
  if (process.argv.includes('--url')) {
    console.log('🌐 Source : feuille « Ceintures et habiletés » (export CSV)');
    const res = await fetch(SHEET_URL);
    if (!res.ok) {
      throw new Error(
        `Téléchargement impossible (${res.status}). Le partage du tableau doit autoriser ` +
          'la lecture par lien, ou passer un export local avec --file.'
      );
    }
    return res.text();
  }
  const fileIndex = process.argv.indexOf('--file');
  const path = fileIndex !== -1 ? process.argv[fileIndex + 1] : SNAPSHOT;
  if (!path) throw new Error('--file attend un chemin de fichier');
  console.log(`📄 Source : ${path}`);
  return readFileSync(resolve(path), 'utf-8');
}

// Une ligne du tableau → une habileté (objet vide, une seule UAA)
function rowToHabilete(cols: Record<string, string>, index: number): Habilete | null {
  const geste = (cols['geste'] ?? '').trim();
  const label = (cols['habilete'] ?? '').trim();
  if (!geste && !label) return null;

  const type = TYPE_FROM_SHEET[norm(cols['type modal'] ?? '')];
  if (!type) {
    console.warn(`  ⚠️  ligne ${index + 2} : type modal inconnu « ${cols['type modal']} » — ignorée`);
    return null;
  }

  const uaaRaw = (cols['uaa'] ?? '').trim().replace(/^uaa/i, '');
  const uaa = DEFAULT_DIDACTIQUE.uaa.some((u) => u.id === uaaRaw) ? [uaaRaw] : [];
  if (uaaRaw && !uaa.length) {
    console.warn(`  ⚠️  ligne ${index + 2} : UAA inconnue « ${cols['uaa']} » — laissée vide`);
  }

  const id = (cols['id habilete'] ?? '').trim() || `H-${index}`;
  // L'atelier qui va de soi pour ce type modal est pré-coché : un geste de
  // lecture se travaille en atelier de lecture. JP décoche au besoin.
  const auto = ATELIER_PAR_MODE[type];
  return { id, type, geste, label, objets: [], uaa, ateliers: auto ? [auto] : [], visible: true };
}

async function main() {
  loadEnvFile('.env.local');
  const APPLY = process.argv.includes('--apply');

  const rows = parseCsv(await readSource());
  if (rows.length < 2) throw new Error('Tableau vide ou illisible');

  const headers = rows[0].map(norm);
  const imported: Habilete[] = [];
  const seen = new Set<string>();
  rows.slice(1).forEach((cells, i) => {
    const cols: Record<string, string> = {};
    headers.forEach((h, j) => (cols[h] = cells[j] ?? ''));
    const h = rowToHabilete(cols, i);
    if (!h) return;
    if (seen.has(h.id)) {
      console.warn(`  ⚠️  ligne ${i + 2} : id « ${h.id} » en double — ignorée`);
      return;
    }
    seen.add(h.id);
    imported.push(h);
  });

  const db = initFirebase();
  const ref = db.collection('configuration').doc('didactique');
  const snap = await ref.get();
  const stored = (snap.exists ? snap.data() : {}) as Partial<DidactiqueConfig>;
  const existing: Habilete[] = Array.isArray(stored.habiletes) ? stored.habiletes : [];
  const byId = new Map(existing.map((h) => [h.id, h]));

  // L'app fait autorité : on n'ajoute que ce qui manque, jamais de réécriture
  const nouvelles = imported.filter((h) => !byId.has(h.id));
  const deja = imported.length - nouvelles.length;
  const habiletes = [...existing, ...nouvelles];

  console.log('');
  console.log(`📊 ${imported.length} habiletés lues dans le tableau`);
  console.log(`   ${nouvelles.length} ajoutées · ${deja} déjà présentes, laissées intactes`);
  if (existing.length) console.log(`   ${existing.length} habiletés déjà en base, conservées`);
  for (const t of TYPES_MODAUX) {
    const n = habiletes.filter((h) => h.type === t.id).length;
    const avecObjet = habiletes.filter((h) => h.type === t.id && h.objets?.length).length;
    console.log(`   ${t.title.padEnd(22)} ${String(n).padStart(3)}  (${avecObjet} avec objet)`);
  }
  console.log('');

  if (!APPLY) {
    console.log('🔍 Simulation — rien n’a été écrit. Relancer avec --apply pour appliquer.');
    return;
  }

  const uaa = Array.isArray(stored.uaa) && stored.uaa.length ? stored.uaa : DEFAULT_DIDACTIQUE.uaa;
  // Les méthodes existantes ne sont jamais touchées par cet import
  const methodes = Array.isArray(stored.methodes) && stored.methodes.length
    ? stored.methodes
    : DEFAULT_DIDACTIQUE.methodes;
  await ref.set({ uaa, habiletes, methodes } satisfies DidactiqueConfig);
  console.log(`✅ configuration/didactique mis à jour — ${habiletes.length} habiletés.`);
}

main().catch((err) => {
  console.error('❌', err instanceof Error ? err.message : err);
  process.exit(1);
});
