/**
 * Extraction des questionnaires de lecture (étape 4 du chantier
 * « sessions par classe » — voir harnais/plans/2026-09-01-sessions-par-classe.md).
 *
 * Le questionnaire d'une activité vivait DANS le document `devoirs`. Il devient
 * un document de la bibliothèque (`questionnairesLecture`), au même rang que
 * les grilles et les œuvres, et l'activité y RENVOIE (`lectureQuizId`).
 *
 * Ce que le script fait :
 *   1. pour chaque activité portant un `lectureQuiz` non vide et pas encore de
 *      `lectureQuizId`, crée un questionnaire nommé d'après l'activité ;
 *   2. pose `lectureQuizId` sur l'activité.
 *
 * ⚠ CE QU'IL NE FAIT PAS, ET C'EST VOULU : il **ne supprime pas** le
 * `lectureQuiz` embarqué. Deux raisons —
 *   - c'est le filet : si la référence casse, l'activité reste lisible ;
 *   - c'est, tel quel, la version FIGÉE de ce que les élèves ont déjà eu sous
 *     les yeux. L'effacer reviendrait à relire leurs réponses avec un
 *     questionnaire qu'ils n'ont jamais vu.
 *
 * Idempotent : une activité déjà pourvue d'un `lectureQuizId` est ignorée.
 *
 * Usage :
 *   npx tsx scripts/extract-questionnaires-lecture.ts            → simulation
 *   npx tsx scripts/extract-questionnaires-lecture.ts --apply    → écriture
 *   npx tsx scripts/extract-questionnaires-lecture.ts --rollback [--apply]
 *        → efface les questionnaires créés et retire `lectureQuizId`
 *
 * Nécessite FIREBASE_ADMIN_* dans .env.local.
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue, Firestore } from 'firebase-admin/firestore';

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  for (const ligne of readFileSync(filePath, 'utf-8').split('\n')) {
    const m = ligne.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!m) continue;
    let val = (m[2] || '').trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }
}
loadEnvFile(resolve(process.cwd(), '.env.local'));

const APPLY = process.argv.includes('--apply');
const ROLLBACK = process.argv.includes('--rollback');
const COLLECTION = 'questionnairesLecture';

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

function nouvelId(): string {
  const d = new Date();
  const jour = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
    d.getDate()
  ).padStart(2, '0')}`;
  return `QLE-${jour}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

async function rollback(firestore: Firestore) {
  const questionnaires = await firestore.collection(COLLECTION).get();
  const devoirs = (await firestore.collection('devoirs').get()).docs.filter(
    (d) => d.data().lectureQuizId
  );
  console.log(`   ${questionnaires.size} questionnaires à supprimer`);
  console.log(`   ${devoirs.length} activités à débarrasser de leur lectureQuizId`);
  if (!APPLY) {
    console.log('🔍 Simulation terminée — ajouter --apply pour écrire.');
    return;
  }
  const batch = firestore.batch();
  questionnaires.docs.forEach((d) => batch.delete(d.ref));
  devoirs.forEach((d) => batch.update(d.ref, { lectureQuizId: FieldValue.delete() }));
  await batch.commit();
  console.log('✅ Retour arrière terminé.');
}

async function main() {
  const firestore = db();
  if (ROLLBACK) {
    console.log(APPLY ? '⏪ RETOUR ARRIÈRE RÉEL' : '🔍 SIMULATION DU RETOUR ARRIÈRE');
    return rollback(firestore);
  }
  console.log(APPLY ? '⚙️  ÉCRITURE RÉELLE' : '🔍 SIMULATION (ajouter --apply pour écrire)');

  const devoirs = await firestore.collection('devoirs').get();
  const batch = firestore.batch();
  let extraits = 0;
  let dejaFaits = 0;
  let sansQuiz = 0;

  for (const doc of devoirs.docs) {
    const d = doc.data();
    if (d.lectureQuizId) {
      dejaFaits++;
      continue;
    }
    const quiz = d.lectureQuiz;
    const questions = quiz?.questions;
    if (!Array.isArray(questions) || questions.length === 0) {
      sansQuiz++;
      continue;
    }

    const id = nouvelId();
    const maintenant = new Date();
    const nb = questions.filter((q: { type?: string }) => q.type !== 'info').length;
    console.log(`   « ${d.intitule || doc.id} » → ${id} (${nb} question${nb > 1 ? 's' : ''})`);

    batch.set(firestore.collection(COLLECTION).doc(id), {
      id,
      // Le questionnaire prend le nom de l'activité qui le portait : c'est
      // sous ce nom-là que le prof le reconnaîtra dans sa bibliothèque.
      nom: d.intitule || 'Questionnaire',
      description: '',
      profId: d.profId || '',
      anneeScolaire: d.anneeScolaire || '',
      archive: false,
      quiz,
      createdAt: maintenant,
      updatedAt: maintenant,
    });
    // Le `lectureQuiz` embarqué RESTE : filet, et version figée de ce que les
    // élèves ont déjà vu.
    batch.update(doc.ref, { lectureQuizId: id });
    extraits++;
  }

  console.log(
    `   ${extraits} à extraire · ${dejaFaits} déjà fait(s) · ${sansQuiz} activité(s) sans questionnaire`
  );
  if (extraits > 0 && APPLY) {
    await batch.commit();
    console.log('✅ Terminé.');
  } else if (!APPLY) {
    console.log('🔍 Simulation terminée — relancer avec --apply pour écrire.');
  } else {
    console.log('✅ Rien à extraire.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
