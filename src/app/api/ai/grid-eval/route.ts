import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import Anthropic from '@anthropic-ai/sdk';
import { LEVEL_LABELS, LEVEL_PERCENTAGES } from '@/types/grille';
import type { Grille, GrilleCriterion } from '@/types/grille';
import type { AiGridResult, AiGridCriterionResult } from '@/types/ai-grid';

// ── Mapping pourcentage → level ──

const PERCENTAGE_TO_LEVEL: Record<number, number> = {};
for (const [level, pct] of Object.entries(LEVEL_PERCENTAGES)) {
  PERCENTAGE_TO_LEVEL[pct] = Number(level);
}

function percentageToLevel(pct: number): number {
  // Exact match
  if (PERCENTAGE_TO_LEVEL[pct] !== undefined) return PERCENTAGE_TO_LEVEL[pct];
  // Closest match
  let closest = 0;
  let minDiff = Infinity;
  for (const [p, l] of Object.entries(PERCENTAGE_TO_LEVEL)) {
    const diff = Math.abs(Number(p) - pct);
    if (diff < minDiff) {
      minDiff = diff;
      closest = l;
    }
  }
  return closest;
}

// ── Formater la grille pour Claude (adapté de formaterGrillePourIA) ──

function formatGrilleForAI(criteria: GrilleCriterion[]): string {
  let text = '';

  criteria.forEach((criterion, index) => {
    text += `\nCRITÈRE ${index} : "${criterion.name}" (Maximum: ${criterion.weight} points)\n`;
    text += 'Indicateurs disponibles :\n';

    criterion.levels.forEach((level) => {
      const pct = LEVEL_PERCENTAGES[level.level] ?? 0;
      const label = LEVEL_LABELS[level.level] ?? 'Inconnu';
      const pts = ((criterion.weight * pct) / 100).toFixed(1);
      const indicators = level.indicators.filter(i => i && i.trim() !== '');

      if (indicators.length > 0) {
        text += `  - "${indicators.join(' ; ')}" (${label} - ${pct}% = ${pts} pts)\n`;
      } else {
        text += `  - ${label} (${pct}% = ${pts} pts)\n`;
      }
    });

    text += '\n';
  });

  return text;
}

// ── Prompt système ──

const SYSTEM_PROMPT = `Tu es un correcteur pédagogique EXIGEANT mais juste, qui évalue les productions d'élèves de 15 ans. Adapte ton vocabulaire à leur niveau : phrases simples, pas de jargon grammatical compliqué.

PRINCIPE FONDAMENTAL : Évalue le texte TEL QU'IL EST, pas ce qu'il pourrait devenir. Ne complimente JAMAIS un travail qui ne le mérite pas. Un texte court, incomplet ou bâclé doit recevoir des notes basses.

RÈGLES DE SÉVÉRITÉ :
- Un texte de moins de 5 lignes est FORCÉMENT "Insuffisant" (15% max) pour TOUS les critères liés au contenu, à la structure et au développement des idées
- Un texte de 5 à 10 lignes ne peut PAS dépasser "Suffisant" (35%) sur les critères de contenu/structure
- Seuls les textes suffisamment développés (15+ lignes) PEUVENT prétendre aux niveaux "Acquis" ou "Parfaitement acquis"
- Ne cherche PAS à être gentil : un mauvais texte mérite des notes basses, c'est la seule façon d'aider l'élève à progresser

ORTHOGRAPHE / PONCTUATION / GRAMMAIRE :
- Sois TRÈS sévère : même 3-4 fautes doivent limiter à "Suffisant" (35%) maximum sur les critères linguistiques
- Une copie avec beaucoup de fautes → "Insuffisant" (15%) obligatoire
- Seule une copie quasiment sans faute peut atteindre "Acquis" (60%+)

CONSIGNES :
- Respecte scrupuleusement la grille de correction fournie
- Tu DOIS évaluer TOUS les critères présents dans la grille, sans exception
- N'oublie aucun critère
- Si le texte est trop court pour évaluer un critère correctement, donne "Insuffisant" et explique pourquoi

JUSTIFICATION (TRÈS IMPORTANT) :
- La justification NE DOIT PAS répéter ou reformuler l'indicateur choisi
- La justification doit expliquer POURQUOI tu as choisi cet indicateur plutôt qu'un autre
- Appuie-toi sur des éléments CONCRETS du texte de l'élève : cite des passages, relève des erreurs précises, pointe ce qui manque
- Explique ce que l'élève aurait dû faire pour obtenir un meilleur niveau
- Exemple de MAUVAISE justification : "L'élève structure son texte de manière insuffisante" (ça répète l'indicateur)
- Exemple de BONNE justification : "Ton texte ne comporte que 2 phrases sans aucun paragraphe. Pour atteindre le niveau supérieur, il faudrait organiser tes idées en au moins 2-3 paragraphes avec une introduction et une conclusion."

FORMAT DE RÉPONSE :
Réponds UNIQUEMENT en JSON brut, sans balises markdown, sans \`\`\`json.
Commence directement par { et termine par }.

Structure JSON exacte :
{
  "corrections": {
    "0": {
      "indicateur": "Texte exact de l'indicateur choisi",
      "pourcentage": 15,
      "justification": "Pourquoi cet indicateur ? Qu'est-ce qui dans le texte justifie ce choix ? Que faudrait-il pour faire mieux ?"
    },
    "1": {
      "indicateur": "Texte exact de l'indicateur choisi",
      "pourcentage": 35,
      "justification": "Pourquoi cet indicateur ? Qu'est-ce qui dans le texte justifie ce choix ? Que faudrait-il pour faire mieux ?"
    }
  },
  "commentaire_final": "Bilan honnête : points forts s'il y en a, faiblesses principales, et pistes concrètes d'amélioration"
}

Les clés de "corrections" correspondent aux index des critères (0, 1, 2...).`;

// ── Helpers ──

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
}

function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.split('\n').slice(1).join('\n');
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.substring(0, cleaned.lastIndexOf('```'));
    }
    cleaned = cleaned.trim();
  }
  return cleaned;
}

// ── GET : Récupérer une évaluation existante ──

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
    const docId = `AIGRID-${travailId}`;
    const doc = await adminDb.collection('aiGridEvaluations').doc(docId).get();

    if (!doc.exists) {
      return NextResponse.json({ success: true, data: null });
    }

    return NextResponse.json({ success: true, data: doc.data() as AiGridResult });
  } catch (err) {
    console.error('Erreur GET aiGridEvaluations:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// ── POST : Demander une évaluation IA de la grille ──

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  if (auth.role !== 'eleve') {
    return NextResponse.json({ error: 'Réservé aux élèves' }, { status: 403 });
  }

  let body: { travailId: string; devoirId: string; grilleId: string; content: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const { travailId, devoirId, grilleId, content } = body;

  if (!travailId || !devoirId || !grilleId || !content) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
  }

  // Vérifier que le contenu n'est pas vide
  const textContent = stripHtml(content);
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

  // Vérifier idempotence
  const docId = `AIGRID-${travailId}`;
  try {
    const existingDoc = await adminDb.collection('aiGridEvaluations').doc(docId).get();
    if (existingDoc.exists) {
      return NextResponse.json({ success: true, data: existingDoc.data() });
    }
  } catch (err) {
    console.error('Erreur vérification existant:', err);
  }

  // Charger la grille (par ID, puis fallback par nom)
  let grille: Grille;
  try {
    let grilleDoc = await adminDb.collection('grilles').doc(grilleId).get();
    if (!grilleDoc.exists) {
      // Fallback : chercher par nom
      const snapshot = await adminDb
        .collection('grilles')
        .where('name', '==', grilleId)
        .limit(1)
        .get();
      if (snapshot.empty) {
        return NextResponse.json({ error: 'Grille non trouvée' }, { status: 404 });
      }
      grilleDoc = snapshot.docs[0];
    }
    grille = grilleDoc.data() as Grille;
    // S'assurer que l'ID est correct
    if (!grille.id) grille.id = grilleDoc.id;
  } catch (err) {
    console.error('Erreur chargement grille:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }

  if (!grille.criteria || grille.criteria.length === 0) {
    return NextResponse.json({ error: 'La grille ne contient aucun critère' }, { status: 400 });
  }

  // Formater la grille et construire le prompt utilisateur
  const grilleFormatee = formatGrilleForAI(grille.criteria);
  const userPrompt = `GRILLE DE CORRECTION :

CRITÈRES À ÉVALUER :
${grilleFormatee}

COPIE DE L'ÉLÈVE À CORRIGER :
${textContent}

CONSIGNES :
1. Corrige cette copie selon la grille fournie avec EXIGENCE
2. Si le texte fait moins de 5 lignes → "Insuffisant" (15%) pour tous les critères de contenu/structure/développement
3. Si le texte fait 5-10 lignes → "Suffisant" (35%) maximum pour le contenu/structure
4. ORTHOGRAPHE : Même 3-4 fautes = "Suffisant" (35%) max. Beaucoup de fautes = "Insuffisant" (15%)
5. Évalue TOUS les critères sans exception
6. Sois HONNÊTE dans le commentaire final : ne complimente pas un travail insuffisant
7. JUSTIFICATION : Ne répète PAS l'indicateur ! Explique POURQUOI tu as choisi cet indicateur en citant des éléments concrets du texte, et dis ce qu'il faudrait pour atteindre le niveau supérieur

RAPPEL FORMAT : JSON brut uniquement. Commence par { et termine par }.`;

  // Appeler Claude API
  try {
    const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: userPrompt,
      }],
    });

    // Extraire le texte de la réponse
    const responseText = message.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('');

    // Parser la réponse JSON
    const cleaned = cleanJsonResponse(responseText);
    let parsed: {
      corrections: Record<string, {
        indicateur: string;
        pourcentage: number;
        justification: string;
      }>;
      commentaire_final: string;
    };

    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback : chercher un objet JSON dans le texte
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        console.error('Impossible de parser la réponse Claude:', cleaned.substring(0, 200));
        return NextResponse.json({ error: "Erreur de format dans la réponse IA" }, { status: 500 });
      }
    }

    if (!parsed.corrections) {
      return NextResponse.json({ error: "Réponse IA invalide" }, { status: 500 });
    }

    // Mapper vers AiGridCriterionResult[]
    const criteriaResults: AiGridCriterionResult[] = [];

    grille.criteria.forEach((criterion, index) => {
      const correction = parsed.corrections[String(index)];
      if (correction) {
        const level = percentageToLevel(correction.pourcentage);
        criteriaResults.push({
          criterionIndex: index,
          criterionId: criterion.id,
          selectedLevel: level,
          selectedPercentage: correction.pourcentage,
          indicateur: correction.indicateur || '',
          justification: correction.justification || '',
        });
      }
    });

    // Construire le document Firestore
    const aiGridResult: AiGridResult = {
      id: docId,
      travailId,
      devoirId,
      studentId: auth.uid,
      grilleId: grille.id,
      criteria: criteriaResults,
      commentaireFinal: parsed.commentaire_final || '',
      textSnapshot: content,
      createdAt: new Date().toISOString(),
    };

    // Sauvegarder dans Firestore
    await adminDb.collection('aiGridEvaluations').doc(docId).set(aiGridResult);

    return NextResponse.json({ success: true, data: aiGridResult });

  } catch (err) {
    console.error('Erreur appel Claude API:', err);
    return NextResponse.json(
      { error: "Erreur lors de l'évaluation IA. Veuillez réessayer." },
      { status: 500 }
    );
  }
}
