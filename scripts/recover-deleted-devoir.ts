/**
 * Récupération d'une activité supprimée par erreur — LECTURE SEULE.
 *
 * Firestore conserve une heure d'historique de versions même sans PITR
 * (`versionRetentionPeriod: 3600s`). Une transaction en lecture seule datée
 * permet donc de relire la base telle qu'elle était avant la suppression.
 * Passé ce délai, la donnée est définitivement perdue.
 *
 * Usage :
 *   npx tsx scripts/recover-deleted-devoir.ts "<fragment de l'intitulé>" [minutes]
 *
 *   minutes = combien de minutes en arrière regarder (défaut 55, maximum 59).
 *
 * Le script n'écrit RIEN en base : il dépose le document retrouvé dans
 * backups/ (ignoré par git). La réécriture est un geste séparé, décidé après
 * lecture du fichier.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
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
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) process.env[key] = value;
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
    credential: cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    }),
  });

  return getFirestore(app);
}

// Comparaison insensible aux accents et à la casse : l'intitulé tapé en
// argument ne coïncidera pas au caractère près avec celui saisi dans l'app.
function normaliser(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

async function main() {
  const fragment = process.argv[2];
  if (!fragment) {
    throw new Error(
      'Indiquer un fragment de l\'intitulé : npx tsx scripts/recover-deleted-devoir.ts "Diagnostic"'
    );
  }

  const minutes = Math.min(Number(process.argv[3]) || 55, 59);
  const readTime = Timestamp.fromMillis(Date.now() - minutes * 60 * 1000);

  const db = initFirebase();

  console.log(`Lecture de la base telle qu'elle était il y a ${minutes} minutes`);
  console.log(`(${readTime.toDate().toISOString()})\n`);

  // Transaction en lecture seule datée : la seule façon de voir un document
  // qui n'existe plus. Elle n'acquiert aucun verrou et n'écrit rien.
  const trouves = await db.runTransaction(
    async (tx) => {
      const snap = await tx.get(db.collection('devoirs'));
      return snap.docs
        .filter((d) => normaliser(String(d.data().intitule ?? '')).includes(normaliser(fragment)))
        .map((d) => ({ id: d.id, data: d.data() }));
    },
    { readOnly: true, readTime }
  );

  if (trouves.length === 0) {
    console.log('Aucune activité ne correspond à cet intitulé à cette date.');
    console.log('Essayer un fragment plus court, ou remonter plus loin (2e argument).');
    return;
  }

  const dossier = resolve('backups');
  if (!existsSync(dossier)) mkdirSync(dossier, { recursive: true });

  for (const { id, data } of trouves) {
    const chemin = resolve(dossier, `devoir-${id}.json`);
    writeFileSync(chemin, JSON.stringify({ id, data }, null, 2), 'utf-8');

    // Le document existe-t-il encore aujourd'hui ? C'est ce qui distingue
    // l'activité supprimée d'un simple homonyme toujours en place.
    const actuel = await db.collection('devoirs').doc(id).get();

    console.log(`— « ${data.intitule} »`);
    console.log(`  id            : ${id}`);
    console.log(`  type          : ${data.typeTravail ?? '(absent)'}`);
    console.log(`  questionnaire : ${data.lectureQuiz ? 'questionnaire de lecture présent' : data.questionnaireId ? `renvoi vers questionnaires/${data.questionnaireId}` : data.autoEvalQuiz ? 'auto-évaluation présente' : 'aucun'}`);
    console.log(`  état actuel   : ${actuel.exists ? 'TOUJOURS EN BASE' : 'SUPPRIMÉE — récupérable depuis ce fichier'}`);
    console.log(`  sauvegardé    : ${chemin}\n`);
  }
}

main().catch((err) => {
  console.error('Échec :', err instanceof Error ? err.message : err);
  process.exit(1);
});
