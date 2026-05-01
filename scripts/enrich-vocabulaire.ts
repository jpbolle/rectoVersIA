/**
 * Script d'enrichissement : ajoute synonymes, antonymes et proxemie linguistique
 * a tous les mots de vocabulaire existants dans Firestore.
 *
 * Utilise Claude API pour generer des donnees linguistiques reelles.
 *
 * Usage : npx tsx scripts/enrich-vocabulaire.ts
 *
 * Necessite .env.local avec :
 *   - FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY
 *   - CLAUDE_API_KEY
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

interface VocabulaireWord {
  word: string;
  definition: string;
  example: string;
  synonyms?: string;
  antonyms?: string;
  wordFamily?: string;
}

interface EnrichedData {
  word: string;
  synonyms: string;
  antonyms: string;
  wordFamily: string;
  example: string;
}

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

// --- Appel Claude API ---
async function enrichWords(words: VocabulaireWord[]): Promise<EnrichedData[]> {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) throw new Error('CLAUDE_API_KEY manquante dans .env.local');

  const wordList = words.map((w) => `- "${w.word}" (def: ${w.definition})`).join('\n');

  const prompt = `Pour chaque mot français ci-dessous, donne :
- synonyms : 2-3 synonymes séparés par des virgules (ou "—" si aucun)
- antonyms : 1-2 antonymes séparés par des virgules (ou "—" si aucun)
- wordFamily : 2-4 mots de la même famille (dérivés, composés) séparés par des virgules (ou "—" si aucun)
- example : UNE phrase d'exemple naturelle et vivante utilisant ce mot, adaptée à un élève de 15 ans (contexte scolaire, quotidien ado, actualité, culture). Si le mot a déjà un exemple fourni, améliore-le ou garde-le tel quel.

Mots :
${wordList}

Réponds UNIQUEMENT en JSON, un tableau d'objets avec les champs : word, synonyms, antonyms, wordFamily, example.
Pas de markdown, pas d'explication, juste le JSON.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }

  const json = await res.json();
  const text = json.content?.[0]?.text || '';

  // Extraire le JSON (avec ou sans backticks)
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error('Reponse inattendue:', text.slice(0, 500));
    throw new Error('Pas de JSON dans la reponse Claude');
  }

  return JSON.parse(jsonMatch[0]);
}

// --- Main ---
async function main() {
  console.log('=== Enrichissement du vocabulaire ===\n');

  const db = initFirebase();
  console.log('Firebase Admin initialise\n');

  // Lire toutes les listes
  const snapshot = await db.collection('vocabulaire').get();
  console.log(`${snapshot.docs.length} listes trouvees\n`);

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const themeName = data.name || doc.id;
    const words: VocabulaireWord[] = data.words || [];

    if (words.length === 0) {
      console.log(`  ⏭ ${themeName} : aucun mot, passe`);
      continue;
    }

    // Verifier si deja enrichi (tous les champs remplis)
    const alreadyEnriched = words.every(
      (w) => w.synonyms && w.synonyms !== '' && w.example && w.example !== ''
    );
    if (alreadyEnriched) {
      console.log(`  ✓ ${themeName} : deja enrichi (${words.length} mots)`);
      continue;
    }

    console.log(`  → ${themeName} : enrichissement de ${words.length} mots...`);

    try {
      // Envoyer par lots de 20 max
      const batchSize = 20;
      const enriched: EnrichedData[] = [];

      for (let i = 0; i < words.length; i += batchSize) {
        const batch = words.slice(i, i + batchSize);
        const batchResult = await enrichWords(batch);
        enriched.push(...batchResult);

        if (i + batchSize < words.length) {
          // Pause entre les lots pour eviter le rate limiting
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      // Fusionner les donnees enrichies avec les mots existants
      const updatedWords = words.map((w) => {
        const match = enriched.find(
          (e) => e.word.toLowerCase().trim() === w.word.toLowerCase().trim()
        );
        if (match) {
          return {
            ...w,
            synonyms: match.synonyms || '—',
            antonyms: match.antonyms || '—',
            wordFamily: match.wordFamily || '—',
            example: match.example || w.example || '',
          };
        }
        return w;
      });

      // Ecrire dans Firestore
      await db.collection('vocabulaire').doc(doc.id).update({
        words: updatedWords,
        updatedAt: new Date().toISOString(),
      });

      console.log(`    ✓ ${themeName} enrichi avec succes`);

      // Afficher un apercu
      const preview = updatedWords[0];
      if (preview) {
        console.log(`      Exemple : "${preview.word}"`);
        console.log(`        Synonymes : ${preview.synonyms}`);
        console.log(`        Antonymes : ${preview.antonyms}`);
        console.log(`        Proxemie  : ${preview.wordFamily}`);
      }

      // Pause entre les themes
      await new Promise((r) => setTimeout(r, 1500));
    } catch (err) {
      console.error(`    ✗ Erreur pour ${themeName}:`, err);
    }
  }

  console.log('\n=== Enrichissement termine ! ===');
  process.exit(0);
}

main().catch((error) => {
  console.error('Erreur fatale:', error);
  process.exit(1);
});
