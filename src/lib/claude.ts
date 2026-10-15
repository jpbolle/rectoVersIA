// ═══ Appels Claude — helper commun (2026-10-08) ═══
//
// SERVEUR UNIQUEMENT (clé `CLAUDE_API_KEY`). Né avec la lecture de cours FLE :
// jusque-là, huit routes instanciaient chacune leur client, sans mise en cache
// du préfixe, sans lecture de l'usage, avec un nettoyage du JSON recopié
// trois fois. Les routes existantes ne sont PAS migrées (hors chantier) ; le
// neuf passe par ici.
//
// Modèle : `claude-sonnet-5-5` pour le neuf (décision JP du 2026-10-08) — les
// routes antérieures restent sur `claude-sonnet-4-5-20250929`. Depuis le
// 2026-10-12 (décision JP), un appel peut demander `MODELE_RAPIDE` (Haiku 5.5,
// 20× moins cher) pour les tâches simples : transcription, résumé, repérage.
// La répartition de la lecture de cours vit dans sa route des sections.
//
// GESTION DES COÛTS (2026-10-15) : TOUT appel Claude de l'app passe par un
// `SuiviIa` (`suivreIa(...)`), qui note la consommation dans `consommationIa`
// et refuse l'appel si l'IA de l'activité a été coupée. Voir consommation-ia.ts.

import Anthropic from '@anthropic-ai/sdk';
import type { NextRequest } from 'next/server';
import type { UsageClaude } from '@/types/lecture-cours';
import {
  IaSuspendueError,
  estSuspendue,
  marquerEchec,
  messageErreur,
  noterAppel,
} from '@/lib/consommation-ia';
import type { ContexteIa, TraceAppel } from '@/lib/consommation-ia';
import type { JetonsIa } from '@/lib/tarifs-ia';

export const MODELE_CLAUDE = 'claude-sonnet-5-5';
export const MODELE_RAPIDE = 'claude-haiku-5-5';

let client: Anthropic | null = null;

function clientClaude(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
  return client;
}

// ═══ Suivi de la consommation ═══

const AUCUN_JETON: JetonsIa = { in: 0, out: 0, cacheRead: 0, cacheWrite: 0 };

/** Champs d'usage de l'API (SDK ou réponse brute d'un `fetch`) */
interface UsageApi {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

function jetonsDe(u: UsageApi | null | undefined): JetonsIa {
  return {
    in: u?.input_tokens ?? 0,
    out: u?.output_tokens ?? 0,
    cacheRead: u?.cache_read_input_tokens ?? 0,
    cacheWrite: u?.cache_creation_input_tokens ?? 0,
  };
}

/**
 * Le suivi d'une requête : un par appel de route. Note chaque appel Claude
 * (réussi ou raté) et, si la route juge ensuite la réponse inutilisable,
 * `echec(e)` repasse la dernière ligne en erreur — l'appel a été facturé.
 */
export class SuiviIa {
  private derniere: TraceAppel | null = null;

  constructor(readonly contexte: ContexteIa) {}

  /** Lève `IaSuspendueError` si l'IA de l'activité est coupée */
  async verifierAutorise(): Promise<void> {
    if (this.contexte.devoirId && (await estSuspendue(this.contexte.devoirId))) {
      throw new IaSuspendueError();
    }
  }

  /** `client.messages.create`, tracé */
  async creer(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> {
    await this.verifierAutorise();
    const debut = Date.now();
    try {
      const message = await clientClaude().messages.create(params);
      this.derniere = noterAppel({
        contexte: this.contexte,
        modele: message.model,
        jetons: jetonsDe(message.usage),
        statut: 'ok',
        dureeMs: Date.now() - debut,
      });
      return message;
    } catch (e) {
      this.derniere = noterAppel({
        contexte: this.contexte,
        modele: params.model,
        jetons: AUCUN_JETON,
        statut: 'erreur',
        erreur: messageErreur(e),
        dureeMs: Date.now() - debut,
      });
      throw e;
    }
  }

  /** Pour un appel fait par `fetch` (NavigKid) : noter la réponse reçue */
  noter(modele: string, usage: UsageApi | null | undefined, dureeMs: number, erreur?: string): void {
    this.derniere = noterAppel({
      contexte: this.contexte,
      modele,
      jetons: jetonsDe(usage),
      statut: erreur ? 'erreur' : 'ok',
      erreur: erreur ?? null,
      dureeMs,
    });
  }

  /** La dernière réponse s'est révélée inutilisable (JSON cassé, refus…) */
  echec(e: unknown): void {
    if (this.derniere) marquerEchec(this.derniere, e);
  }
}

const ACTIVITE_VALIDE = /^[\w-]{1,128}$/;

/**
 * Crée le suivi d'une route. L'activité vient d'abord de `devoirId` (quand la
 * route la connaît), sinon de l'en-tête `X-Activite` que le client ajoute
 * quand une page d'activité est ouverte (src/lib/activite-courante.ts).
 */
export function suivreIa(
  fonction: string,
  request: NextRequest | Request | null,
  auth: { uid: string; role: string } | null,
  devoirId?: string | null
): SuiviIa {
  const enTete = request?.headers.get('x-activite') ?? null;
  const activite = devoirId || (enTete && ACTIVITE_VALIDE.test(enTete) ? enTete : null);
  return new SuiviIa({ fonction, uid: auth?.uid ?? null, role: auth?.role ?? null, devoirId: activite });
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
  /** Par défaut `MODELE_CLAUDE` ; `MODELE_RAPIDE` pour une tâche simple */
  modele?: string;
  /** Le suivi de la route (gestion des coûts) — obligatoire */
  suivi: SuiviIa;
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
  const message = await appel.suivi.creer({
    model: appel.modele ?? MODELE_CLAUDE,
    max_tokens: appel.maxTokens ?? 8000,
    system,
    messages: [{ role: 'user', content: appel.user }],
  });

  if (message.stop_reason === 'refusal') {
    const e = new Error('Le modèle a refusé de traiter ce contenu.');
    appel.suivi.echec(e);
    throw e;
  }
  if (message.stop_reason === 'max_tokens') {
    const e = new Error('Réponse trop longue, coupée avant la fin.');
    appel.suivi.echec(e);
    throw e;
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
  } catch (e) {
    appel.suivi.echec(e);
    throw new Error('Réponse du modèle illisible (JSON attendu).');
  }
}
