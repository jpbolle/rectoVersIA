/**
 * Liste de départ des GESTES DE SAVOIR-ÊTRE (soft skills et gestes méta).
 *
 * La famille « savoirEtre » a été créée le 2026-08-14 pour la scénarisation
 * didactique : le champ « Savoir-être et gestes réflexifs » d'un module y puise
 * ses valeurs, comme l'activité d'auto-évaluation à venir. Rien n'existait en
 * base pour elle — d'où cet amorçage.
 *
 * Ce ne sont que des propositions : elles se renomment, se masquent ou se
 * suppriment dans /admin → Gestion didactique, qui reste la source de vérité.
 *
 * Usage :
 *   npx tsx scripts/import-savoir-etre.ts            → simulation (dry run)
 *   npx tsx scripts/import-savoir-etre.ts --apply    → écrit dans Firestore
 *
 * REJOUABLE SANS RISQUE — comme import-habiletes.ts : une habileté déjà
 * présente (même id) est laissée strictement intacte, seules les absentes sont
 * ajoutées. Rien d'existant n'est jamais réécrit.
 *
 * Nécessite FIREBASE_ADMIN_* dans .env.local.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { DEFAULT_DIDACTIQUE } from '../src/types/didactique';
import type { DidactiqueConfig, Habilete, TypeModal } from '../src/types/didactique';

// Un GESTE englobe des habiletés : ici, un geste et les « je suis capable
// de… » qui le déclinent. La scénarisation coche le geste, l'évaluation
// descendra à l'habileté.
const GESTES: { type: TypeModal; geste: string; habiletes: string[] }[] = [
  {
    type: 'savoirEtre',
    geste: 'S’engager dans la tâche',
    habiletes: [
      'Je me mets au travail sans attendre qu’on me le redemande',
      'Je vais au bout de ce que j’ai commencé',
      'Je persévère quand la tâche résiste',
    ],
  },
  {
    type: 'savoirEtre',
    geste: 'Coopérer',
    habiletes: [
      'J’écoute ce que disent les autres avant de répondre',
      'Je prends ma part du travail dans un groupe',
      'Je formule un désaccord sans blesser',
    ],
  },
  {
    type: 'savoirEtre',
    geste: 'Prendre soin du cadre de travail',
    habiletes: [
      'J’apporte mon matériel et j’en prends soin',
      'Je remets mon travail dans les délais',
      'Je respecte le silence nécessaire au travail des autres',
    ],
  },
  {
    type: 'savoirEtre',
    geste: 'Accueillir la critique',
    habiletes: [
      'J’écoute une remarque sans me justifier aussitôt',
      'Je tiens compte d’une correction dans le travail suivant',
    ],
  },
  {
    type: 'reflexif',
    geste: 'Évaluer son propre travail',
    habiletes: [
      'Je repère ce que j’ai réussi dans ma production',
      'Je nomme précisément ce qui reste à améliorer',
      'Je situe mon travail par rapport aux critères annoncés',
    ],
  },
  {
    type: 'reflexif',
    geste: 'Réguler son apprentissage',
    habiletes: [
      'Je repère le moment où je ne comprends plus',
      'Je demande de l’aide au bon moment',
      'Je change de méthode quand la première ne marche pas',
    ],
  },
  {
    type: 'reflexif',
    geste: 'Prendre conscience de sa manière d’apprendre',
    habiletes: [
      'Je sais dire ce qui m’aide à comprendre un texte',
      'Je reconnais mes points d’appui et mes fragilités',
    ],
  },
];

// Identifiant stable, dérivé de la position : SE-1-2 = 1er geste, 2e habileté.
// Stable = rejouer le script ne crée pas de doublons.
function idDe(prefixe: string, g: number, h: number): string {
  return `${prefixe}-${g + 1}-${h + 1}`;
}

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

  const proposees: Habilete[] = [];
  GESTES.forEach((g, gi) => {
    const prefixe = g.type === 'savoirEtre' ? 'SE' : 'META';
    g.habiletes.forEach((label, hi) => {
      proposees.push({
        id: idDe(prefixe, gi, hi),
        type: g.type,
        geste: g.geste,
        label,
        objets: [],
        uaa: [],
        // Aucun atelier : ces gestes valent partout, le prof rattache au besoin
        ateliers: [],
        visible: true,
      });
    });
  });

  const db = initFirebase();
  const ref = db.collection('configuration').doc('didactique');
  const snap = await ref.get();
  const stored = (snap.exists ? snap.data() : {}) as Partial<DidactiqueConfig>;
  const existing: Habilete[] = Array.isArray(stored.habiletes) ? stored.habiletes : [];
  const byId = new Map(existing.map((h) => [h.id, h]));

  const nouvelles = proposees.filter((h) => !byId.has(h.id));
  const habiletes = [...existing, ...nouvelles];

  console.log('');
  console.log(`📊 ${proposees.length} habiletés proposées, réparties en ${GESTES.length} gestes`);
  console.log(`   ${nouvelles.length} à ajouter · ${proposees.length - nouvelles.length} déjà présentes`);
  GESTES.forEach((g) => {
    const famille = g.type === 'savoirEtre' ? 'savoir-être' : 'réflexif';
    console.log(`   [${famille.padEnd(11)}] ${g.geste} — ${g.habiletes.length} habiletés`);
  });
  console.log('');

  if (!APPLY) {
    console.log('🔍 Simulation — rien n’a été écrit. Relancer avec --apply pour appliquer.');
    return;
  }

  const uaa = Array.isArray(stored.uaa) && stored.uaa.length ? stored.uaa : DEFAULT_DIDACTIQUE.uaa;
  const methodes =
    Array.isArray(stored.methodes) && stored.methodes.length
      ? stored.methodes
      : DEFAULT_DIDACTIQUE.methodes;
  await ref.set({ uaa, habiletes, methodes } satisfies DidactiqueConfig);
  console.log(`✅ configuration/didactique mis à jour — ${habiletes.length} habiletés au total.`);
}

main().catch((err) => {
  console.error('❌', err instanceof Error ? err.message : err);
  process.exit(1);
});
