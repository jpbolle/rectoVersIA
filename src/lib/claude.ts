// ═══ Appels Claude — helper commun (2026-10-08) ═══
//
// SERVEUR UNIQUEMENT (clé `CLAUDE_API_KEY`). Né avec la lecture de cours FLE :
// jusque-là, huit routes instanciaient chacune leur client, sans mise en cache
// du préfixe, sans lecture de l'usage, avec un nettoyage du JSON recopié
// trois fois. Les routes existantes ne sont PAS migrées (hors chantier) ; le
// neuf passe par ici.
//
// Modèle : `claude-sonnet-5-5` pour le neuf (décision JP du 2026-10-08) — les
// routes antérieures restent sur `claude-sonnet-4-5-20250929`.

import Anthropic from '@anthropic-ai/sdk';
import type { UsageClaude } from '@/types/lecture-cours';

export const MODELE_CLAUDE = 'claude-sonnet-5-5';

let client: Anthropic | null = null;

function clientClaude(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
  return client;
}

/** Enlève une clôture ``` éventuelle autour d'un JSON renvoyé par le modèle. */
export function nettoyerJson(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.split('\n').slice(1).join('\n');
    if (cleaned.endsWith('```')) cleaned = cleaned.substring(0, cleaned.lastIndexOf('```'));
    cleaned = cleaned.trim();
  }
  // Un préambule bavard avant l'accolade : on coupe au premier { ou [
  const debut = Math.min(
    ...['{', '['].map((c) => cleaned.indexOf(c)).filter((i) => i >= 0)
  );
  if (Number.isFinite(debut) && debut > 0) cleaned = cleaned.slice(debut);
  return cleaned;
}

export interface AppelClaude {
  /** Préambule stable (règles, niveau) */
  system: string;
  /**
   * Contexte long et répété d'un appel à l'autre (le texte du cours) : mis en
   * CACHE côté API — facturé ~10 % dès la deuxième section. Doit venir après
   * `system` et rester identique à l'octet près.
   */
  contexteCache?: string;
  /** La consigne de l'appel, ou un contenu riche (PDF + consigne) */
  user: string | Anthropic.ContentBlockParam[];
  maxTokens?: number;
}

export interface ReponseClaude {
  texte: string;
  usage: UsageClaude;
}

function usageDe(message: Anthropic.Message): UsageClaude {
  const u = message.usage as Anthropic.Usage & {
    cache_read_input_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
  };
  return {
    in: u.input_tokens ?? 0,
    out: u.output_tokens ?? 0,
    cacheRead: u.cache_read_input_tokens ?? 0,
    cacheWrite: u.cache_creation_input_tokens ?? 0,
    modele: message.model,
  };
}

/** Un appel, texte brut en retour. Lève une erreur lisible en cas de refus. */
export async function appelerClaude(appel: AppelClaude): Promise<ReponseClaude> {
  const system: Anthropic.TextBlockParam[] = [{ type: 'text', text: appel.system }];
  if (appel.contexteCache) {
    system.push({ type: 'text', text: appel.contexteCache, cache_control: { type: 'ephemeral' } });
  }
  const message = await clientClaude().messages.create({
    model: MODELE_CLAUDE,
    max_tokens: appel.maxTokens ?? 8000,
    system,
    messages: [{ role: 'user', content: appel.user }],
  });

  if (message.stop_reason === 'refusal') {
    throw new Error('Le modèle a refusé de traiter ce contenu.');
  }
  if (message.stop_reason === 'max_tokens') {
    throw new Error('Réponse trop longue, coupée avant la fin.');
  }
  const texte = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
  return { texte, usage: usageDe(message) };
}

/** Un appel dont on attend du JSON ; parsé, ou erreur lisible. */
export async function appelerClaudeJson<T>(appel: AppelClaude): Promise<{ data: T; usage: UsageClaude }> {
  const { texte, usage } = await appelerClaude(appel);
  try {
    return { data: JSON.parse(nettoyerJson(texte)) as T, usage };
  } catch {
    throw new Error('Réponse du modèle illisible (JSON attendu).');
  }
}
