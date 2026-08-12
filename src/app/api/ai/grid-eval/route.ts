import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import Anthropic from '@anthropic-ai/sdk';
import { LEVEL_LABELS, LEVEL_PERCENTAGES } from '@/types/grille';
import { planHasContent, planToMarkdown } from '@/lib/draft-utils';
import type { Grille, GrilleCriterion } from '@/types/grille';
import type { AiGridResult, AiGridCriterionResult } from '@/types/ai-grid';
import type { CorrigeReference, DevoirRessource } from '@/types/devoir';
import type { DraftContent } from '@/types/travail';

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

  // Vérifier que le devoir autorise l'IA (et garder ses données pour le prompt)
  let devoirData: FirebaseFirestore.DocumentData;
  try {
    const devoirDoc = await adminDb.collection('devoirs').doc(devoirId).get();
    if (!devoirDoc.exists) {
      return NextResponse.json({ error: 'Devoir non trouvé' }, { status: 404 });
    }
    devoirData = devoirDoc.data()!;
    if (!devoirData.accesIA) {
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

  // ── Matériaux de référence fournis par le prof (texte-source + corrigé) ──
  // Valables pour toutes les activités d'écriture : texte-source, plan de
  // référence, production de référence — l'IA compare la copie de l'élève à eux.
  // Chaque bloc est soumis à son toggle « corrigé IA » (défaut : activé).
  // Ressources : seuls le texte (onglet Texte) et les images sont transmis —
  // jamais les PDF (trop de tokens) ni les liens (l'IA ne navigue pas).
  const ressource = devoirData.ressources as DevoirRessource | null;
  const sendRessources = devoirData.ressourcesToIA === true;
  const sourceText = sendRessources
    ? stripHtml(ressource?.document || '') || stripHtml(ressource?.content || '')
    : '';
  const corrigeRef = (devoirData.corrigeReference || null) as CorrigeReference | null;
  // Plan de référence = thème/thèse éventuel + plan hiérarchisé
  let planProf = '';
  if (corrigeRef?.planToIA === true) {
    const themeLine = corrigeRef.theme?.trim() ? `Thème ou thèse : ${corrigeRef.theme.trim()}` : '';
    const planText = corrigeRef.plan && planHasContent(corrigeRef.plan) ? planToMarkdown(corrigeRef.plan) : '';
    planProf = [themeLine, planText].filter(Boolean).join('\n');
  }
  const productionProf = corrigeRef?.productionToIA === true
    ? corrigeRef?.production?.trim() || ''
    : '';

  // Images-sources : lues depuis Firestore (collection ressourceImages,
  // base64 déjà prêt) et jointes au message (max 3)
  const MAX_IMAGES = 3;
  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
  type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];
  const imageBlocks: { type: 'image'; source: { type: 'base64'; media_type: AllowedImageType; data: string } }[] = [];
  if (sendRessources && ressource?.files?.length) {
    const imageFiles = ressource.files
      .filter((f) => f.fileId && ALLOWED_IMAGE_TYPES.includes(f.mimeType as AllowedImageType))
      .slice(0, MAX_IMAGES);
    for (const file of imageFiles) {
      try {
        const imageDoc = await adminDb.collection('ressourceImages').doc(file.fileId!).get();
        const base64 = imageDoc.data()?.data as string | undefined;
        if (!base64) continue;
        imageBlocks.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: file.mimeType as AllowedImageType,
            data: base64,
          },
        });
      } catch (err) {
        console.error(`Image-source non lisible (${file.name}):`, err);
      }
    }
  }

  let referenceBlocks = '';
  if (sourceText) {
    referenceBlocks += `\nTEXTE-SOURCE (document de départ fourni par le professeur) :\n${sourceText}\n`;
  }
  if (imageBlocks.length > 0) {
    referenceBlocks += `\nIMAGES-SOURCES : ${imageBlocks.length} image(s) fournie(s) par le professeur en pièce jointe de ce message (document de départ de la production).\n`;
  }
  if (planProf) {
    referenceBlocks += `\nPLAN DE RÉFÉRENCE DU PROFESSEUR (corrigé — hiérarchie des idées attendue) :\n${planProf}\n`;
  }
  if (productionProf) {
    referenceBlocks += `\nPRODUCTION DE RÉFÉRENCE DU PROFESSEUR (corrigé — version attendue) :\n${productionProf}\n`;
  }

  // Plan rédigé par l'élève (verso de son espace de travail), s'il existe
  let planEleve = '';
  try {
    const travailDoc = await adminDb.collection('travaux').doc(travailId).get();
    const draft = travailDoc.data()?.draftContent as DraftContent | null | undefined;
    if (draft?.type === 'plan' && planHasContent(draft.plan)) {
      planEleve = planToMarkdown(draft.plan!);
    }
  } catch (err) {
    console.error('Erreur chargement plan élève:', err);
  }

  const hasCorrige = !!(planProf || productionProf);
  const consignesExtra = hasCorrige
    ? `\n8. CORRIGÉ DE RÉFÉRENCE : compare la copie${planEleve ? ' et le plan' : ''} de l'élève au corrigé du professeur — idées essentielles retenues ou manquantes, hiérarchie respectée, fidélité au texte-source. Appuie tes justifications sur cette comparaison, sans jamais recopier le corrigé dans tes réponses.`
    : '';

  // Formater la grille et construire le prompt utilisateur — sans les critères
  // masqués pour ce devoir ; le mapping des résultats plus bas doit utiliser le
  // même tableau (l'IA répond par index de critère)
  const hiddenCriteria = new Set<string>(
    Array.isArray(devoirData.hiddenCriteria) ? devoirData.hiddenCriteria : []
  );
  const activeCriteria = grille.criteria.filter((c) => !hiddenCriteria.has(c.id));
  const grilleFormatee = formatGrilleForAI(activeCriteria);
  const userPrompt = `GRILLE DE CORRECTION :

CRITÈRES À ÉVALUER :
${grilleFormatee}
${referenceBlocks ? `\nMATÉRIAUX DE RÉFÉRENCE :\n${referenceBlocks}` : ''}${planEleve ? `\nPLAN RÉDIGÉ PAR L'ÉLÈVE (brouillon, à comparer au plan de référence) :\n${planEleve}\n` : ''}
COPIE DE L'ÉLÈVE À CORRIGER :
${textContent}

CONSIGNES :
1. Corrige cette copie selon la grille fournie avec EXIGENCE
2. Si le texte fait moins de 5 lignes → "Insuffisant" (15%) pour tous les critères de contenu/structure/développement
3. Si le texte fait 5-10 lignes → "Suffisant" (35%) maximum pour le contenu/structure
4. ORTHOGRAPHE : Même 3-4 fautes = "Suffisant" (35%) max. Beaucoup de fautes = "Insuffisant" (15%)
5. Évalue TOUS les critères sans exception
6. Sois HONNÊTE dans le commentaire final : ne complimente pas un travail insuffisant
7. JUSTIFICATION : Ne répète PAS l'indicateur ! Explique POURQUOI tu as choisi cet indicateur en citant des éléments concrets du texte, et dis ce qu'il faudrait pour atteindre le niveau supérieur${consignesExtra}

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
        // Les images-sources éventuelles précèdent le texte du prompt
        content: imageBlocks.length > 0
          ? [...imageBlocks, { type: 'text' as const, text: userPrompt }]
          : userPrompt,
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

    activeCriteria.forEach((criterion, index) => {
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
