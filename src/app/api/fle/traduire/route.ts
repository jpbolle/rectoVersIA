import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/api-auth';
import { appelerClaude } from '@/lib/claude';
import { estLangueConnue, langueLabel } from '@/types/niveaux-fle';

// POST { texte, langue } → { traduction }
//
// La traduction au clic d'un mot, comme dans l'extension Daspalecte : le
// point d'accès NON OFFICIEL de Google Translate (sans clé, celui que
// l'extension appelle depuis la page), appelé ici côté serveur ; s'il cesse
// de répondre, Claude prend le relais. Petit cache mémoire : un mot cliqué
// deux fois ne coûte qu'un appel.

const cache = new Map<string, string>();
const TEXTE_MAX = 120;

async function google(texte: string, langue: string): Promise<string | null> {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=fr&tl=${encodeURIComponent(langue)}&dt=t&q=${encodeURIComponent(texte)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    // data[0] = segments, chacun [traduction, original, …]
    const segments = Array.isArray(data) && Array.isArray(data[0]) ? (data[0] as unknown[]) : [];
    const traduction = segments
      .map((s) => (Array.isArray(s) && typeof s[0] === 'string' ? s[0] : ''))
      .join('')
      .trim();
    return traduction || null;
  } catch {
    return null;
  }
}

async function claude(texte: string, langue: string): Promise<string> {
  const { texte: reponse } = await appelerClaude({
    system: langue
      ? 'Tu es un dictionnaire bilingue. Tu réponds par la traduction seule, sans explication ni ponctuation.'
      : 'Tu expliques un mot français à un élève débutant : une définition de trois à huit mots très simples, sans ponctuation finale.',
    user: langue
      ? `Traduis en ${langueLabel(langue)} (code ${langue}) ce mot ou cette expression du français : « ${texte} »`
      : `Explique très simplement : « ${texte} »`,
    maxTokens: 60,
  });
  return reponse.trim().replace(/^[«"']|[»"'.]$/g, '').trim();
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 });

  try {
    const body = await request.json();
    const texte = typeof body?.texte === 'string' ? body.texte.trim().slice(0, TEXTE_MAX) : '';
    // Langue inconnue ('' ou absente) : Claude donne une définition simple en français
    const langue = estLangueConnue(body?.langue) ? body.langue : '';
    if (!texte) {
      return NextResponse.json({ success: false, message: 'texte requis' }, { status: 400 });
    }
    const cle = `${langue || 'fr'}:${texte.toLowerCase()}`;
    let traduction = cache.get(cle);
    if (!traduction) {
      traduction = (langue ? await google(texte, langue) : null) ?? (await claude(texte, langue));
      if (cache.size > 5000) cache.clear();
      cache.set(cle, traduction);
    }
    return NextResponse.json({ success: true, data: { traduction } });
  } catch (error) {
    console.error('Erreur POST /api/fle/traduire:', error);
    return NextResponse.json({ success: false, message: 'Traduction impossible' }, { status: 500 });
  }
}
