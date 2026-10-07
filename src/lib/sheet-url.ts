/**
 * Convertit l'URL d'un Google Sheets en URL d'export CSV (méthode KitSchool) :
 * le Sheet doit être public (« Tous les utilisateurs disposant du lien »),
 * le serveur le télécharge sans identifiant Google.
 *
 * Renvoie null si l'URL ne désigne pas un Google Sheets — on ne télécharge
 * jamais une adresse arbitraire fournie par le client.
 *
 * Gotcha (KitSchool) : `gid=0` n'est PAS forcément le premier onglet. Sans gid
 * dans l'URL (lien du bouton « Partager »), on omet le paramètre et Google
 * exporte le premier onglet ; forcer `gid=0` fait répondre 400.
 */
export function toSheetExportUrl(rawUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  if (parsed.hostname !== 'docs.google.com') return null;

  const idMatch = parsed.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) return null;

  const gidMatch = rawUrl.match(/[#&?]gid=(\d+)/);
  const base = `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv`;
  return gidMatch ? `${base}&gid=${gidMatch[1]}` : base;
}
