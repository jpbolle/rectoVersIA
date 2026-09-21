/**
 * Reprise : écrire `corrections.scoreLecture` sur les corrections DÉJÀ faites.
 *
 * Le total d'un questionnaire de lecture n'a jamais été stocké (il se
 * recalculait à chaque affichage) ; `corrections.score` reste à 0 pour ces
 * activités. Depuis le 2026-09-21, chaque enregistrement de correction l'écrit
 * (`src/lib/lecture-score-persistance.ts`) — restent toutes celles corrigées
 * avant. Sans cette reprise, KitSchool importerait 0 % pour chacune.
 *
 * Usage :
 *   npx tsx scripts/backfill-score-lecture.ts            → simulation
 *   npx tsx scripts/backfill-score-lecture.ts --apply    → écrit
 *   … --devoir DEV-20260831-6808                         → une seule activité
 *
 * Idempotent et sans perte : il ne touche que `scoreLecture`, jamais `score`,
 * `questionScores` ni le statut de la correction. Relançable autant de fois
 * qu'on veut — c'est d'ailleurs la façon de rafraîchir un total après une
 * retouche du corrigé d'un QCM.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { calculerScoreLecture } from '../src/lib/lecture-score-persistance';

function loadEnvFile(filePath: string) {
  const content = readFileSync(resolve(filePath), 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!process.env[key]) process.env[key] = trimmed.slice(eq + 1).trim();
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
  return getFirestore(
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, '\n') }),
    })
  );
}

const APPLY = process.argv.includes('--apply');
const i = process.argv.indexOf('--devoir');
const DEVOIR = i !== -1 ? process.argv[i + 1] : null;

async function main() {
  const db = initFirebase();

  // Les activités de lecture, pour ne pas lire un devoir par correction.
  const devoirsSnap = await db.collection('devoirs').get();
  const deLecture = new Set(
    devoirsSnap.docs
      .filter((d) => ((d.data().lectureQuiz?.questions as unknown[] | undefined) ?? []).length > 0)
      .map((d) => d.id)
  );
  console.log(`Activités de lecture : ${deLecture.size} sur ${devoirsSnap.size} devoirs.`);

  const correctionsSnap = DEVOIR
    ? await db.collection('corrections').where('devoirId', '==', DEVOIR).get()
    : await db.collection('corrections').get();

  let traitees = 0;
  let sansTotal = 0;
  const parActivite = new Map<string, { n: number; percents: number[] }>();

  for (const doc of correctionsSnap.docs) {
    const c = doc.data();
    if (!deLecture.has(c.devoirId)) continue;
    const score = await calculerScoreLecture(db, {
      devoirId: c.devoirId,
      travailId: c.travailId,
      questionScores: c.questionScores,
    });
    if (!score) continue;
    if (score.percent === null) sansTotal++;
    traitees++;
    const cur = parActivite.get(c.devoirId) ?? { n: 0, percents: [] };
    cur.n++;
    if (score.percent !== null) cur.percents.push(score.percent);
    parActivite.set(c.devoirId, cur);

    if (APPLY) await doc.ref.update({ scoreLecture: score });
  }

  console.log(`\nCorrections de lecture : ${traitees}${APPLY ? ' — écrites' : ' (simulation)'}`);
  console.log(`  dont sans total calculable (rien de noté) : ${sansTotal}`);
  for (const [devoirId, v] of parActivite) {
    const moy = v.percents.length
      ? Math.round(v.percents.reduce((s, p) => s + p, 0) / v.percents.length)
      : null;
    const intitule = devoirsSnap.docs.find((d) => d.id === devoirId)?.data().intitule ?? devoirId;
    console.log(`  · ${intitule} — ${v.n} copies, moyenne ${moy === null ? '—' : `${moy} %`}`);
  }
  if (!APPLY) console.log('\nRien n’a été écrit. Relancer avec --apply.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
