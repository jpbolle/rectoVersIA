import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/api-auth';
import Anthropic from '@anthropic-ai/sdk';
import type { VocabulaireWord } from '@/types/vocabulaire';

const client = new Anthropic();

// --- Prompt apprentissage (5 exercices) ---
function buildApprentissagePrompt(words: VocabulaireWord[], themes: string[]): string {
  const themesText = themes.join(', ');
  const wordsList = words.map((w) => w.word);
  const constraints = [
    'Ta phrase doit parler de ton quotidien',
    'Ta phrase doit être une question',
    'Ta phrase doit contenir une émotion',
    'Ta phrase doit faire rire',
    'Ta phrase doit donner un conseil',
    'Ta phrase doit décrire un lieu',
    'Ta phrase doit raconter un souvenir',
  ];

  return `Tu es un professeur de français expérimenté. Tu DOIS créer une séquence pédagogique pour élèves de 15 ans.

CONTRAINTE ABSOLUE : Tu DOIS utiliser EXACTEMENT ces ${wordsList.length} mots dans l'exercice 1 : ${wordsList.join(', ')}

AUCUN mot ne doit être oublié. TOUS les ${wordsList.length} mots DOIVENT apparaître dans le texte ET dans highlighted_words.

Génère une réponse au format JSON suivant:
{
  "title": "Apprentissage du vocabulaire : ${themesText}",
  "exercises": [
    {
      "type": "text_with_definitions",
      "title": "Exercice 1 : Texte informatif avec définitions",
      "instructions": "Lisez le texte et survolez les mots soulignés pour voir leur définition",
      "text": "Un texte informatif de 250-300 mots contenant TOUS les mots.",
      "highlighted_words": [
        ${words.map((w) => `{ "word": "${w.word}", "definition": "${w.definition}" }`).join(',\n        ')}
      ]
    },
    {
      "type": "drag_and_drop",
      "title": "Exercice 2 : Associez les mots à leur définition",
      "instructions": "Glissez chaque mot vers sa définition correspondante",
      "words": [${wordsList.map((w) => `"${w}"`).join(', ')}],
      "definitions": [
        ${words.map((w, i) => `{ "id": ${i + 1}, "definition": "${w.definition}", "correct_word": "${w.word}" }`).join(',\n        ')}
      ],
      "distractors": [
        { "definition": "Définition fausse mais plausible 1", "correct_term": "terme_1" },
        { "definition": "Définition fausse mais plausible 2", "correct_term": "terme_2" },
        { "definition": "Définition fausse mais plausible 3", "correct_term": "terme_3" }
      ]
    },
    {
      "type": "word_families",
      "title": "Exercice 3 : Familles de mots et relations",
      "instructions": "Explorez les liens entre les mots : familles, synonymes et antonymes",
      "word_schemas": [
        ${wordsList.slice(0, Math.min(3, wordsList.length)).map((w) => `{ "central_word": "${w}", "family_branch": ["..."], "synonyms_branch": ["..."], "antonyms_branch": ["..."] }`).join(',\n        ')}
      ]
    },
    {
      "type": "fill_in_blanks",
      "title": "Exercice 4 : Complétez le texte",
      "instructions": "Tapez les mots manquants dans les espaces vides",
      "text_with_blanks": "Texte avec espaces à combler...",
      "answers": ["réponses..."]
    },
    {
      "type": "production_challenge",
      "title": "Exercice 5 : Défi de production personnelle",
      "instructions": "Écris une phrase originale en utilisant les 2 mots imposés",
      "selected_words": ["Choisis 2 mots parmi : ${wordsList.join(', ')}"],
      "constraint": "Choisis UNE contrainte parmi : ${constraints.join(' | ')}"
    }
  ]
}

REGLES :
1. L'exercice 1 DOIT contenir les ${wordsList.length} mots : ${wordsList.join(', ')}
2. TOUS les mots DOIVENT être dans highlighted_words
3. Pour l'exercice 5 : EXACTEMENT 2 mots différents et UNE contrainte
4. JSON valide uniquement, aucun texte supplémentaire`;
}

// --- Prompt diagnostic (3 exercices) ---
function buildDiagnosticPrompt(words: VocabulaireWord[], theme: string): string {
  const wordsList = words.map((w) => w.word);

  return `Tu es un professeur de français expert en évaluation. Crée un diagnostic de vocabulaire pour ces mots du thème "${theme}":

Mots disponibles: ${wordsList.join(', ')}

Génère une évaluation au format JSON avec exactement ces 3 exercices :

1. DÉFINITIONS-TERMES (5 questions, 3 points) :
   - 5 définitions à associer à 5 termes choisis parmi 15 termes proposés
   - Les 15 termes incluent les 5 bons + 10 distracteurs plausibles

2. SYNONYMES (3 questions, 4 points) :
   - 3 paires de synonymes à reconstituer
   - 20 étiquettes au total (6 mots corrects + 14 distracteurs)

3. ANTONYMES (2 questions, 3 points) :
   - 2 paires d'antonymes à former
   - 20 étiquettes au total (4 mots corrects + 16 distracteurs)

FORMAT JSON EXACT :
{
  "title": "Diagnostic de vocabulaire - ${theme}",
  "totalPoints": 10,
  "exercises": [
    {
      "type": "definitions",
      "title": "Exercice 1 : Associez chaque définition au bon terme (3 points)",
      "instructions": "Glissez chaque terme vers sa définition correspondante",
      "points": 3,
      "definitions": [
        { "id": 1, "definition": "...", "correctTerm": "mot_correct" }
      ],
      "terms": ["terme1", "terme2", "...15 termes..."],
      "answers": [
        { "definitionId": 1, "correctTerm": "mot_correct" }
      ]
    },
    {
      "type": "synonyms",
      "title": "Exercice 2 : Trouvez les paires de synonymes (4 points)",
      "instructions": "Associez les mots qui ont des sens similaires",
      "points": 4,
      "words": ["...20 étiquettes..."],
      "answers": [
        { "pair": ["mot1", "synonyme1"] }
      ]
    },
    {
      "type": "antonyms",
      "title": "Exercice 3 : Trouvez les paires d'antonymes (3 points)",
      "instructions": "Associez les mots qui ont des sens opposés",
      "points": 3,
      "words": ["...20 étiquettes..."],
      "answers": [
        { "pair": ["mot1", "antonyme1"] }
      ]
    }
  ]
}

REGLES :
- Définitions précises et sans ambiguïté
- Distracteurs plausibles mais incorrects
- Synonymes et antonymes authentiques
- JSON valide uniquement, aucun texte supplémentaire`;
}

// --- Nettoyage JSON ---
function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();
  if (cleaned.includes('```json')) {
    cleaned = cleaned.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  } else if (cleaned.includes('```')) {
    cleaned = cleaned.replace(/```\s*/g, '').trim();
  }
  return cleaned;
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { words, mode, themes } = body as {
      words: VocabulaireWord[];
      mode: 'apprentissage' | 'diagnostic';
      themes?: string[];
    };

    if (!words || !Array.isArray(words) || words.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Parametre "words" requis (tableau de mots)' },
        { status: 400 }
      );
    }

    const prompt =
      mode === 'diagnostic'
        ? buildDiagnosticPrompt(words, themes?.[0] || 'vocabulaire')
        : buildApprentissagePrompt(words, themes || ['vocabulaire']);

    const maxTokens = mode === 'diagnostic' ? 3000 : 4500;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json(
        { success: false, message: 'Pas de reponse textuelle de Claude' },
        { status: 500 }
      );
    }

    const cleaned = cleanJsonResponse(textBlock.text);
    const parsed = JSON.parse(cleaned);

    return NextResponse.json({
      success: true,
      data: parsed,
      mode,
    });
  } catch (error) {
    console.error('Erreur POST /api/vocabulaire/generate:', error);
    return NextResponse.json(
      { success: false, message: 'Erreur lors de la generation des exercices' },
      { status: 500 }
    );
  }
}
