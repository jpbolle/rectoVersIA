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
      "type": "fill_in_blanks_dropdown",
      "title": "Exercice 2 : Complétez avec le bon mot",
      "instructions": "Choisissez le bon mot dans chaque menu déroulant.",
      "points": 5,
      "text": "Un texte cohérent de 4-5 phrases contenant des espaces numérotés {0}, {1}, {2}, etc. utilisant au moins 5 mots de la liste.",
      "blanks": [
        { "correctAnswer": "mot_juste", "options": ["mot_juste", "distracteur1", "distracteur2", "distracteur3"] }
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
3. L'exercice 2 (fill_in_blanks_dropdown) : texte avec {0}, {1}, {2}... et pour chaque blanc, 3-4 options dont la bonne réponse. Utiliser au moins 5 mots de la liste.
4. Pour l'exercice 4 : EXACTEMENT 2 mots différents et UNE contrainte
5. JSON valide uniquement, aucun texte supplémentaire`;
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

// --- Prompt evaluation (interro complete — 2 exercices generes par IA) ---
function buildEvaluationPrompt(words: VocabulaireWord[], theme: string): string {
  const wordsList = words.map((w) => `${w.word} (syn: ${w.synonyms || '—'}, ant: ${w.antonyms || '—'})`);

  return `Tu es un professeur de français pour des élèves de 15 ans. Crée 2 exercices d'évaluation sur le thème "${theme}".

MOTS À UTILISER (avec synonymes/antonymes connus) :
${wordsList.join('\n')}

EXERCICE 1 — TEXTE AVEC MOTS À REMPLACER :
Rédige un texte narratif cohérent de 150-200 mots adapté à des adolescents de 15 ans.
Dans ce texte, intègre des mots de la liste (minimum 6, maximum 10).
Certains devront être remplacés par un SYNONYME (marqués {syn:mot}), d'autres par un ANTONYME (marqués {ant:mot}).
Mélange environ 50/50 synonymes et antonymes.
IMPORTANT : pour chaque mot marqué, fournis PLUSIEURS réponses acceptées (synonymes ou antonymes selon le cas).
RÈGLE CRUCIALE POUR LES ANTONYMES : quand tu marques un mot {ant:mot}, le remplacement par un antonyme DOIT rester cohérent et grammaticalement correct dans la phrase. L'élève doit pouvoir substituer l'antonyme et obtenir une phrase qui a du sens (même si le sens est inversé). Par exemple, si la phrase dit "Ce paysage est {ant:magnifique}", les antonymes "laid", "horrible" doivent fonctionner dans la phrase. Ne choisis JAMAIS un mot à remplacer par un antonyme si le remplacement produit une phrase absurde ou incohérente.

EXERCICE 2 — COMPOSITION :
Invente un sujet de rédaction lié au thème "${theme}" adapté à des ados de 15 ans.
Choisis 5 mots de la liste que l'élève devra utiliser dans son texte.
Donne une contrainte d'écriture claire (nombre de lignes, type de texte, etc.).

FORMAT JSON EXACT :
{
  "exercises": [
    {
      "type": "synonym_antonym_text",
      "title": "Activité 2 : Remplace par un synonyme ou un antonyme",
      "instructions": "Dans le texte ci-dessous, certains mots sont encadrés en couleur. Clique sur chaque mot encadré et remplace-le : en AMBRE → par un synonyme, en BLEU → par un antonyme.",
      "text": "Texte avec des balises {syn:mot} et {ant:mot} intégrées naturellement.",
      "replacements": [
        { "original": "mot", "type": "synonym", "acceptedAnswers": ["synonyme1", "synonyme2"] },
        { "original": "mot2", "type": "antonym", "acceptedAnswers": ["antonyme1", "antonyme2"] }
      ]
    },
    {
      "type": "evaluation_composition",
      "title": "Activité 3 : Rédaction",
      "instructions": "Rédige un texte en utilisant les mots imposés ci-dessous.",
      "theme": "Un thème précis lié à ${theme}",
      "requiredWords": ["mot1", "mot2", "mot3", "mot4", "mot5"],
      "constraint": "Contrainte d'écriture claire (ex: 10-15 lignes, texte argumentatif, etc.)"
    }
  ]
}

RÈGLES CRITIQUES :
- Le texte de l'exercice 1 doit être NATUREL et FLUIDE — les mots marqués doivent s'intégrer parfaitement
- Pour les acceptedAnswers, sois GÉNÉREUX : inclus toutes les formes valides (ex: pour remplacer "beau" par un antonyme, accepter "laid", "vilain", "horrible", "moche", etc.)
- L'exercice 2 doit être stimulant pour des ados (pas de sujet ennuyeux)
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
    const { words, mode, themes, spacedWords, compositionText, requiredWords, compositionTheme, synAntChecks } = body as {
      words: VocabulaireWord[];
      mode: 'apprentissage' | 'diagnostic' | 'evaluation' | 'evaluate_composition' | 'validate_syn_ant';
      themes?: string[];
      spacedWords?: VocabulaireWord[];
      compositionText?: string;
      requiredWords?: string[];
      compositionTheme?: string;
      // Pour mode validate_syn_ant
      synAntChecks?: { original: string; type: 'synonym' | 'antonym'; userAnswer: string }[];
    };

    // Mode validation synonymes/antonymes par Claude
    if (mode === 'validate_syn_ant') {
      if (!synAntChecks || synAntChecks.length === 0) {
        return NextResponse.json({ success: true, data: { results: [] } });
      }

      const checkList = synAntChecks.map((c) =>
        `- "${c.userAnswer}" est-il un ${c.type === 'synonym' ? 'SYNONYME' : 'ANTONYME'} valide de "${c.original}" ?`
      ).join('\n');

      const synAntPrompt = `Tu es un expert en langue française. Pour chaque paire ci-dessous, indique si la réponse de l'élève est un synonyme/antonyme valide du mot original.
Sois TOLÉRANT : accepte les formes dérivées, les registres différents (familier, soutenu), les mots proches en sens.

${checkList}

FORMAT JSON EXACT :
{
  "results": [
    { "original": "mot", "userAnswer": "reponse", "valid": true }
  ]
}

RÈGLE : JSON valide uniquement, aucun texte supplémentaire.`;

      const synAntResponse = await client.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1000,
        messages: [{ role: 'user', content: synAntPrompt }],
      });

      const synAntBlock = synAntResponse.content.find((b) => b.type === 'text');
      if (!synAntBlock || synAntBlock.type !== 'text') {
        return NextResponse.json({ success: true, data: { results: [] } });
      }

      const synAntParsed = JSON.parse(cleanJsonResponse(synAntBlock.text));
      return NextResponse.json({ success: true, data: synAntParsed, mode });
    }

    // Mode correction composition (pas besoin de words)
    if (mode === 'evaluate_composition') {
      if (!compositionText || !requiredWords || requiredWords.length === 0) {
        return NextResponse.json(
          { success: false, message: 'compositionText et requiredWords requis' },
          { status: 400 }
        );
      }
      const evalPrompt = `Tu es un professeur de français qui évalue l'emploi du vocabulaire dans le texte d'un élève de 15 ans.

MOTS IMPOSÉS que l'élève devait utiliser dans son texte : ${requiredWords.join(', ')}

TEXTE DE L'ÉLÈVE :
"""
${compositionText}
"""

OBJECTIF UNIQUE DE CETTE CORRECTION :
Vérifier que l'élève a utilisé les mots imposés de manière PERTINENTE et COHÉRENTE dans son texte.
Ce n'est PAS un exercice d'écriture créative ni de rédaction — on ne juge PAS la qualité littéraire, l'originalité, le respect du thème ou la structure du texte.
On évalue UNIQUEMENT :
- Est-ce que chaque mot imposé est présent ?
- Est-ce que chaque mot est employé dans un contexte qui a du sens (pas juste "collé" dans une phrase absurde) ?

TOLÉRANCE MORPHOLOGIQUE :
Accepte TOUTES les formes dérivées du mot ! Si le mot imposé est "beau", les formes suivantes sont TOUTES VALIDES : "belle", "beauté", "embellir", "bellement", "beaux", etc.
De même pour les conjugaisons, les pluriels, les féminins, les formes adverbiales, adjectivales, verbales ou nominales.
Ne sois PAS rigide sur la forme exacte du mot.

NOTATION sur 10 :
- 2 points par mot correctement utilisé (trouvé ET employé de façon pertinente)
- Si un mot est trouvé mais employé de manière absurde/incohérente : 0 point pour ce mot
- Maximum ${requiredWords.length * 2} points, ramenés sur 10

FORMAT JSON EXACT :
{
  "wordsUsed": [
    { "word": "mot_imposé", "found": true, "form": "forme_trouvée_dans_le_texte" }
  ],
  "qualityScore": 8,
  "feedback": "Commentaire bienveillant de 2-3 phrases sur l'emploi des mots (pertinence, cohérence du contexte). Ne PAS commenter la qualité littéraire."
}

RÈGLE : JSON valide uniquement, aucun texte supplémentaire.`;

      const evalResponse = await client.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1500,
        messages: [{ role: 'user', content: evalPrompt }],
      });

      const evalBlock = evalResponse.content.find((b) => b.type === 'text');
      if (!evalBlock || evalBlock.type !== 'text') {
        return NextResponse.json(
          { success: false, message: 'Pas de reponse textuelle de Claude' },
          { status: 500 }
        );
      }

      const evalParsed = JSON.parse(cleanJsonResponse(evalBlock.text));
      return NextResponse.json({ success: true, data: evalParsed, mode });
    }

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
        maxTokens = 6000;
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
