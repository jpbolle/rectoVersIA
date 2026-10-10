// Vidéos intégrables : YouTube et fichiers Google Drive.
// `parseYoutubeId` extrait l'identifiant d'une vidéo YouTube depuis les formats
// d'URL courants (watch, youtu.be, shorts, embed, live). Renvoie null si l'URL
// n'est pas une vidéo YouTube reconnaissable.

const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export function parseYoutubeId(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\.|^m\./, '');

  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0];
    return YOUTUBE_ID_PATTERN.test(id) ? id : null;
  }

  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const v = url.searchParams.get('v');
    if (v && YOUTUBE_ID_PATTERN.test(v)) return v;
    const match = url.pathname.match(/^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})/);
    if (match) return match[1];
  }

  return null;
}

// URL d'intégration sans cookies de pistage (variante « privacy-enhanced »)
export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}

// Identifiant d'un fichier Google Drive, depuis un lien de partage
// (…/file/d/ID/view, …/file/d/ID/preview, …/open?id=ID, …/uc?id=ID).
// Renvoie null si l'URL n'est pas un fichier Drive reconnaissable.
export function parseDriveFileId(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  if (url.hostname !== 'drive.google.com') return null;

  const match = url.pathname.match(/^\/file\/d\/([\w-]{10,})/);
  if (match) return match[1];
  const id = url.searchParams.get('id');
  return id && /^[\w-]{10,}$/.test(id) ? id : null;
}

// Adresse du lecteur intégré pour une vidéo YouTube OU Drive.
// Drive : seul le format `/preview` s'affiche dans un cadre ; le fichier doit
// être partagé avec les élèves (domaine de l'école ou « toute personne
// disposant du lien »), sinon le cadre affiche « demander l'accès ».
export function videoEmbedUrl(rawUrl: string): string | null {
  const youtubeId = parseYoutubeId(rawUrl);
  if (youtubeId) return youtubeEmbedUrl(youtubeId);
  const driveId = parseDriveFileId(rawUrl);
  if (driveId) return `https://drive.google.com/file/d/${driveId}/preview`;
  return null;
}
