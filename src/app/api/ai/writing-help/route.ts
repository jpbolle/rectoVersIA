import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import Anthropic from '@anthropic-ai/sdk';
import type { AiSuggestion, AiSuggestionType, AiSuggestionItem } from '@/types/ai-suggestions';

// ── Prompts système par type ──

const SYSTEM_PROMPTS: Record<AiSuggestionType, string> = {
  ortho: `Tu es un assistant pédagogique pour des élèves de 15 ans. Utilise un vocabulaire simple et clair, évite le jargon grammatical compliqué.

RÔLE : repérer les fautes d'orthographe dans chaque paragraphe.

RÈGLES STRICTES :
- Ne cite JAMAIS les mots fautifs du texte. L'élève doit les chercher lui-même.
- Indique uniquement le NOMBRE de fautes par catégorie dans le paragraphe.
- Catégories possibles : orthographe d'un mot, accord (genre/nombre), conjugaison, participe passé, homophones.
- Donne une piste générale sans révéler le mot. Exemple : « Dans ce paragraphe, 1 souci d'accord entre un adjectif et le nom qu'il accompagne. »
- Si un paragraphe ne contient aucune faute d'orthographe, ne l'inclus pas.
- Ne commente PAS la ponctuation, la syntaxe ou le vocabulaire.`,

  ponctu: `Tu es un assistant pédagogique pour des élèves de 15 ans. Utilise un vocabulaire simple et clair.

RÔLE : analyser l'usage de la ponctuation dans chaque paragraphe.

CE QUI T'INTÉRESSE :
- Les virgules manquantes ou mal placées (dans les énumérations, avant/après un complément déplacé, etc.)
- Les points-virgules, deux-points, points d'exclamation ou d'interrogation mal utilisés ou absents
- L'absence de variété dans la ponctuation (tout en virgules, par exemple)

CE QUE TU DOIS IGNORER :
- Les espaces manquants avant ou après les signes de ponctuation (ce sont des problèmes de mise en forme, pas de langue)
- L'orthographe, la syntaxe et le vocabulaire

RÈGLES :
- Si les seuls problèmes sont des espaces mal placés, considère le paragraphe comme correct.
- Ne réécris pas les phrases. Donne une piste pour que l'élève réfléchisse.
- Si un paragraphe est correct, ne l'inclus pas.`,

  synt: `Tu es un assistant pédagogique pour des élèves de 15 ans. Utilise un vocabulaire simple et clair, pas de termes techniques compliqués.

RÔLE : analyser la CONSTRUCTION des phrases dans chaque paragraphe.

CE QUE TU VÉRIFIES :
1. Les phrases sont-elles correctement construites ? (sujet-verbe-complément cohérent, pas de mélange de constructions)
2. Les phrases sont-elles équilibrées et faciles à comprendre ? (pas trop longues, pas de surcharge d'informations)
3. Y a-t-il des mots ou des tournures trop répétés ? (« et… et… et… », « puis… puis… », « il y a… il y a… », ou un même mot qui revient plusieurs fois)
4. Les mots de liaison sont-ils variés et bien choisis ?

CE QUE TU NE FAIS PAS :
- Tu ne corriges PAS l'orthographe (c'est le rôle d'un autre outil)
- Tu ne corriges PAS la ponctuation
- Tu ne donnes PAS la phrase corrigée : tu décris le problème et tu pousses l'élève à reformuler

Le champ targetText doit contenir le passage exact qui pose problème (la phrase ou le bout de phrase).
Si un paragraphe est correct, ne l'inclus pas.`,

  lex: `Tu es un assistant pédagogique pour des élèves de 15 ans. Utilise un vocabulaire simple et clair.

RÔLE : vérifier la PRÉCISION et la PERTINENCE du vocabulaire dans chaque paragraphe.

CE QUE TU VÉRIFIES :
- Un mot est-il utilisé dans le bon sens ? (ex : « amener » au lieu de « apporter », « conséquent » au lieu de « important »)
- Un mot est-il trop vague ou imprécis pour le contexte ? (« chose », « truc », « faire », « avoir », « être » utilisés à répétition)
- Un mot est-il un néologisme, un anglicisme inutile ou un mot inventé ?
- Le registre de langue est-il adapté ? (pas de langage familier dans un texte formel)

CE QUE TU NE FAIS PAS :
- Tu ne corriges PAS l'orthographe des mots (c'est le rôle d'un autre outil)
- Tu ne donnes JAMAIS le mot correct : tu décris le problème et tu pousses l'élève à trouver un meilleur mot par lui-même
- Tu ne commentes PAS la syntaxe ou la ponctuation

Le champ targetText doit contenir le mot ou l'expression exacte qui pose problème.
Si un paragraphe est correct, ne l'inclus pas.`,
};

// ── Format JSON demandé à Claude ──

const JSON_INSTRUCTIONS: Record<'margin' | 'inline', string> = {
  margin: `
Réponds UNIQUEMENT en JSON valide, sans texte avant ou après, sans blocs markdown.
Format attendu :
{ "suggestions": [{ "paragraphIndex": 0, "suggestion": "Ton aide ici..." }, ...] }
Le champ paragraphIndex est l'index (0-based) du paragraphe concerné.
Si aucun problème n'est détecté, retourne { "suggestions": [] }.`,

  inline: `
Réponds UNIQUEMENT en JSON valide, sans texte avant ou après, sans blocs markdown.
Format attendu :
{ "suggestions": [{ "paragraphIndex": 0, "targetText": "le passage exact problématique", "suggestion": "Ton aide ici..." }, ...] }
Le champ targetText DOIT contenir le passage EXACT tel qu'il apparaît dans le texte de l'élève (copie mot à mot).
Le champ paragraphIndex est l'index (0-based) du paragraphe concerné.
Si aucun problème n'est détecté, retourne { "suggestions": [] }.`,
};

// ── Helpers ──

function extractParagraphs(html: string): string[] {
  // Séparer par balises de paragraphe
  const parts = html.split(/<\/p>/i);
  return parts
    .map(p => p.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim())
    .filter(p => p.length > 0);
}

function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();
  // Retirer les blocs markdown ```json ... ```
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.split('\n').slice(1).join('\n');
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.substring(0, cleaned.lastIndexOf('```'));
    }
    cleaned = cleaned.trim();
  }
  return cleaned;
}

function parseClaudeResponse(
  rawText: string,
  type: AiSuggestionType
): AiSuggestionItem[] {
  const cleaned = cleanJsonResponse(rawText);

  let parsed: { suggestions: Array<{
    paragraphIndex: number;
    suggestion: string;
    targetText?: string;
  }> };

  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Fallback : chercher un objet JSON dans le texte
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        // Dernier recours : une seule suggestion avec le texte brut
        return [{
          id: 'item-0',
          paragraphIndex: 0,
          content: rawText.substring(0, 500),
          dismissed: false,
        }];
      }
    } else {
      return [{
        id: 'item-0',
        paragraphIndex: 0,
        content: rawText.substring(0, 500),
        dismissed: false,
      }];
    }
  }

  if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
    return [{
      id: 'item-0',
      paragraphIndex: 0,
      content: rawText.substring(0, 500),
      dismissed: false,
    }];
  }

  return parsed.suggestions.map((s, i) => ({
    id: `item-${i}`,
    paragraphIndex: s.paragraphIndex ?? 0,
    content: s.suggestion || '',
    dismissed: false,
    ...(type === 'synt' || type === 'lex' ? { targetText: s.targetText } : {}),
  }));
}

// ── GET : Récupérer les suggestions existantes ──

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const travailId = searchParams.get('travailId');

  if (!travailId) {
    return NextResponse.json({ error: 'travailId requis' }, { status: 400 });
  }

  try {
    const snapshot = await adminDb
      .collection('aiSuggestions')
      .where('travailId', '==', travailId)
      .get();

    const suggestions: AiSuggestion[] = [];
    snapshot.forEach(doc => suggestions.push(doc.data() as AiSuggestion));

    return NextResponse.json({ success: true, data: suggestions });
  } catch (err) {
    console.error('Erreur GET aiSuggestions:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// ── POST : Demander une analyse IA ──

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  if (auth.role !== 'eleve') {
    return NextResponse.json({ error: 'Réservé aux élèves' }, { status: 403 });
  }

  let body: { travailId: string; devoirId: string; type: AiSuggestionType; content: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const { travailId, devoirId, type, content } = body;

  // Valider le type
  const validTypes: AiSuggestionType[] = ['ortho', 'ponctu', 'synt', 'lex'];
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: 'Type invalide' }, { status: 400 });
  }

  // Vérifier que le contenu n'est pas vide
  const textContent = content.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
  if (!textContent) {
    return NextResponse.json({ error: 'Le texte est vide' }, { status: 400 });
  }

  // Vérifier que le devoir autorise l'IA
  try {
    const devoirDoc = await adminDb.collection('devoirs').doc(devoirId).get();
    if (!devoirDoc.exists) {
      return NextResponse.json({ error: 'Devoir non trouvé' }, { status: 404 });
    }
    if (!devoirDoc.data()?.accesIA) {
      return NextResponse.json({ error: "L'accès IA n'est pas activé pour ce devoir" }, { status: 403 });
    }
  } catch (err) {
    console.error('Erreur vérification devoir:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }

  // Vérifier la limite (1 appel par type)
  const docId = `AI-${travailId}-${type}`;
  try {
    const existingDoc = await adminDb.collection('aiSuggestions').doc(docId).get();
    if (existingDoc.exists) {
      // Retourner les suggestions existantes (idempotent)
      return NextResponse.json({ success: true, data: existingDoc.data() });
    }
  } catch (err) {
    console.error('Erreur vérification existant:', err);
  }

  // Extraire les paragraphes
  const paragraphs = extractParagraphs(content);
  if (paragraphs.length === 0) {
    return NextResponse.json({ error: 'Le texte est vide' }, { status: 400 });
  }

  // Construire le prompt utilisateur
  const numberedText = paragraphs
    .map((p, i) => `[Paragraphe ${i}] ${p}`)
    .join('\n\n');

  const jsonInstructions = (type === 'ortho' || type === 'ponctu')
    ? JSON_INSTRUCTIONS.margin
    : JSON_INSTRUCTIONS.inline;

  const systemPrompt = SYSTEM_PROMPTS[type] + '\n' + jsonInstructions;

  // Appeler Claude API
  try {
    const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Voici le texte de l'élève :\n\n${numberedText}`,
      }],
    });

    // Extraire le texte de la réponse
    const responseText = message.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('');

    // Parser la réponse
    const suggestionItems = parseClaudeResponse(responseText, type);

    // Construire le document Firestore
    const aiSuggestion: AiSuggestion = {
      id: docId,
      travailId,
      devoirId,
      studentId: auth.uid,
      type,
      textSnapshot: content,
      suggestions: suggestionItems,
      createdAt: new Date().toISOString(),
    };

    // Sauvegarder dans Firestore
    await adminDb.collection('aiSuggestions').doc(docId).set(aiSuggestion);

    return NextResponse.json({ success: true, data: aiSuggestion });

  } catch (err) {
    console.error('Erreur appel Claude API:', err);
    return NextResponse.json(
      { error: 'Erreur lors de l\'analyse IA. Veuillez réessayer.' },
      { status: 500 }
    );
  }
}
