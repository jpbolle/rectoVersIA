import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/api-auth';
import Anthropic from '@anthropic-ai/sdk';
import type { VocabulaireWord } from '@/types/vocabulaire';

const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

// --- Prompt apprentissage (4 exercices — word_families construit cote client) ---
function buildApprentissagePrompt(
  words: VocabulaireWord[],
  themes: string[],
  spacedWords: VocabulaireWord[]
): string {
  const themesText = themes.join(', ');
  const mainWords = words.map((w) => w.word);
  const spacedList = spacedWords.map((w) => w.word);
  const allWords = [...mainWords, ...spacedList];
  const constraints = [
    'Ta phrase doit parler de ton quotidien',
    'Ta phrase doit être une question',
    'Ta phrase doit contenir une émotion',
    'Ta phrase doit faire rire',
    'Ta phrase doit donner un conseil',
    'Ta phrase doit décrire un lieu',
    'Ta phrase doit raconter un souvenir',
  ];

  const spacedContext = spacedWords.length > 0
    ? `\n\nMOTS DE RÉVISION (espacement régulé) à intégrer dans les exercices : ${spacedList.join(', ')}`
    : '';

  return `Tu es un professeur de français expérimenté. Tu DOIS créer une séquence pédagogique pour élèves de 15 ans.

CONTRAINTE ABSOLUE : Tu DOIS utiliser EXACTEMENT ces ${allWords.length} mots dans l'exercice 1 : ${allWords.join(', ')}

Mots principaux à apprendre : ${mainWords.join(', ')}${spacedContext}

AUCUN mot ne doit être oublié. TOUS les ${allWords.length} mots DOIVENT apparaître dans le texte ET dans highlighted_words.

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
        ${[...words, ...spacedWords].map((w) => `{ "word": "${w.word}", "definition": "${w.definition}" }`).join(',\n        ')}
      ]
    },
    {
      "type": "drag_and_drop",
      "title": "Exercice 2 : Associez les mots à leur définition",
      "instructions": "Glissez chaque mot vers sa définition correspondante",
      "words": [${allWords.map((w) => `"${w}"`).join(', ')}],
      "definitions": [
        ${[...words, ...spacedWords].map((w, i) => `{ "id": ${i + 1}, "definition": "${w.definition}", "correct_word": "${w.word}" }`).join(',\n        ')}
      ],
      "distractors": [
        { "definition": "Définition fausse mais plausible 1", "correct_term": "terme_1" },
        { "definition": "Définition fausse mais plausible 2", "correct_term": "terme_2" },
        { "definition": "Définition fausse mais plausible 3", "correct_term": "terme_3" }
      ]
    },
    {
      "type": "fill_in_blanks",
      "title": "Exercice 3 : Complétez le texte",
      "instructions": "Tapez les mots manquants dans les espaces vides",
      "text_with_blanks": "Texte avec espaces à combler...",
      "answers": ["réponses..."]
    },
    {
      "type": "production_challenge",
      "title": "Exercice 4 : Défi de production personnelle",
      "instructions": "Écris une phrase originale en utilisant les 2 mots imposés",
      "selected_words": ["Choisis 2 mots parmi : ${allWords.join(', ')}"],
      "constraint": "Choisis UNE contrainte parmi : ${constraints.join(' | ')}"
    }
  ]
}

REGLES :
1. L'exercice 1 DOIT contenir les ${allWords.length} mots : ${allWords.join(', ')}
2. TOUS les mots DOIVENT être dans highlighted_words
3. Pour l'exercice 4 : EXACTEMENT 2 mots différents et UNE contrainte
4. JSON valide uniquement, aucun texte supplémentaire`;
}

// --- Prompt diagnostic (5 exercices diversifies) ---
function buildDiagnosticPrompt(words: VocabulaireWord[], theme: string): string {
  const wordsList = words.map((w) => w.word);
  const wordCount = Math.min(10, wordsList.length);

  return `Tu es un professeur de français expert en évaluation pour des élèves de 15 ans. Crée un diagnostic de vocabulaire pour ces mots du thème "${theme}":

Mots à tester: ${wordsList.join(', ')}

Génère une évaluation au format JSON avec exactement ces 5 exercices :

1. APPARIEMENT DÉFINITIONS (${wordCount} questions, 4 points) :
   - ${wordCount} mots à associer à ${wordCount} définitions
   - Proposer ${wordCount} termes et ${wordCount} définitions (pas de distracteurs, appariement 1-pour-1)
   - Utiliser un maximum de mots de la liste

2. SYNONYMES (4 paires, 3 points) :
   - L'élève doit trouver EXACTEMENT 4 paires de synonymes
   - Proposer 16 étiquettes au total (8 mots corrects formant 4 paires + 8 distracteurs)
   - IMPORTANT : identifier TOUTES les paires valides possibles dans les réponses (ex: si "rationnel" est proposé, "irrationnel" en est l'antonyme, pas un distracteur). Ne PAS mettre un mot et son contraire évident dans les distracteurs.

3. ANTONYMES (3 paires, 3 points) :
   - L'élève doit trouver EXACTEMENT 3 paires d'antonymes
   - Proposer 14 étiquettes au total (6 mots corrects formant 3 paires + 8 distracteurs)
   - IMPORTANT : même règle — ne jamais placer un antonyme évident d'un mot de la liste dans les distracteurs

4. TEXTE À TROUS AVEC CHOIX (5 points) :
   - Un texte cohérent de 4-5 phrases contenant des espaces numérotés {0}, {1}, {2}, etc.
   - Pour chaque espace, proposer 3-4 options (dont la bonne réponse)
   - Utiliser au moins 5 mots de la liste

5. EMPLOI EN CONTEXTE (5 points) :
   - 5 phrases utilisant chacune un mot de la liste
   - Certaines phrases utilisent le mot CORRECTEMENT, d'autres INCORRECTEMENT (sens détourné)
   - L'élève doit juger si l'emploi est correct ou non
   - Fournir une explication pour les emplois incorrects

FORMAT JSON EXACT :
{
  "title": "Diagnostic de vocabulaire - ${theme}",
  "totalPoints": 20,
  "exercises": [
    {
      "type": "definitions",
      "title": "Exercice 1 : Associez chaque mot à sa définition (4 points)",
      "instructions": "Associez chaque définition au terme correspondant. ${wordCount} associations à trouver.",
      "points": 4,
      "definitions": [
        { "id": 1, "definition": "définition claire", "correctTerm": "mot" }
      ],
      "terms": ["mot1", "mot2", "...${wordCount} termes..."],
      "answers": [
        { "definitionId": 1, "correctTerm": "mot" }
      ]
    },
    {
      "type": "synonyms",
      "title": "Exercice 2 : Trouvez les 4 paires de synonymes (3 points)",
      "instructions": "Sélectionnez deux mots pour former une paire de synonymes. Vous devez trouver 4 paires.",
      "points": 3,
      "words": ["...16 étiquettes..."],
      "answers": [
        { "pair": ["mot1", "synonyme1"] }
      ]
    },
    {
      "type": "antonyms",
      "title": "Exercice 3 : Trouvez les 3 paires d'antonymes (3 points)",
      "instructions": "Sélectionnez deux mots pour former une paire d'antonymes. Vous devez trouver 3 paires.",
      "points": 3,
      "words": ["...14 étiquettes..."],
      "answers": [
        { "pair": ["mot1", "antonyme1"] }
      ]
    },
    {
      "type": "fill_in_blanks_dropdown",
      "title": "Exercice 4 : Complétez le texte (5 points)",
      "instructions": "Choisissez le bon mot dans chaque menu déroulant.",
      "points": 5,
      "text": "Texte avec {0} des espaces {1} numérotés...",
      "blanks": [
        { "correctAnswer": "mot_juste", "options": ["mot_juste", "distracteur1", "distracteur2"] }
      ]
    },
    {
      "type": "context_sentences",
      "title": "Exercice 5 : L'emploi est-il correct ? (5 points)",
      "instructions": "Pour chaque phrase, indiquez si le mot entre crochets est utilisé avec le bon sens.",
      "points": 5,
      "sentences": [
        { "word": "mot", "sentence": "Phrase utilisant le mot.", "isCorrect": true, "explanation": "" },
        { "word": "mot2", "sentence": "Phrase avec mauvais usage.", "isCorrect": false, "explanation": "Explication du bon sens" }
      ]
    }
  ]
}

REGLES CRITIQUES :
- Définitions précises, pas d'ambiguïté
- Distracteurs plausibles mais JAMAIS un vrai synonyme/antonyme d'un mot de la liste
- Pour les synonymes/antonymes : TOUTES les associations valides doivent être dans answers (si plusieurs paires sont possibles, les inclure)
- Les phrases de l'exercice 5 : environ 2-3 correctes et 2-3 incorrectes, de manière aléatoire
- JSON valide uniquement, aucun texte supplémentaire`;
}

// --- Prompt evaluation (interro complete) ---
function buildEvaluationPrompt(words: VocabulaireWord[], theme: string): string {
  const wordsList = words.map((w) => w.word);

  return `Tu es un professeur de français. Crée une évaluation complète de vocabulaire (style interro) sur ces ${wordsList.length} mots du thème "${theme}":

Mots: ${wordsList.join(', ')}

Génère une évaluation au format JSON avec ces 4 exercices :

1. DÉFINITIONS (${Math.min(10, wordsList.length)} questions, 5 points) :
   - ${Math.min(10, wordsList.length)} définitions à associer aux bons termes
   - Proposer ${Math.min(20, wordsList.length + 10)} termes (bons + distracteurs)

2. SYNONYMES (5 questions, 5 points) :
   - 5 paires de synonymes à reconstituer
   - 20 étiquettes au total

3. ANTONYMES (4 questions, 5 points) :
   - 4 paires d'antonymes à former
   - 20 étiquettes au total

4. TEXTE À TROUS (5 points) :
   - Un texte cohérent avec ${Math.min(8, wordsList.length)} mots à replacer

FORMAT JSON EXACT :
{
  "title": "Évaluation de vocabulaire - ${theme}",
  "totalPoints": 20,
  "exercises": [
    {
      "type": "definitions",
      "title": "Exercice 1 : Associez chaque définition au bon terme (5 points)",
      "instructions": "Associez chaque définition à son terme",
      "points": 5,
      "definitions": [{ "id": 1, "definition": "...", "correctTerm": "..." }],
      "terms": ["..."],
      "answers": [{ "definitionId": 1, "correctTerm": "..." }]
    },
    {
      "type": "synonyms",
      "title": "Exercice 2 : Paires de synonymes (5 points)",
      "instructions": "Associez les mots qui ont des sens similaires",
      "points": 5,
      "words": ["..."],
      "answers": [{ "pair": ["mot", "synonyme"] }]
    },
    {
      "type": "antonyms",
      "title": "Exercice 3 : Paires d'antonymes (5 points)",
      "instructions": "Associez les mots qui ont des sens opposés",
      "points": 5,
      "words": ["..."],
      "answers": [{ "pair": ["mot", "antonyme"] }]
    },
    {
      "type": "fill_in_blanks",
      "title": "Exercice 4 : Complétez le texte (5 points)",
      "instructions": "Tapez les mots manquants",
      "points": 5,
      "text_with_blanks": "...",
      "answers": ["..."]
    }
  ]
}

REGLES :
- Évaluation exigeante mais juste
- Couvrir un maximum de mots de la liste
- Distracteurs plausibles
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
    const { words, mode, themes, spacedWords } = body as {
      words: VocabulaireWord[];
      mode: 'apprentissage' | 'diagnostic' | 'evaluation';
      themes?: string[];
      spacedWords?: VocabulaireWord[];
    };

    if (!words || !Array.isArray(words) || words.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Parametre "words" requis (tableau de mots)' },
        { status: 400 }
      );
    }

    let prompt: string;
    let maxTokens: number;

    switch (mode) {
      case 'diagnostic':
        prompt = buildDiagnosticPrompt(words, themes?.[0] || 'vocabulaire');
        maxTokens = 3000;
        break;
      case 'evaluation':
        prompt = buildEvaluationPrompt(words, themes?.[0] || 'vocabulaire');
        maxTokens = 4500;
        break;
      default:
        prompt = buildApprentissagePrompt(words, themes || ['vocabulaire'], spacedWords || []);
        maxTokens = 4500;
        break;
    }

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
