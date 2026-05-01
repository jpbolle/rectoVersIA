/**
 * Script de migration : Supabase (vocab4ever) → Firestore (rectoVersIA)
 *
 * Migre les listes de vocabulaire (themes + mots) depuis Supabase
 * vers la collection Firestore `vocabulaire/{themeName}`.
 *
 * Usage : npx tsx scripts/migrate-vocabulaire.ts
 *
 * Necessite les variables d'environnement Firebase Admin dans .env.local
 * + les variables Supabase (ajoutees temporairement).
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

// --- Configuration Supabase ---
const SUPABASE_URL = 'https://dlmbabfzskyvgjavsitv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsbWJhYmZ6c2t5dmdqYXZzaXR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0OTI0MDcsImV4cCI6MjA3MDA2ODQwN30.WXMIq1QZ2QsZ4otxqqQFwwSAoElaPYKU4_eX9P902q4';

// --- Fallback : donnees locales de vocabulary.json ---
const FALLBACK_DATA: Record<string, { words: { word: string; definition: string; example: string }[] }> = {
  famille: {
    words: [
      { word: "père", definition: "Parent masculin direct", example: "Mon père m'aide à faire mes devoirs." },
      { word: "mère", definition: "Parent féminin direct", example: "Ma mère prépare un délicieux gâteau." },
      { word: "frère", definition: "Garçon né des mêmes parents", example: "Mon frère aîné joue au football." },
      { word: "sœur", definition: "Fille née des mêmes parents", example: "Ma sœur cadette aime lire des livres." },
      { word: "cousin", definition: "Enfant de l'oncle ou de la tante", example: "Je vois mes cousins pendant les vacances." },
    ],
  },
  maison: {
    words: [
      { word: "cuisine", definition: "Pièce où l'on prépare les repas", example: "La cuisine sent bon le pain frais." },
      { word: "salon", definition: "Pièce principale de détente et de réception", example: "Nous regardons la télévision dans le salon." },
      { word: "chambre", definition: "Pièce où l'on dort", example: "Ma chambre est au premier étage." },
      { word: "salle de bain", definition: "Pièce dédiée à l'hygiène personnelle", example: "Je me brosse les dents dans la salle de bain." },
      { word: "jardin", definition: "Espace extérieur cultivé", example: "Les fleurs du jardin sont magnifiques." },
    ],
  },
  ecole: {
    words: [
      { word: "crayon", definition: "Instrument pour écrire ou dessiner", example: "J'écris avec un crayon à papier." },
      { word: "cahier", definition: "Assemblage de feuilles pour écrire", example: "Mon cahier de mathématiques est bleu." },
      { word: "professeur", definition: "Personne qui enseigne", example: "Le professeur explique la leçon." },
      { word: "élève", definition: "Personne qui reçoit un enseignement", example: "Les élèves écoutent attentivement." },
      { word: "tableau", definition: "Surface sur laquelle on écrit dans une classe", example: "Le professeur écrit au tableau." },
    ],
  },
  nature: {
    words: [
      { word: "arbre", definition: "Grande plante à tronc et branches", example: "Les oiseaux nichent dans l'arbre." },
      { word: "fleur", definition: "Partie colorée et parfumée d'une plante", example: "Cette fleur sent très bon." },
      { word: "rivière", definition: "Cours d'eau naturel", example: "Les poissons nagent dans la rivière." },
      { word: "montagne", definition: "Grande élévation naturelle du sol", example: "La montagne est couverte de neige." },
      { word: "soleil", definition: "Astre qui éclaire et réchauffe la Terre", example: "Le soleil brille dans le ciel." },
    ],
  },
  nourriture: {
    words: [
      { word: "pain", definition: "Aliment fait de farine et d'eau", example: "Je mange du pain frais au petit déjeuner." },
      { word: "fromage", definition: "Aliment fait à partir de lait", example: "Le fromage français est réputé." },
      { word: "fruit", definition: "Partie comestible d'une plante", example: "La pomme est un fruit délicieux." },
      { word: "légume", definition: "Plante cultivée pour l'alimentation", example: "Les carottes sont des légumes oranges." },
      { word: "viande", definition: "Chair des animaux consommée comme aliment", example: "Le poulet est une viande blanche." },
    ],
  },
};

// --- Init Firebase Admin ---
function initFirebase() {
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

// --- Fetch depuis Supabase ---
interface SupabaseTheme {
  id: string;
  name: string;
}

interface SupabaseWord {
  id: string;
  word: string;
  definition: string;
  example: string;
  theme_id: string;
}

async function fetchFromSupabase(): Promise<Record<string, { words: { word: string; definition: string; example: string }[] }>> {
  console.log('Tentative de lecture depuis Supabase...');

  // 1. Recuperer les themes
  const themesRes = await fetch(`${SUPABASE_URL}/rest/v1/themes?select=id,name&order=name`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });

  if (!themesRes.ok) {
    throw new Error(`Supabase themes error: ${themesRes.status} ${themesRes.statusText}`);
  }

  const themes: SupabaseTheme[] = await themesRes.json();
  console.log(`  ${themes.length} themes trouves: ${themes.map((t) => t.name).join(', ')}`);

  // 2. Recuperer tous les mots
  const wordsRes = await fetch(`${SUPABASE_URL}/rest/v1/words?select=id,word,definition,example,theme_id&order=word`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });

  if (!wordsRes.ok) {
    throw new Error(`Supabase words error: ${wordsRes.status} ${wordsRes.statusText}`);
  }

  const words: SupabaseWord[] = await wordsRes.json();
  console.log(`  ${words.length} mots trouves au total`);

  // 3. Grouper par theme
  const themeMap = new Map(themes.map((t) => [t.id, t.name]));
  const result: Record<string, { words: { word: string; definition: string; example: string }[] }> = {};

  for (const theme of themes) {
    const themeWords = words
      .filter((w) => w.theme_id === theme.id)
      .map((w) => ({
        word: w.word,
        definition: w.definition || '',
        example: w.example || '',
      }));

    result[theme.name] = { words: themeWords };
    console.log(`  Theme "${theme.name}": ${themeWords.length} mots`);
  }

  return result;
}

// --- Ecriture dans Firestore ---
async function writeToFirestore(
  db: FirebaseFirestore.Firestore,
  data: Record<string, { words: { word: string; definition: string; example: string }[] }>
) {
  console.log('\nEcriture dans Firestore (collection "vocabulaire")...');

  for (const [themeName, themeData] of Object.entries(data)) {
    const docRef = db.collection('vocabulaire').doc(themeName);
    await docRef.set({
      name: themeName,
      words: themeData.words,
      createdAt: new Date(),
      source: 'migration-vocab4ever',
    });
    console.log(`  ✓ vocabulaire/${themeName} — ${themeData.words.length} mots`);
  }
}

// --- Main ---
async function main() {
  console.log('=== Migration Vocabulaire : Supabase → Firestore ===\n');

  // Init Firebase
  const db = initFirebase();
  console.log('Firebase Admin initialise\n');

  // Essayer Supabase d'abord, fallback sur donnees locales
  let data: Record<string, { words: { word: string; definition: string; example: string }[] }>;

  try {
    data = await fetchFromSupabase();
    console.log(`\n✓ Donnees Supabase recuperees avec succes`);
  } catch (error) {
    console.warn(`\n⚠ Erreur Supabase: ${error}`);
    console.log('Utilisation des donnees locales (vocabulary.json)...');
    data = FALLBACK_DATA;
  }

  // Ecrire dans Firestore
  await writeToFirestore(db, data);

  console.log('\n=== Migration terminee avec succes ! ===');
  console.log(`${Object.keys(data).length} themes migres`);
  const totalWords = Object.values(data).reduce((acc, t) => acc + t.words.length, 0);
  console.log(`${totalWords} mots au total`);

  process.exit(0);
}

main().catch((error) => {
  console.error('Erreur fatale:', error);
  process.exit(1);
});
