import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/api-auth';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

// POST - Suggerer des mots pour un theme OU enrichir des mots selectionnes
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth || auth.role !== 'prof') {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, themeName, words, existingWords } = body as {
      action: 'suggest' | 'enrich';
      themeName?: string;
      words?: string[];
      existingWords?: string[];
    };

    if (action === 'suggest') {
      // Generer une liste de mots/expressions pour un theme
      if (!themeName) {
        return NextResponse.json(
          { success: false, message: 'Nom du thème requis' },
          { status: 400 }
        );
      }

      const existingContext = existingWords && existingWords.length > 0
        ? `\n\nLa liste contient déjà ces mots : ${existingWords.join(', ')}.\nPropose des mots COMPLÉMENTAIRES qui enrichissent cette liste (pas de doublons, pas de simples variantes). Privilégie des mots qui couvrent d'autres aspects du thème, d'autres registres ou d'autres catégories grammaticales.`
        : '';

      const response = await client.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: `Tu es un professeur de français pour des élèves de 15 ans (3e secondaire en Belgique).

Pour le champ lexical / thème "${themeName}", propose une liste de 20 à 30 mots et expressions françaises pertinents et variés. Inclus :
- Des mots courants et soutenus
- Des expressions idiomatiques
- Des termes littéraires si pertinent${existingContext}

Réponds UNIQUEMENT en JSON : un tableau de strings (les mots/expressions).
Pas de markdown, pas d'explication, juste le JSON.`,
        }],
      });

      const text = (response.content[0] as { type: string; text: string }).text;
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return NextResponse.json(
          { success: false, message: 'Erreur de génération' },
          { status: 500 }
        );
      }

      const suggestions: string[] = JSON.parse(jsonMatch[0]);
      return NextResponse.json({ success: true, data: suggestions });
    }

    if (action === 'enrich') {
      // Enrichir des mots avec definition, exemple, synonymes, antonymes, proxemie
      if (!words || !Array.isArray(words) || words.length === 0) {
        return NextResponse.json(
          { success: false, message: 'Liste de mots requise' },
          { status: 400 }
        );
      }

      const wordList = words.map((w) => `- "${w}"`).join('\n');

      const response = await client.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: `Tu es un professeur de français pour des élèves de 15 ans (3e secondaire en Belgique).

Pour chaque mot/expression ci-dessous, donne :
- word : le mot tel quel
- definition : une définition claire et précise
- example : une phrase d'exemple naturelle et vivante, adaptée à un ado de 15 ans
- synonyms : 2-3 synonymes séparés par des virgules (ou "—" si aucun)
- antonyms : 1-2 antonymes séparés par des virgules (ou "—" si aucun)
- wordFamily : 2-4 mots de la même famille séparés par des virgules (ou "—" si aucun)

Mots :
${wordList}

Réponds UNIQUEMENT en JSON : un tableau d'objets avec les champs ci-dessus.
Pas de markdown, pas d'explication, juste le JSON.`,
        }],
      });

      const text = (response.content[0] as { type: string; text: string }).text;
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return NextResponse.json(
          { success: false, message: 'Erreur de génération' },
          { status: 500 }
        );
      }

      const enriched = JSON.parse(jsonMatch[0]);
      return NextResponse.json({ success: true, data: enriched });
    }

    return NextResponse.json(
      { success: false, message: 'Action invalide (suggest ou enrich)' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Erreur POST /api/vocabulaire/suggest:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
