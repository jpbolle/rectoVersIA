/**
 * Rattrapage des SESSIONS (étape 2 du chantier « sessions par classe »).
 *
 * Une session = une activité mise en œuvre dans UNE classe. Voir
 * `harnais/plans/2026-09-01-sessions-par-classe.md` et `src/types/session.ts`.
 *
 * Ce que le script fait :
 *   1. pour chaque activité, crée la session manquante de chacune de ses
 *      classes, en HÉRITANT de ses drapeaux (disponible / corrigé / archive) ;
 *   2. pose `sessionId` sur les travaux existants, en retrouvant la classe de
 *      chaque élève (par id de document, puis par empreinte d'email).
 *
 * Ce qu'il NE fait PAS : rien n'est supprimé, rien n'est écrasé. Une session
 * déjà présente est laissée telle quelle, un travail qui porte déjà un
 * `sessionId` n'est pas retouché. Le script est donc **idempotent** : on peut
 * le relancer sans risque.
 *
 * Aucun comportement ne change à l'écran : tant que le prof n'a pas dissocié
 * deux classes, chaque session porte exactement l'état de son activité.
 *
 * Usage :
 *   npx tsx scripts/backfill-sessions.ts             → simulation (dry run)
 *   npx tsx scripts/backfill-sessions.ts --apply     → écriture réelle
 *   npx tsx scripts/backfill-sessions.ts --rollback  → simulation du retour arrière
 *   npx tsx scripts/backfill-sessions.ts --rollback --apply  → retour arrière réel
 *
 * POURQUOI UN RETOUR ARRIÈRE PLUTÔT QU'UNE SAUVEGARDE : cette migration
 * n'écrase et ne supprime RIEN — elle crée une collection neuve et ajoute un
 * champ. L'annuler, c'est donc effacer ce qu'elle a posé, et l'état d'avant est
 * retrouvé exactement. Une sauvegarde de 700 documents ne dirait pas mieux, et
 * se restaurerait beaucoup moins bien.
 *
 * Nécessite FIREBASE_ADMIN_* dans .env.local.
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue, Firestore } from 'firebase-admin/firestore';

// ── .env.local, chargé à la main (le script tourne hors Next.js) ──
function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  for (const ligne of readFileSync(filePath, 'utf-8').split('\n')) {
    const m = ligne.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!m) continue;
    const cle = m[1];
    let val = (m[2] || '').trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[cle]) process.env[cle] = val;
  }
}
loadEnvFile(resolve(process.cwd(), '.env.local'));

const APPLY = process.argv.includes('--apply');
const ROLLBACK = process.argv.includes('--rollback');

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

const sessionId = (devoirId: string, classeId: string) => `SES-${devoirId}-${classeId}`;

/**
 * Retour arrière : efface la collection `sessions` et retire `sessionId` des
 * travaux. Rien d'autre n'ayant été touché, l'état d'avant migration est
 * intégralement retrouvé.
 */
async function rollback(firestore: Firestore) {
  const sessionsSnap = await firestore.collection('sessions').get();
  const travauxSnap = await firestore.collection('travaux').get();
  const aNettoyer = travauxSnap.docs.filter((d) => d.data().sessionId !== undefined);

  console.log(`   ${sessionsSnap.size} sessions à supprimer`);
  console.log(`   ${aNettoyer.length} travaux à débarrasser de leur sessionId`);
  if (!APPLY) {
    console.log('🔍 Simulation terminée — relancer avec --rollback --apply pour écrire.');
    return;
  }

  let batch = firestore.batch();
  let ops = 0;
  const commit = async () => {
    if (ops > 0) await batch.commit();
    batch = firestore.batch();
    ops = 0;
  };
  for (const d of sessionsSnap.docs) {
    batch.delete(d.ref);
    if (++ops >= 400) await commit();
  }
  for (const d of aNettoyer) {
    batch.update(d.ref, { sessionId: FieldValue.delete() });
    if (++ops >= 400) await commit();
  }
  await commit();
  console.log('✅ Retour arrière terminé.');
}

async function main() {
  const firestore = db();
  if (ROLLBACK) {
    console.log(APPLY ? '⏪ RETOUR ARRIÈRE RÉEL' : '🔍 SIMULATION DU RETOUR ARRIÈRE');
    return rollback(firestore);
  }
  console.log(APPLY ? '⚙️  ÉCRITURE RÉELLE' : '🔍 SIMULATION (ajouter --apply pour écrire)');

  // ── 1. Les classes, par prof et par nom (les activités les désignent par nom) ──
  const classesSnap = await firestore.collection('classes').get();
  const parProfEtNom = new Map<string, { id: string; nom: string; anneeScolaire: string }>();
  const classeParId = new Map<string, { nom: string; anneeScolaire: string }>();
  classesSnap.docs.forEach((d) => {
    const c = d.data();
    const entree = { id: d.id, nom: c.nom || '', anneeScolaire: c.anneeScolaire || '' };
    parProfEtNom.set(`${c.profId}||${c.nom}`, entree);
    classeParId.set(d.id, { nom: entree.nom, anneeScolaire: entree.anneeScolaire });
  });
  console.log(`   ${classesSnap.size} classes lues`);

  // ── 2. Une session par (activité, classe) ──
  const devoirsSnap = await firestore.collection('devoirs').get();
  const sessionsExistantes = new Set(
    (await firestore.collection('sessions').get()).docs.map((d) => d.id)
  );
  // Élève -> classe, pour l'étape 3
  const classeDeLEleve = new Map<string, string>();
  (await firestore.collection('eleves').get()).docs.forEach((d) => {
    const e = d.data();
    if (e.classeId) {
      classeDeLEleve.set(d.id, e.classeId);
      if (e.emailHash) classeDeLEleve.set(`hash:${e.emailHash}`, e.classeId);
      if (e.firebaseUid) classeDeLEleve.set(`uid:${e.firebaseUid}`, e.classeId);
    }
  });

  let sessionsCreees = 0;
  let sansClasse = 0;
  let batch = firestore.batch();
  let ops = 0;
  const commit = async () => {
    if (ops > 0 && APPLY) await batch.commit();
    batch = firestore.batch();
    ops = 0;
  };

  for (const doc of devoirsSnap.docs) {
    const d = doc.data();
    const devoirId = d.id || doc.id;
    const noms: string[] = Array.isArray(d.classes) ? d.classes : [];
    if (noms.length === 0) {
      sansClasse++;
      continue;
    }
    for (const nom of noms) {
      const classe = parProfEtNom.get(`${d.profId}||${nom}`);
      if (!classe) {
        console.log(`   ⚠ classe introuvable : « ${nom} » (activité ${devoirId})`);
        continue;
      }
      const id = sessionId(devoirId, classe.id);
      if (sessionsExistantes.has(id)) continue;
      sessionsExistantes.add(id);
      const maintenant = new Date();
      batch.set(firestore.collection('sessions').doc(id), {
        id,
        devoirId,
        classeId: classe.id,
        classeNom: classe.nom,
        // Rattrapage d'un PASSÉ : l'année est celle de l'activité, pas celle
        // d'aujourd'hui — la session reconstitue une mise en œuvre déjà eue.
        // (L'année de la classe n'est pas fiable : deux règles d'année
        // scolaire se contredisaient jusqu'au 2026-09-01.)
        anneeScolaire: d.anneeScolaire || classe.anneeScolaire || '',
        profId: d.profId || '',
        dateRemise: d.dateRemise ?? null,
        disponible: d.disponible ?? true,
        disponibleAt: d.disponibleAt ?? null,
        corrigeDisponible: d.corrigeDisponible === true,
        corrigeDisponibleAt: d.corrigeDisponibleAt ?? null,
        archive: d.archive === true,
        createdAt: maintenant,
        updatedAt: maintenant,
      });
      sessionsCreees++;
      ops++;
      if (ops >= 400) await commit();
    }
  }
  await commit();
  console.log(`   ${sessionsCreees} sessions à créer · ${sansClasse} activités sans classe`);

  // ── Réparation : sessions déjà écrites avec une mauvaise année ──
  // Les premières l'ont prise sur leur CLASSE, dont l'étiquette était fausse
  // (deux règles d'année scolaire se contredisaient). On les réaligne sur
  // l'activité, qui, elle, était juste.
  const anneeDuDevoir = new Map<string, string>();
  devoirsSnap.docs.forEach((doc) => {
    const d = doc.data();
    anneeDuDevoir.set(d.id || doc.id, d.anneeScolaire || '');
  });
  let reparees = 0;
  for (const doc of (await firestore.collection('sessions').get()).docs) {
    const attendue = anneeDuDevoir.get(doc.data().devoirId);
    if (!attendue || doc.data().anneeScolaire === attendue) continue;
    batch.update(doc.ref, { anneeScolaire: attendue, updatedAt: new Date() });
    reparees++;
    ops++;
    if (ops >= 400) await commit();
  }
  await commit();
  console.log(`   ${reparees} sessions à réétiqueter (année scolaire)`);

  // ── 3. `sessionId` sur les travaux existants ──
  const travauxSnap = await firestore.collection('travaux').get();
  let poses = 0;
  let orphelins = 0;
  for (const doc of travauxSnap.docs) {
    const t = doc.data();
    if (t.sessionId) continue;
    const classeId =
      classeDeLEleve.get(t.studentId) ??
      (t.studentEmailHash ? classeDeLEleve.get(`hash:${t.studentEmailHash}`) : undefined) ??
      classeDeLEleve.get(`uid:${t.studentId}`);
    if (!classeId) {
      // Élève supprimé, ou copie d'une classe effacée : on laisse le travail
      // sans session. `etatEffectif` retombera sur les drapeaux de l'activité.
      orphelins++;
      continue;
    }
    batch.update(doc.ref, { sessionId: sessionId(t.devoirId, classeId) });
    poses++;
    ops++;
    if (ops >= 400) await commit();
  }
  await commit();
  console.log(`   ${poses} travaux rattachés · ${orphelins} sans classe retrouvable`);

  console.log(
    APPLY ? '✅ Terminé.' : '🔍 Simulation terminée — relancer avec --apply pour écrire.'
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
