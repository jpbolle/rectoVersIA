import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/api-auth';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { text, requiredWords, constraint } = body as {
      text: string;
      requiredWords: string[];
      constraint: string;
    };

    if (!text || !requiredWords || requiredWords.length < 2 || !constraint) {
      return NextResponse.json(
        { success: false, message: 'Parametres requis : text, requiredWords (2+), constraint' },
        { status: 400 }
      );
    }

    const prompt = `Tu es un professeur de français bienveillant qui évalue la production d'un élève de 15 ans.

L'élève devait écrire une phrase en utilisant ces 2 mots : "${requiredWords[0]}" et "${requiredWords[1]}"
La contrainte créative était : "${constraint}"

Phrase de l'élève : "${text}"

Évalue cette phrase et réponds UNIQUEMENT au format JSON suivant :
{
  "isValid": true ou false,
  "wordsUsedCorrectly": true ou false,
  "constraintRespected": true ou false,
  "sentenceMakesSense": true ou false,
  "feedback": "Un message encourageant et constructif pour l'élève (2-3 phrases max)"
}

REGLES :
- wordsUsedCorrectly : les 2 mots sont présents ET utilisés avec leur sens correct
- constraintRespected : la phrase respecte la contrainte créative demandée
- sentenceMakesSense : la phrase est grammaticalement correcte et a du sens
- isValid : true SEULEMENT si les 3 critères ci-dessus sont vrais
- feedback : toujours bienveillant, encourager même si c'est incorrect
- JSON valide uniquement`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json(
        { success: false, message: 'Pas de reponse textuelle de Claude' },
        { status: 500 }
      );
    }

    let cleaned = textBlock.text.trim();
    if (cleaned.includes('```json')) {
      cleaned = cleaned.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    }

    const parsed = JSON.parse(cleaned);

    return NextResponse.json({ success: true, data: parsed });
  } catch (error) {
    console.error('Erreur POST /api/vocabulaire/validate:', error);
    return NextResponse.json({
      success: true,
      data: {
        isValid: false,
        wordsUsedCorrectly: true,
        constraintRespected: false,
        sentenceMakesSense: true,
        feedback: "Désolé, je n'ai pas pu évaluer ta phrase. Vérifie qu'elle contient bien les deux mots demandés et qu'elle respecte la contrainte.",
      },
    });
  }
}
