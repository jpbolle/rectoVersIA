/**
 * Réécriture en base d'une activité récupérée par recover-deleted-devoir.ts.
 *
 * Usage :
 *   npx tsx scripts/restore-devoir.ts backups/devoir-XXX.json           → simulation
 *   npx tsx scripts/restore-devoir.ts backups/devoir-XXX.json --apply   → écriture réelle
 *
 * L'identifiant d'origine est conservé : c'est lui qui rebranche les copies
 * d'élèves (collection `travaux`, champ `devoirId`), restées en base après la
 * suppression de l'activité.
 *
 * Refuse d'écrire si un document porte déjà cet identifiant — restaurer
 * par-dessus une activité vivante l'écraserait.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Firestore, Timestamp } from 'firebase-admin/firestore';

function loadEnvFile(filePath: string) {
  const content = readFileSync(resolve(filePath), 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    if (!process.env[key]) process.env[key] = trimmed.slice(eqIndex + 1).trim();
  }
}
loadEnvFile('.env.local');

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

// Le JSON a aplati les Timestamp en { _seconds, _nanoseconds } : les rendre à
// Firestore tels quels stockerait des objets ordinaires, et les tris par date
// cesseraient de fonctionner.
function revivifier(valeur: unknown): unknown {
  if (Array.isArray(valeur)) return valeur.map(revivifier);
  if (valeur && typeof valeur === 'object') {
    const o = valeur as Record<string, unknown>;
    if (typeof o._seconds === 'number' && typeof o._nanoseconds === 'number') {
      return new Timestamp(o._seconds, o._nanoseconds);
    }
    return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, revivifier(v)]));
  }
  return valeur;
}

const APPLY = process.argv.includes('--apply');

async function main() {
  const chemin = process.argv[2];
  if (!chemin) throw new Error('Indiquer le fichier de sauvegarde en argument');

  const { id, data } = JSON.parse(readFileSync(resolve(chemin), 'utf-8')) as {
    id: string;
    data: Record<string, unknown>;
  };

  const db = initFirebase();
  const docRef = db.collection('devoirs').doc(id);

  if ((await docRef.get()).exists) {
    throw new Error(
      `Un document ${id} existe déjà en base — restauration annulée pour ne pas l'écraser.`
    );
  }

  const restaure = revivifier(data) as Record<string, unknown>;
  const questions = ((restaure.lectureQuiz as { questions?: unknown[] })?.questions ?? []).length;
  const travaux = await db.collection('travaux').where('devoirId', '==', id).get();

  console.log(`Activité      : « ${restaure.intitule} »`);
  console.log(`id            : ${id}`);
  console.log(`questions     : ${questions}`);
  console.log(`copies liées  : ${travaux.size}`);
  console.log(`disponible    : ${restaure.disponible}`);

  if (!APPLY) {
    console.log('\nSIMULATION — rien n\'a été écrit. Relancer avec --apply pour restaurer.');
    return;
  }

  await docRef.set(restaure);
  console.log('\nRestaurée. Les copies d\'élèves sont rebranchées.');
}

main().catch((err) => {
  console.error('Échec :', err instanceof Error ? err.message : err);
  process.exit(1);
});
