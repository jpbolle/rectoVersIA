import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/api-auth';
import { appelerClaudeJson } from '@/lib/claude';

// POST { phrase, mots, niveau? } → le verdict de Claude sur la phrase écrite
// par l'élève avec son vocabulaire (exercice « Phrase avec le vocabulaire »
// de l'extension Daspalecte, action `verify_sentence` — même forme de
// réponse, prompt réécrit : le backend de l'extension n'a jamais été commité).

interface Verdict {
  sentenceValid: boolean;
  sentenceFeedback: string;
  correctedSentence: string | null;
  wordsFeedback: { word: string; correct: boolean; explanation: string }[];
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 });

  try {
    const body = await request.json();
    const phrase = typeof body?.phrase === 'string' ? body.phrase.trim().slice(0, 600) : '';
    const mots = Array.isArray(body?.mots) ? (body.mots as unknown[]).filter((m): m is string => typeof m === 'string').slice(0, 20) : [];
    const niveau = typeof body?.niveau === 'string' ? body.niveau : 'a2';
    if (!phrase || mots.length === 0) {
      return NextResponse.json({ success: false, message: 'phrase et mots requis' }, { status: 400 });
    }

    const { data } = await appelerClaudeJson<Verdict>({
      system: `Tu es professeur de français langue étrangère, bienveillant, pour un élève allophone de niveau ${niveau.toUpperCase()}. Tu corriges une phrase qu'il a écrite pour réemployer des mots de vocabulaire. Tu réponds UNIQUEMENT en JSON brut.`,
      user: `Phrase de l'élève : « ${phrase} »
Mots de vocabulaire qu'il devait employer (il peut les avoir transformés : pluriel, féminin, verbe dérivé…) : ${mots.map((m) => `« ${m} »`).join(', ')}.

1. Pour chaque mot de la liste, dis s'il est employé CORRECTEMENT dans la phrase (sens juste, forme acceptable pour le niveau). "explanation" : une phrase courte et simple, en français, qui explique pourquoi (ou comment corriger).
2. Juge la phrase entière : "sentenceValid" = vrai si elle est compréhensible et correcte pour ce niveau (une petite faute d'accent ou de majuscule ne la rend pas fausse). "sentenceFeedback" : une phrase d'encouragement ou d'explication, simple. "correctedSentence" : la phrase corrigée si elle est fausse, sinon null.

JSON : {"sentenceValid": true, "sentenceFeedback": "<texte>", "correctedSentence": null, "wordsFeedback": [{"word": "<mot>", "correct": true, "explanation": "<texte>"}]}`,
      maxTokens: 1500,
    });

    const verdict: Verdict = {
      sentenceValid: data?.sentenceValid === true,
      sentenceFeedback: typeof data?.sentenceFeedback === 'string' ? data.sentenceFeedback : '',
      correctedSentence: typeof data?.correctedSentence === 'string' ? data.correctedSentence : null,
      wordsFeedback: Array.isArray(data?.wordsFeedback)
        ? data.wordsFeedback.map((w) => ({
            word: String(w?.word ?? ''),
            correct: w?.correct === true,
            explanation: typeof w?.explanation === 'string' ? w.explanation : '',
          }))
        : [],
    };
    return NextResponse.json({ success: true, data: verdict });
  } catch (error) {
    console.error('Erreur POST /api/fle/verifier-phrase:', error);
    return NextResponse.json({ success: false, message: 'Vérification impossible' }, { status: 502 });
  }
}
