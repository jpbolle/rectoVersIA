/**
 * Pré-cochage de l'atelier qui va de soi sur les habiletés existantes :
 * un geste de lecture se travaille en atelier de lecture, un geste d'écriture
 * en atelier d'écriture, un geste lexical en atelier de vocabulaire.
 *
 * Parole et réflexif n'ont pas d'atelier propre : ils sont laissés vides et se
 * rattachent à la main dans /admin → Gestion didactique.
 *
 * NON DESTRUCTIF : une habileté qui porte déjà au moins un atelier n'est pas
 * touchée. Le script n'ajoute jamais un deuxième atelier et n'en retire aucun —
 * les décochages faits dans l'app sont donc préservés.
 *
 * Usage :
 *   npx tsx scripts/prefill-ateliers.ts            → simulation (dry run)
 *   npx tsx scripts/prefill-ateliers.ts --apply    → écrit dans Firestore
 *
 * Nécessite FIREBASE_ADMIN_* dans .env.local.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { ATELIER_PAR_MODE, atelierLabel, TYPES_MODAUX } from '../src/types/didactique';
import type { DidactiqueConfig, Habilete } from '../src/types/didactique';

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

async function main() {
  loadEnvFile('.env.local');
  const APPLY = process.argv.includes('--apply');

  const db = initFirebase();
  const ref = db.collection('configuration').doc('didactique');
  const snap = await ref.get();
  if (!snap.exists) throw new Error('configuration/didactique introuvable — lancer d’abord l’import');

  const stored = snap.data() as Partial<DidactiqueConfig>;
  const existing: Habilete[] = Array.isArray(stored.habiletes) ? stored.habiletes : [];
  if (!existing.length) throw new Error('Aucune habileté en base');

  const parType = new Map<string, number>();
  let touchees = 0;

  const habiletes = existing.map((h) => {
    const deja = Array.isArray(h.ateliers) ? h.ateliers : [];
    if (deja.length) return { ...h, ateliers: deja };

    const auto = ATELIER_PAR_MODE[h.type];
    if (!auto) return { ...h, ateliers: [] };

    touchees++;
    parType.set(h.type, (parType.get(h.type) ?? 0) + 1);
    return { ...h, ateliers: [auto] };
  });

  console.log('');
  console.log(`📊 ${existing.length} habiletés en base`);
  console.log(`   ${touchees} à compléter · ${existing.length - touchees} déjà rattachées ou sans atelier évident`);
  for (const t of TYPES_MODAUX) {
    const n = parType.get(t.id) ?? 0;
    const auto = ATELIER_PAR_MODE[t.id];
    const cible = auto ? atelierLabel(auto) : '— aucun atelier correspondant';
    console.log(`   ${t.title.padEnd(22)} ${String(n).padStart(3)} → ${cible}`);
  }
  console.log('');

  if (!APPLY) {
    console.log('🔍 Simulation — rien n’a été écrit. Relancer avec --apply pour appliquer.');
    return;
  }

  await ref.set({ ...stored, habiletes } as DidactiqueConfig);
  console.log(`✅ configuration/didactique mis à jour — ${touchees} habiletés rattachées.`);
}

main().catch((err) => {
  console.error('❌', err instanceof Error ? err.message : err);
  process.exit(1);
});
