// Import d'une PAGE WEB — SERVEUR UNIQUEMENT.
//
// Pas de bibliothèque : on retire les blocs sans contenu (scripts, menus,
// pieds de page), on transforme les fins de blocs en retours à la ligne, on
// ôte les balises. Claude relit ensuite ce texte brut : un reste de menu ne le
// gêne pas, une bibliothèque de plus gênerait le projet (consigne durable).

const TAILLE_MAX = 2 * 1024 * 1024;

// Garde SSRF : le serveur ne va chercher que des adresses publiques en http(s)
function adresseAutorisee(url: URL): boolean {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  const h = url.hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const [a, b] = h.split('.').map(Number);
    if (a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) {
      return false;
    }
    if (a === 169 && b === 254) return false;
  }
  if (h.includes(':')) return false; // IPv6 littérale
  return true;
}

function decoderEntites(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

export function htmlVersTexte(html: string): { titre: string; texte: string } {
  const titre = decoderEntites(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim();
  let s = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript|svg|nav|header|footer|aside|form|iframe)[\s\S]*?<\/\1>/gi, '');
  // Le contenu principal, s'il est balisé, suffit
  const main = s.match(/<(article|main)[\s\S]*?<\/\1>/i)?.[0];
  if (main) s = main;
  s = s
    .replace(/<(br|hr)\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|blockquote|pre)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' ');
  s = decoderEntites(s)
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { titre, texte: s };
}

export async function textePageWeb(rawUrl: string): Promise<{ titre: string; texte: string; url: string }> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error('Adresse invalide.');
  }
  if (!adresseAutorisee(url)) throw new Error('Cette adresse ne peut pas être lue.');

  const res = await fetch(url.toString(), {
    redirect: 'follow',
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RectoVerso lecture de cours)' },
  });
  if (!res.ok) throw new Error(`La page ne répond pas (${res.status}).`);
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('html') && !contentType.includes('text/plain')) {
    throw new Error('Cette adresse n’est pas une page de texte.');
  }
  const brut = await res.text();
  if (brut.length > TAILLE_MAX) throw new Error('Page trop lourde.');
  if (contentType.includes('text/plain')) return { titre: '', texte: brut.trim(), url: url.toString() };
  const { titre, texte } = htmlVersTexte(brut);
  return { titre, texte, url: url.toString() };
}
