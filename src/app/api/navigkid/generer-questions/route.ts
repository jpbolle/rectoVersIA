import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }
  if (auth.role !== 'prof') {
    return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
  }

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Cle API Claude non configuree.' }, { status: 500 });
  }

  const { themes, titre, niveau } = await request.json();
  if (!themes || themes.length === 0) {
    return NextResponse.json({ error: 'Aucun theme fourni.' }, { status: 400 });
  }

  const themesStr = themes.join(', ');

  const prompt = `Tu es un enseignant expert en pédagogie de la recherche documentaire. Génère 5 questions de recherche pour des élèves.

TITRE DU QUESTIONNAIRE : "${titre || ''}"
THÈME(S) : "${themesStr}"
${niveau ? `NIVEAU : ${niveau}` : ''}

Le titre exprime le sujet précis du questionnaire. Les thèmes sont des catégories générales. Base-toi prioritairement sur le titre pour cibler les questions, et utilise les thèmes comme contexte complémentaire.

PUBLIC CIBLE :
- Élèves de 15 ans (3e / seconde). Adapte le vocabulaire, la longueur et la complexité en conséquence
- Les questions doivent être stimulantes mais accessibles : pas de jargon universitaire, pas de formulations trop simples non plus
- Vise un niveau de réflexion adapté à des adolescents qui apprennent à chercher et à argumenter

LANGUE ET STYLE :
- Toutes les questions doivent être rédigées en français correct et naturel
- N'insère PAS les thèmes mécaniquement dans chaque question (pas de "sur [thème1, thème2]"). Reformule intelligemment pour que les questions soient fluides et naturelles
- Chaque question doit se lire comme si un vrai enseignant l'avait écrite à la main

CONTEXTE DE L'OUTIL :
L'élève utilise une extension Chrome. Pour chaque question, il doit :
1. Chercher sur le web et collecter le nombre de sources demandé
2. Surligner/souligner dans chaque source les passages qui justifient sa réponse
3. Répondre (texte libre ou QCM) en s'appuyant sur ces extraits

RÈGLES POUR LES QUESTIONS :
- Quand la question demande de retrouver une information factuelle, de prouver un choix QCM ou de citer des données précises, l'énoncé DOIT demander à l'élève de surligner dans ses sources les passages qui justifient sa réponse
- En revanche, pour une question de synthèse personnelle, d'opinion argumentée ou de comparaison libre, ne pas imposer de surlignage — c'est la qualité du raisonnement qui compte
- Adapte la consigne de surlignage au cas par cas selon la nature de chaque question
- Varie les types : 3-4 questions ouvertes ("texte") et 1-2 QCM ("qcm")
- Pour les QCM, propose 3 ou 4 options pertinentes et réalistes, et indique les bonnes réponses dans le champ "correctes" (tableau d'indices, commence à 0). Plusieurs bonnes réponses sont possibles
- Indique combien de sources web l'élève doit collecter (champ "nbSources" : 1 à 3)
- Indique le type de réponse attendu (champ "type" : "texte" ou "qcm")
- Les questions doivent évaluer la capacité de l'élève à TROUVER des sites pertinents et fiables, puis à REPÉRER dans ces sites l'information qui répond à la question
- Ne PAS évaluer la capacité d'argumentation personnelle de l'élève. L'objectif est la recherche documentaire, pas la dissertation
- Adapte le vocabulaire et la difficulté au contexte scolaire

Pour CHAQUE question, fournis aussi :
- "reponseAttendue" : la réponse correcte ou les éléments de réponse attendus (pour le prof, pas visible par l'élève). Pour les questions ouvertes, décris les points clés que l'élève devrait mentionner.
- "referencesProf" : 1 à 3 URLs de sites web fiables et pertinents où l'on peut trouver la réponse (sites institutionnels, encyclopédies, articles de presse reconnus). Ces URLs servent de référence au professeur.

Réponds en JSON strict (pas de markdown, pas de commentaires) :
[
  {
    "texte": "Énoncé de la question",
    "type": "texte",
    "nbSources": 1,
    "reponseAttendue": "Éléments de réponse attendus...",
    "referencesProf": ["https://exemple.org/article"]
  },
  {
    "texte": "Énoncé QCM",
    "type": "qcm",
    "options": ["option A", "option B", "option C"],
    "correctes": [0],
    "nbSources": 1,
    "reponseAttendue": "L'option A est correcte car...",
    "referencesProf": ["https://exemple.org/article"]
  }
]`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Erreur Claude API:', errText);
      return NextResponse.json({ error: 'Erreur API Claude.' }, { status: 502 });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Reponse IA non interpretable.' }, { status: 500 });
    }

    const questions = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ questions });
  } catch (err) {
    console.error('Erreur generation questions:', err);
    return NextResponse.json({ error: 'Erreur reseau.' }, { status: 500 });
  }
}
