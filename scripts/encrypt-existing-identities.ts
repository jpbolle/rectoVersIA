/**
 * Migration RGPD : chiffrement des champs d'identité élèves existants.
 *
 * Collections traitées :
 *   - eleves            : nom, prenom, email chiffrés + emailHash ajouté
 *   - travaux           : studentName, studentEmail chiffrés + studentEmailHash ajouté
 *   - vocabulairePersonnel : studentEmail chiffré
 *   - users             : email, displayName chiffrés
 *   - questionnaires/{id}/reponses : eleveNom, eleveEmail chiffrés
 *   - recherches        : eleveNom chiffré
 *
 * Usage :
 *   npx tsx scripts/encrypt-existing-identities.ts            → simulation (dry run)
 *                                                                + sauvegarde JSON
 *   npx tsx scripts/encrypt-existing-identities.ts --apply    → migration réelle
 *                                                                (sauvegarde d'abord)
 *
 * La sauvegarde est écrite dans backups/ (ignoré par git — ne JAMAIS la committer).
 * Idempotent : les valeurs déjà chiffrées (isEncrypted) sont laissées telles quelles.
 * Nécessite FIREBASE_ADMIN_* et ENCRYPTION_KEY dans .env.local.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { encrypt, hashEmail, isEncrypted } from '../src/lib/crypto';

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
    if (!process.env[key]) {
      process.env[key] = value;
    }
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

const APPLY = process.argv.includes('--apply');

interface MigrationStats {
  total: number;
  toMigrate: number;
  alreadyEncrypted: number;
}

async function main() {
  if (!process.env.ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY manquante dans .env.local — la générer d\'abord');
  }

  const db = initFirebase();

  // ── 1. Sauvegarde JSON complète des collections touchées ──
  const [elevesSnap, travauxSnap, vocabSnap, usersSnap, reponsesSnap, recherchesSnap] =
    await Promise.all([
      db.collection('eleves').get(),
      db.collection('travaux').get(),
      db.collection('vocabulairePersonnel').get(),
      db.collection('users').get(),
      db.collectionGroup('reponses').get(), // questionnaires/{id}/reponses/{eleveId}
      db.collection('recherches').get(),
    ]);

  const backupDir = resolve('backups');
  if (!existsSync(backupDir)) mkdirSync(backupDir);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupPath = resolve(backupDir, `identites-avant-chiffrement-${stamp}.json`);
  writeFileSync(
    backupPath,
    JSON.stringify(
      {
        eleves: elevesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        travaux: travauxSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        vocabulairePersonnel: vocabSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        users: usersSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        reponses: reponsesSnap.docs.map((d) => ({ path: d.ref.path, ...d.data() })),
        recherches: recherchesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      },
      null,
      2
    )
  );
  console.log(`Sauvegarde écrite : ${backupPath}`);
  console.log('⚠️  Ce fichier contient des données en clair — ne pas le committer.\n');

  // ── 2. Migration (ou simulation) ──
  let batch = db.batch();
  let batchCount = 0;
  const commitIfNeeded = async (force = false) => {
    if (batchCount >= 400 || (force && batchCount > 0)) {
      if (APPLY) await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  };

  // eleves : nom, prenom, email + emailHash
  const statsEleves: MigrationStats = { total: elevesSnap.size, toMigrate: 0, alreadyEncrypted: 0 };
  for (const doc of elevesSnap.docs) {
    const data = doc.data();
    const updates: Record<string, string> = {};
    for (const field of ['nom', 'prenom', 'email'] as const) {
      const value = data[field];
      if (typeof value === 'string' && value.length > 0 && !isEncrypted(value)) {
        updates[field] = encrypt(field === 'email' ? value.toLowerCase() : value);
        if (field === 'email') updates.emailHash = hashEmail(value);
      }
    }
    if (Object.keys(updates).length === 0) {
      statsEleves.alreadyEncrypted++;
      continue;
    }
    statsEleves.toMigrate++;
    batch.update(doc.ref, updates);
    batchCount++;
    await commitIfNeeded();
  }

  // travaux : studentName, studentEmail + studentEmailHash
  const statsTravaux: MigrationStats = { total: travauxSnap.size, toMigrate: 0, alreadyEncrypted: 0 };
  for (const doc of travauxSnap.docs) {
    const data = doc.data();
    const updates: Record<string, string> = {};
    if (typeof data.studentName === 'string' && data.studentName.length > 0 && !isEncrypted(data.studentName)) {
      updates.studentName = encrypt(data.studentName);
    }
    if (typeof data.studentEmail === 'string' && data.studentEmail.length > 0 && !isEncrypted(data.studentEmail)) {
      updates.studentEmail = encrypt(data.studentEmail.toLowerCase());
      updates.studentEmailHash = hashEmail(data.studentEmail);
    }
    if (Object.keys(updates).length === 0) {
      statsTravaux.alreadyEncrypted++;
      continue;
    }
    statsTravaux.toMigrate++;
    batch.update(doc.ref, updates);
    batchCount++;
    await commitIfNeeded();
  }

  // vocabulairePersonnel : studentEmail
  const statsVocab: MigrationStats = { total: vocabSnap.size, toMigrate: 0, alreadyEncrypted: 0 };
  for (const doc of vocabSnap.docs) {
    const data = doc.data();
    if (typeof data.studentEmail === 'string' && data.studentEmail.length > 0 && !isEncrypted(data.studentEmail)) {
      statsVocab.toMigrate++;
      batch.update(doc.ref, { studentEmail: encrypt(data.studentEmail.toLowerCase()) });
      batchCount++;
      await commitIfNeeded();
    } else {
      statsVocab.alreadyEncrypted++;
    }
  }

  // reponses NavigKid (sous-collections) : eleveNom, eleveEmail
  const statsReponses: MigrationStats = { total: reponsesSnap.size, toMigrate: 0, alreadyEncrypted: 0 };
  for (const doc of reponsesSnap.docs) {
    const data = doc.data();
    const updates: Record<string, string> = {};
    for (const field of ['eleveNom', 'eleveEmail'] as const) {
      const value = data[field];
      if (typeof value === 'string' && value.length > 0 && !isEncrypted(value)) {
        updates[field] = encrypt(value);
      }
    }
    if (Object.keys(updates).length === 0) {
      statsReponses.alreadyEncrypted++;
      continue;
    }
    statsReponses.toMigrate++;
    batch.update(doc.ref, updates);
    batchCount++;
    await commitIfNeeded();
  }

  // recherches NavigKid : eleveNom
  const statsRecherches: MigrationStats = { total: recherchesSnap.size, toMigrate: 0, alreadyEncrypted: 0 };
  for (const doc of recherchesSnap.docs) {
    const data = doc.data();
    if (typeof data.eleveNom === 'string' && data.eleveNom.length > 0 && !isEncrypted(data.eleveNom)) {
      statsRecherches.toMigrate++;
      batch.update(doc.ref, { eleveNom: encrypt(data.eleveNom) });
      batchCount++;
      await commitIfNeeded();
    } else {
      statsRecherches.alreadyEncrypted++;
    }
  }

  // users : email, displayName
  const statsUsers: MigrationStats = { total: usersSnap.size, toMigrate: 0, alreadyEncrypted: 0 };
  for (const doc of usersSnap.docs) {
    const data = doc.data();
    const updates: Record<string, string> = {};
    for (const field of ['email', 'displayName'] as const) {
      const value = data[field];
      if (typeof value === 'string' && value.length > 0 && !isEncrypted(value)) {
        updates[field] = encrypt(value);
      }
    }
    if (Object.keys(updates).length === 0) {
      statsUsers.alreadyEncrypted++;
      continue;
    }
    statsUsers.toMigrate++;
    batch.update(doc.ref, updates);
    batchCount++;
    await commitIfNeeded();
  }

  await commitIfNeeded(true);

  // ── 3. Rapport ──
  const mode = APPLY ? 'MIGRATION APPLIQUÉE' : 'SIMULATION (rien écrit — relancer avec --apply)';
  console.log(`\n=== ${mode} ===`);
  for (const [name, s] of [
    ['eleves', statsEleves],
    ['travaux', statsTravaux],
    ['vocabulairePersonnel', statsVocab],
    ['users', statsUsers],
    ['reponses (NavigKid)', statsReponses],
    ['recherches (NavigKid)', statsRecherches],
  ] as const) {
    console.log(
      `${name} : ${s.total} documents — ${s.toMigrate} ${APPLY ? 'chiffrés' : 'à chiffrer'}, ${s.alreadyEncrypted} déjà chiffrés ou vides`
    );
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error('Échec de la migration :', err);
    process.exit(1);
  }
);
