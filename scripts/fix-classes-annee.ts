/**
 * Réparation de l'année scolaire des CLASSES.
 *
 * Deux règles d'année scolaire coexistaient : celle des activités (bascule le
 * 25 août) et celle des classes (bascule le 1er septembre). Les classes créées
 * entre ces deux dates portent donc l'année PRÉCÉDENTE — une classe de la
 * rentrée 2026-2027 créée le 31 août 2026 est étiquetée « 2025-2026 ».
 * Voir `init.md` §2 « L'année scolaire ». Le code est corrigé depuis le
 * 2026-09-01 ; ce script rattrape les documents déjà écrits.
 *
 * Ce qu'il fait : recalcule l'année de chaque classe D'APRÈS SA DATE DE
 * CRÉATION, avec la règle unique, et ne réécrit que celles qui divergent.
 * Rien d'autre n'est touché. Idempotent.
 *
 * Usage :
 *   npx tsx scripts/fix-classes-annee.ts            → simulation (dry run)
 *   npx tsx scripts/fix-classes-annee.ts --apply    → écriture réelle
 *
 * Nécessite FIREBASE_ADMIN_* dans .env.local.
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

/**
 * La règle unique, appliquée à une date donnée (et non à « maintenant ») :
 * une classe appartient à l'année scolaire en cours le jour de sa création.
 * Copie de `calculateSchoolYear` (src/lib/auth-utils.ts), paramétrée par date —
 * le script tourne hors Next.js et ne peut pas importer l'alias `@/`.
 */
function anneeScolaireA(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  let startYear: number;
  if (month >= 8 && (month > 8 || day >= 25)) startYear = year;
  else if (month <= 7 && (month < 7 || day <= 5)) startYear = year - 1;
  else startYear = year;
  return `${startYear}-${startYear + 1}`;
}

async function main() {
  const firestore = db();
  console.log(APPLY ? '⚙️  ÉCRITURE RÉELLE' : '🔍 SIMULATION (ajouter --apply pour écrire)');

  const snap = await firestore.collection('classes').get();
  const batch = firestore.batch();
  let aCorriger = 0;

  for (const doc of snap.docs) {
    const c = doc.data();
    const creee = doc.createTime?.toDate?.() ?? c.createdAt?.toDate?.() ?? null;
    if (!creee) {
      console.log(`   ⚠ sans date de création, ignorée : « ${c.nom} »`);
      continue;
    }
    const attendue = anneeScolaireA(creee);
    if (c.anneeScolaire === attendue) continue;
    console.log(
      `   « ${c.nom} » créée le ${creee.toISOString().slice(0, 10)} : ` +
        `${c.anneeScolaire || '(vide)'} → ${attendue}`
    );
    batch.update(doc.ref, { anneeScolaire: attendue });
    aCorriger++;
  }

  console.log(`   ${aCorriger} classe(s) à corriger sur ${snap.size}`);
  if (aCorriger > 0 && APPLY) {
    await batch.commit();
    console.log('✅ Terminé.');
  } else if (!APPLY) {
    console.log('🔍 Simulation terminée — relancer avec --apply pour écrire.');
  } else {
    console.log('✅ Rien à corriger.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
