/**
 * Migration des mots DASPALECTE vers leur propre liste (2026-10-08, soir).
 *
 * Jusqu'ici, les mots cliqués dans l'extension Daspalecte rejoignaient la liste
 * personnelle de l'élève (`vocabulairePersonnel/{uid}`, celle de NavigKid et
 * du dictionnaire de l'app), marqués `source: 'daspalecte'`. Désormais ils
 * vivent dans `vocabulaireFle/{uid}` — l'espace FLE de l'élève (« Mes
 * ressources personnelles › Mon vocabulaire »). Voir `src/lib/daspalecte/mots.ts`.
 *
 * Ce que le script fait, pour chaque document `vocabulairePersonnel` :
 *   1. prend les mots `source === 'daspalecte'` ;
 *   2. les FUSIONNE dans `vocabulaireFle/{uid}` (même uid, même `studentEmail`
 *      chiffré, un mot déjà présent n'est pas dupliqué) ;
 *   3. les retire de `vocabulairePersonnel/{uid}`.
 *
 * Idempotent : relancé, il ne trouve plus rien à déplacer. Rien n'est perdu :
 * un mot change de document, il ne disparaît pas.
 *
 * Usage :
 *   npx tsx scripts/migrate-vocabulaire-fle.ts           → simulation (dry run)
 *   npx tsx scripts/migrate-vocabulaire-fle.ts --apply   → applique
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  for (const ligne of readFileSync(filePath, 'utf-8').split('\n')) {
    const m = ligne.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!m) continue;
    const cle = m[1];
    let val = (m[2] || '').trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[cle]) process.env[cle] = val;
  }
}
loadEnvFile(resolve(process.cwd(), '.env.local'));

const APPLY = process.argv.includes('--apply');

function db(): Firestore {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_ADMIN_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      }),
    });
  }
  return getFirestore();
}

interface Mot {
  word: string;
  source?: string;
  clics?: number;
  traduction?: string;
  langue?: string;
  lastSeenAt?: string;
  [k: string]: unknown;
}

// Même règle que `fusionnerMots` (src/lib/daspalecte/mots.ts), recopiée pour
// que le script reste autonome
function fusionner(existants: Mot[], recus: Mot[]): Mot[] {
  const liste = existants.map((m) => ({ ...m }));
  const index = new Map(liste.map((m, i) => [(m.word || '').toLowerCase(), i]));
  for (const recu of recus) {
    const cle = (recu.word || '').toLowerCase();
    const i = index.get(cle);
    if (i === undefined) {
      index.set(cle, liste.length);
      liste.push({ ...recu });
      continue;
    }
    const m = liste[i];
    m.clics = (m.clics || 0) + (recu.clics || 0);
    if (!m.traduction && recu.traduction) m.traduction = recu.traduction;
    if (!m.langue && recu.langue) m.langue = recu.langue;
    if (recu.lastSeenAt && (!m.lastSeenAt || recu.lastSeenAt > m.lastSeenAt)) m.lastSeenAt = recu.lastSeenAt;
  }
  return liste;
}

async function main() {
  const firestore = db();
  const snap = await firestore.collection('vocabulairePersonnel').get();
  let docs = 0;
  let mots = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const words: Mot[] = Array.isArray(data.words) ? data.words : [];
    const daspalecte = words.filter((w) => w.source === 'daspalecte');
    if (daspalecte.length === 0) continue;
    const restants = words.filter((w) => w.source !== 'daspalecte');
    docs++;
    mots += daspalecte.length;
    console.log(`${doc.id} : ${daspalecte.length} mot(s) Daspalecte → vocabulaireFle, ${restants.length} restent`);

    if (!APPLY) continue;
    const fleRef = firestore.collection('vocabulaireFle').doc(doc.id);
    await firestore.runTransaction(async (tx) => {
      const fle = await tx.get(fleRef);
      const fusion = fusionner(fle.exists ? (fle.data()?.words as Mot[]) || [] : [], daspalecte);
      tx.set(
        fleRef,
        { studentEmail: data.studentEmail ?? null, words: fusion, updatedAt: new Date().toISOString() },
        { merge: true }
      );
      tx.update(doc.ref, { words: restants, updatedAt: new Date().toISOString() });
    });
  }

  console.log(`\n${APPLY ? 'Appliqué' : 'Simulation'} : ${mots} mot(s) dans ${docs} liste(s).`);
  if (!APPLY && docs > 0) console.log('Relance avec --apply pour déplacer.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
