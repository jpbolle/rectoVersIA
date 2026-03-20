import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  }

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Cle API non configuree.' }, { status: 500 });
  }

  const { questionnaireId, questionsData: passedQuestionsData } = await request.json();
  if (!questionnaireId) {
    return NextResponse.json({ error: 'questionnaireId requis.' }, { status: 400 });
  }

  try {
    // Charger le questionnaire
    const qDoc = await adminDb.collection('questionnaires').doc(questionnaireId).get();
    if (!qDoc.exists) {
      return NextResponse.json({ error: 'Questionnaire introuvable.' }, { status: 404 });
    }
    const questionnaire = qDoc.data()!;

    // Vérifier accesIA via le devoir lié
    if (questionnaire.devoirId) {
      const devoirDoc = await adminDb.collection('devoirs').doc(questionnaire.devoirId).get();
      if (devoirDoc.exists && !devoirDoc.data()?.accesIA) {
        return NextResponse.json({ error: 'Aide IA non activee pour cette activite.' }, { status: 403 });
      }
    }

    // Construire le contexte pour Claude
    // Priorité : données passées directement par l'extension (état courant avant soumission)
    // Fallback : lire depuis Firestore (réponses déjà soumises)
    const questions = questionnaire.questions || [];
    let reponses: ReponseEleve[] = [];

    if (passedQuestionsData && Array.isArray(passedQuestionsData) && passedQuestionsData.length > 0) {
      reponses = passedQuestionsData;
    } else {
      const rDoc = await adminDb
        .collection('questionnaires')
        .doc(questionnaireId)
        .collection('reponses')
        .doc(auth.uid)
        .get();
      reponses = rDoc.exists ? (rDoc.data()?.questions || []) : [];
    }

    // Les motsCles sont déjà dans reponses — pas besoin de charger recherches séparément
    const recherches: RechercheParQuestion[] = [];

    const prompt = buildPrompt(questions, reponses, recherches);

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

    // Parser le JSON de la réponse
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ feedback: text });
    }

    const feedback = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ success: true, feedback });
  } catch (err) {
    console.error('Erreur aide-ia:', err);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}

interface QuestionDef {
  texte: string;
  type: 'texte' | 'qcm';
  options?: string[];
  correctes?: number[];
  nbSources: number;
  reponseAttendue?: string;
}

interface MotCle {
  texte: string;
  timestamp: number;
}

interface SiteConsulte {
  url: string;
  titre: string;
  pertinence: boolean;
  fiabilite: number;
  tempsPasse: number;
}

interface Passage {
  texte: string;
  url: string;
}

interface ReponseEleve {
  questionIndex: number;
  reponse: string;
  motsCles: MotCle[];
  sitesConsultes: SiteConsulte[];
  passages?: Passage[];
}

interface RechercheParQuestion {
  questionIndex: number;
  requetes: MotCle[];
  clics: { url: string; titre: string; timestamp: number; tempsPasse?: number }[];
}

function buildPrompt(
  questions: QuestionDef[],
  reponses: ReponseEleve[],
  recherches: RechercheParQuestion[]
): string {
  let contexte = '';

  questions.forEach((q, idx) => {
    const rep = reponses.find((r) => r.questionIndex === idx);
    const rech = recherches.find((r) => r.questionIndex === idx);

    contexte += `\n--- QUESTION ${idx + 1} (${q.type.toUpperCase()}) ---\n`;
    contexte += `Énoncé : ${q.texte}\n`;
    if (q.type === 'qcm' && q.options) {
      contexte += `Options : ${q.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join(' | ')}\n`;
      if (q.correctes) {
        contexte += `Bonne(s) réponse(s) : ${q.correctes.map((c) => String.fromCharCode(65 + c)).join(', ')}\n`;
      }
    }
    if (q.reponseAttendue) {
      contexte += `Réponse attendue (prof) : ${q.reponseAttendue}\n`;
    }
    contexte += `Sources requises : ${q.nbSources}\n`;

    // Mots-clés de recherche
    const motsCles = rech?.requetes || rep?.motsCles || [];
    if (motsCles.length > 0) {
      contexte += `Mots-clés recherchés : ${motsCles.map((m) => m.texte).join(', ')}\n`;
    } else {
      contexte += `Mots-clés recherchés : aucun\n`;
    }

    // Sites consultés
    const sites = rep?.sitesConsultes || [];
    if (sites.length > 0) {
      contexte += `Sites consultés :\n`;
      sites.forEach((s, i) => {
        contexte += `  ${i + 1}. ${s.titre} (${s.url})\n`;
        contexte += `     Marqué pertinent : ${s.pertinence ? 'oui' : 'non'} | Fiabilité : ${s.fiabilite}/5\n`;
      });
    }

    // Passages surlignés
    const passages = rep?.passages || [];
    if (passages.length > 0) {
      contexte += `Passages surlignés :\n`;
      passages.forEach((p, i) => {
        contexte += `  ${i + 1}. « ${p.texte} » (source : ${p.url})\n`;
      });
    }

    // Réponse de l'élève
    if (rep?.reponse) {
      contexte += `Réponse de l'élève : ${rep.reponse}\n`;
    } else {
      contexte += `Réponse de l'élève : (pas encore répondu)\n`;
    }
  });

  return `Tu es un assistant pédagogique pour un élève de 15 ans qui fait une recherche documentaire sur le web. Analyse son travail et donne un feedback CONCIS, DIRECT et CONCRET. Pas de formules de politesse, pas de verbosité. Va droit au but.

DONNÉES DE L'ÉLÈVE :
${contexte}

ANALYSE DEMANDÉE — Réponds en JSON strict avec cette structure :

{
  "motsCles": {
    "verdict": "bon|moyen|insuffisant",
    "feedback": "1-2 phrases max. Dire si les termes sont pertinents. Suggérer des reformulations concrètes si nécessaire."
  },
  "questions": [
    {
      "numero": 1,
      "type": "qcm|texte",
      "sources": {
        "pertinence": "1-2 phrases. Les sites marqués pertinents le sont-ils vraiment par rapport à la question ?",
        "fiabilite": "1-2 phrases. Les notes de fiabilité sont-elles justifiées ? (institutionnel vs blog, etc.)"
      },
      "passages": "1-2 phrases. Les passages surlignés prouvent-ils la réponse ? Manque-t-il un extrait clé ?",
      "reponse": "Pour QCM : la réponse est-elle correcte ? Les passages prouvent-ils ce choix ? Pour texte : 2-3 phrases comparant à la réponse attendue. Quels points manquent ?",
      "conseil": "1 phrase d'action concrète pour améliorer."
    }
  ]
}

RÈGLES :
- Concis. Pas de blabla. Chaque feedback = 1-2 phrases max.
- Pour les QCM : vérifier que les passages surlignés PROUVENT la bonne réponse.
- Pour les questions ouvertes : comparer à la réponse attendue, vérifier sources + passages + réponse.
- Pour les mots-clés : suggérer des termes alternatifs concrets, pas des conseils vagues.
- Si l'élève n'a pas encore répondu à une question, le signaler brièvement.
- Langue : français.`;
}
