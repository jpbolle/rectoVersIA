import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { encrypt } from '@/lib/crypto';
import Anthropic from '@anthropic-ai/sdk';
import type { DictionaryAction } from '@/types/dictionary';

// ── Dictionnaire élève ──
// definition / synonymes / antonymes : Wiktionnaire (parsing du wikitext côté serveur)
// proxemie : Claude API (aucune source publique n'existe pour la proxémie lexicale)
// Cache Firestore `dictionaryCache/{mot}` : un mot déjà demandé ne refait pas le trajet.

const VALID_ACTIONS: DictionaryAction[] = ['definition', 'synonymes', 'antonymes', 'proxemie'];

// ── Nettoyage du wikitext ──

function cleanWikitext(line: string): string {
  let text = line;

  // <ref>...</ref> et balises HTML
  text = text.replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '');
  text = text.replace(/<ref[^>]*\/>/g, '');
  text = text.replace(/<[^>]+>/g, '');

  // Liens [[cible|affiché]] → affiché, [[mot]] → mot
  text = text.replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, '$2');
  text = text.replace(/\[\[([^\]]*)\]\]/g, '$1');

  // Modèles fréquents : {{lien|mot|fr}} → mot, {{w|Titre}} → Titre
  text = text.replace(/\{\{lien\|([^}|]*)[^}]*\}\}/g, '$1');
  text = text.replace(/\{\{w\|([^}|]*)[^}]*\}\}/g, '$1');

  // Étiquettes de sens {{figuré|fr}}, {{familier|fr}} → (Figuré), (Familier)
  text = text.replace(/\{\{([^}|]+)\|fr[^}]*\}\}/g, (_m, label: string) => {
    const clean = label.trim();
    // Étiquettes techniques sans intérêt pour un élève
    if (['S', 'pron', 'exemple', 'source', 'R'].includes(clean)) return '';
    return `(${clean.charAt(0).toUpperCase()}${clean.slice(1)})`;
  });

  // Modèles restants : supprimer
  text = text.replace(/\{\{[^}]*\}\}/g, '');

  // Gras / italique wiki
  text = text.replace(/'''/g, '').replace(/''/g, '');

  return text.replace(/\s+/g, ' ').replace(/\s+([,.;:])/g, '$1').trim();
}

// ── Extraction de la section français du wikitext ──

function extractFrenchSection(wikitext: string): string | null {
  const start = wikitext.search(/==\s*\{\{langue\|fr\}\}\s*==/);
  if (start === -1) return null;
  const rest = wikitext.slice(start);
  // Fin = prochaine section de langue (== {{langue|xx}} ==)
  const next = rest.slice(2).search(/\n==\s*\{\{langue\|/);
  return next === -1 ? rest : rest.slice(0, next + 2);
}

function extractDefinitions(frSection: string): string[] {
  const definitions: string[] = [];
  for (const line of frSection.split('\n')) {
    // `# ` = définition ; `#*` / `#:` = exemples et citations
    if (/^#\s/.test(line)) {
      const cleaned = cleanWikitext(line.replace(/^#\s*/, ''));
      if (cleaned.length > 1) definitions.push(cleaned);
    }
    if (definitions.length >= 5) break;
  }
  return definitions;
}

function extractWordList(frSection: string, sectionName: 'synonymes' | 'antonymes'): string[] {
  const regex = new RegExp(`\\{\\{S\\|${sectionName}[^}]*\\}\\}\\s*=+`);
  const match = frSection.search(regex);
  if (match === -1) return [];

  const rest = frSection.slice(match);
  // La section s'arrête au prochain titre (==== ... ====)
  const lines = rest.split('\n').slice(1);
  const words: string[] = [];

  for (const line of lines) {
    if (/^=+/.test(line) || /^\{\{S\|/.test(line.trim())) break;
    if (!line.trim().startsWith('*')) continue;
    const cleaned = cleanWikitext(line.replace(/^\*+\s*/, ''));
    if (cleaned.length > 0) words.push(cleaned);
    if (words.length >= 15) break;
  }
  return words;
}

// ── Vocabulaire personnel ──
// Chaque mot défini par un élève rejoint sa liste personnelle
// (vocabulairePersonnel/{uid}) — future source des « mots personnels » dans les exercices.

async function ajouterAuVocabulairePersonnel(
  uid: string,
  email: string,
  word: string,
  definitions: string[]
) {
  // Ne pas mémoriser les mots introuvables
  if (definitions.length === 0) return;
  try {
    const ref = adminDb.collection('vocabulairePersonnel').doc(uid);
    const doc = await ref.get();
    const words: Array<{ word?: string }> = (doc.exists ? doc.data()?.words : []) || [];
    const normalized = word.toLowerCase();
    if (words.some((w) => (w.word || '').toLowerCase() === normalized)) return;
    words.push({
      word: normalized,
      definition: definitions[0] || '',
      example: '',
      addedAt: new Date().toISOString(),
    } as { word: string });
    await ref.set(
      { studentEmail: encrypt(email), words, updatedAt: new Date().toISOString() },
      { merge: true }
    );
  } catch (err) {
    // Le suivi ne doit jamais faire échouer la consultation
    console.error('Erreur vocabulairePersonnel:', err);
  }
}

// ── Flexions ──
// « Première personne du singulier de l'imparfait de ressentir. » → suivre vers « ressentir »

const FLEXION_PATTERN =
  /\b(personne du (singulier|pluriel)|participe (passé|présent)|pluriel de|féminin (singulier |pluriel )?de|masculin (singulier |pluriel )?de|forme conjuguée|variante de)\b/i;

function detectFlexionLemma(definitions: string[], word: string): string | null {
  const first = definitions[0];
  if (!first || !FLEXION_PATTERN.test(first)) return null;
  // Le lemme est le dernier mot de la phrase (« … de ressentir. », « … du verbe chanter. »)
  const match = first.match(/\b(?:du verbe|de|d['’])\s*([\p{L}\p{M}-]+)\s*\.?\s*$/u);
  if (!match) return null;
  const lemma = match[1].toLowerCase();
  return lemma !== word ? lemma : null;
}

// ── Wiktionnaire ──

async function fetchWiktionnaire(word: string): Promise<string | null> {
  const url =
    'https://fr.wiktionary.org/w/api.php?action=parse&prop=wikitext&format=json&formatversion=2&redirects=1&page=' +
    encodeURIComponent(word);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'RectoVersIA/1.0 (outil pedagogique; contact admin)' },
  });
  if (!res.ok) return null;
  const json = await res.json();
  if (json.error || !json.parse?.wikitext) return null;
  return json.parse.wikitext as string;
}

// ── Proxémie via Claude ──

async function fetchProxemie(word: string): Promise<string[]> {
  const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 500,
    system: `Tu es un dictionnaire de proxémie lexicale pour des élèves de 15 ans francophones (Belgique).
Pour le mot donné, fournis 10 à 14 mots proches par le sens (proxémie lexicale : voisinage sémantique,
comme le Dictionnaire Électronique des Synonymes du CRISCO), classés du plus proche au plus éloigné.
Uniquement des mots français courants et corrects. Réponds UNIQUEMENT en JSON valide, sans texte
autour : { "mots": ["mot1", "mot2", ...] }
Si le mot n'existe pas en français, réponds { "mots": [] }.`,
    messages: [{ role: 'user', content: word }],
  });

  const responseText = message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim()
    .replace(/^```(json)?\n?/, '')
    .replace(/\n?```$/, '');

  try {
    const parsed = JSON.parse(responseText);
    return Array.isArray(parsed.mots) ? parsed.mots.filter((m: unknown) => typeof m === 'string') : [];
  } catch {
    return [];
  }
}

// ── GET ?word=…&action=… ──

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawWord = (searchParams.get('word') || '').trim().toLowerCase();
  const action = searchParams.get('action') as DictionaryAction;

  if (!rawWord || rawWord.length > 50 || !VALID_ACTIONS.includes(action)) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
  }
  // Un seul mot (éventuellement composé) — pas de phrase
  const word = rawWord.replace(/\s+/g, ' ');
  if (word.split(' ').length > 3) {
    return NextResponse.json({ error: 'Un seul mot à la fois' }, { status: 400 });
  }

  const cacheId = encodeURIComponent(word);
  const cacheRef = adminDb.collection('dictionaryCache').doc(cacheId);

  try {
    // 1. Cache (v2 : entrées Wiktionnaire avec suivi de flexion)
    const cacheDoc = await cacheRef.get();
    const cached = cacheDoc.exists ? cacheDoc.data() : null;
    const cacheValid =
      cached && Array.isArray(cached[action]) && (action === 'proxemie' || cached.v === 2);
    if (cacheValid && cached) {
      if (action === 'definition' && auth.role === 'eleve') {
        await ajouterAuVocabulairePersonnel(auth.uid, auth.email, word, cached[action]);
      }
      return NextResponse.json({
        success: true,
        data: { word, action, items: cached[action] },
      });
    }

    // 2. Proxémie → Claude
    if (action === 'proxemie') {
      const mots = await fetchProxemie(word);
      await cacheRef.set({ word, proxemie: mots, updatedAt: new Date() }, { merge: true });
      return NextResponse.json({ success: true, data: { word, action, items: mots } });
    }

    // 3. Définition / synonymes / antonymes → Wiktionnaire
    const wikitext = await fetchWiktionnaire(word);
    const frSection = wikitext ? extractFrenchSection(wikitext) : null;

    if (!frSection) {
      // Mémoriser l'absence pour éviter de re-consulter le Wiktionnaire
      await cacheRef.set(
        { word, definition: [], synonymes: [], antonymes: [], v: 2, updatedAt: new Date() },
        { merge: true }
      );
      return NextResponse.json({ success: true, data: { word, action, items: [] } });
    }

    let definition = extractDefinitions(frSection);
    let synonymes = extractWordList(frSection, 'synonymes');
    let antonymes = extractWordList(frSection, 'antonymes');

    // Flexion (« … de ressentir. ») → compléter avec le mot de base
    const lemma = detectFlexionLemma(definition, word);
    if (lemma) {
      const lemmaWikitext = await fetchWiktionnaire(lemma);
      const lemmaFr = lemmaWikitext ? extractFrenchSection(lemmaWikitext) : null;
      if (lemmaFr) {
        const lemmaDefs = extractDefinitions(lemmaFr).map((d) => `${lemma} : ${d}`);
        definition = [...definition.slice(0, 1), ...lemmaDefs].slice(0, 5);
        if (synonymes.length === 0) synonymes = extractWordList(lemmaFr, 'synonymes');
        if (antonymes.length === 0) antonymes = extractWordList(lemmaFr, 'antonymes');
      }
    }

    await cacheRef.set(
      { word, definition, synonymes, antonymes, v: 2, updatedAt: new Date() },
      { merge: true }
    );

    const items = action === 'definition' ? definition : action === 'synonymes' ? synonymes : antonymes;

    if (action === 'definition' && auth.role === 'eleve') {
      await ajouterAuVocabulairePersonnel(auth.uid, auth.email, word, definition);
    }

    return NextResponse.json({ success: true, data: { word, action, items } });
  } catch (err) {
    console.error('Erreur GET /api/dictionary:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
