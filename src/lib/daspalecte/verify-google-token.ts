/**
 * SERVEUR UNIQUEMENT.
 *
 * Vérification d'un jeton d'accès Google présenté par un client qui ne peut pas
 * embarquer le SDK Firebase : l'extension Daspalecte (chrome.identity) et, plus
 * tard, son module complémentaire Apps Script (ScriptApp.getOAuthToken()).
 * Porté tel quel depuis daspa-app.
 *
 * Règle : l'audience est vérifiée contre une LISTE de clients OAuth autorisés
 * (variable ALLOWED_AUDIENCES), jamais contre un identifiant en dur.
 */

const TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';

export interface VerifiedGoogleUser {
  sub: string;
  email: string;
  audience: string;
}

export type VerifyResult =
  | { ok: true; user: VerifiedGoogleUser }
  | { ok: false; reason: 'missing' | 'invalid' | 'audience' | 'unverified' };

interface TokenInfo {
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: string | boolean;
  expires_in?: string;
}

// Petit cache mémoire : l'extension envoie ses événements par lots rapprochés
const cache = new Map<string, { user: VerifiedGoogleUser; expiresAt: number }>();
const MAX_CACHE_MS = 5 * 60 * 1000;

function allowedAudiences(): string[] {
  return (process.env.ALLOWED_AUDIENCES ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export async function verifyGoogleAccessToken(
  authorization: string | null
): Promise<VerifyResult> {
  const token = authorization?.replace(/^Bearer\s+/i, '').trim();
  if (!token) return { ok: false, reason: 'missing' };

  const cached = cache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return { ok: true, user: cached.user };
  }

  const response = await fetch(
    `${TOKENINFO_URL}?access_token=${encodeURIComponent(token)}`,
    { cache: 'no-store' }
  );
  if (!response.ok) return { ok: false, reason: 'invalid' };

  const info = (await response.json()) as TokenInfo;
  if (!info.sub || !info.email) return { ok: false, reason: 'invalid' };
  if (info.email_verified === 'false' || info.email_verified === false) {
    return { ok: false, reason: 'unverified' };
  }
  if (!info.aud || !allowedAudiences().includes(info.aud)) {
    return { ok: false, reason: 'audience' };
  }

  const user: VerifiedGoogleUser = {
    sub: info.sub,
    email: info.email.toLowerCase(),
    audience: info.aud,
  };

  const ttl = Math.min(MAX_CACHE_MS, Math.max(0, Number(info.expires_in ?? 0) * 1000));
  if (ttl > 0) {
    cache.set(token, { user, expiresAt: Date.now() + ttl });
    if (cache.size > 500) {
      const now = Date.now();
      for (const [key, entry] of cache) {
        if (entry.expiresAt <= now) cache.delete(key);
      }
    }
  }

  return { ok: true, user };
}
