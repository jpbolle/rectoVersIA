// ═══ CONTENUS INTERACTIFS EMBARQUÉS ═══
//
// Une page tierce affichée dans un cadre : Genially, une frise TimelineJS, un
// StoryMap, un exerciseur LearningApps… Le mécanisme est né dans l'atelier
// « Lecture d'une œuvre » et sert aussi aux RESSOURCES d'une activité — d'où
// sa sortie de `types/oeuvre.ts` : il n'a rien d'une œuvre.
//
// ⚠️ UNE IFRAME EXÉCUTE DU CODE ÉTRANGER dans une page ouverte par des
// mineurs. D'où la liste blanche ci-dessous, HTTPS obligatoire, vérifiée
// CÔTÉ SERVEUR et pas seulement à l'écran — un contrôle qui ne vit que dans
// le navigateur ne contrôle rien.

export const DOMAINES_INTEGRATION = [
  'genially.com',
  'view.genially.com',
  'genial.ly',
  'app.genial.ly',
  // TimelineJS : l'URL d'intégration est servie par le CDN
  // (cdn.knightlab.com/libs/timeline3/latest/embed/…)
  'timeline.knightlab.com',
  'cdn.knightlab.com',
  'storymap.knightlab.com',
  'uploads.knightlab.com',
  // StoryMaps ArcGIS — l'ancien (arcgis.com) et le nouveau (storymaps.com)
  'storymaps.arcgis.com',
  'www.arcgis.com',
  'arcgis.com',
  'storymaps.com',
  'storymaps.esri.com',
  'sutori.com',
  'www.sutori.com',
  'learningapps.org',
  'wordwall.net',
  'padlet.com',
  'fr.padlet.com',
  'h5p.org',
  'thinglink.com',
  'www.thinglink.com',
  'framindmap.org',
  'digipad.app',
  'la-digitale.com',
  'docs.google.com',
  'drive.google.com',
];

/**
 * Ce que le prof colle, ramené à une URL.
 *
 * Le bouton « Partager / Intégrer » de Genially, d'ArcGIS ou de TimelineJS ne
 * donne pas une URL : il donne un bloc `<iframe src="…" …>`. C'est ce qu'on
 * colle naturellement — refuser ce collage obligerait à aller pêcher l'adresse
 * à la main dans le code, ce qui n'est pas un geste de prof.
 *
 * On en extrait donc le `src`. Rien d'autre du bloc n'est conservé : ni ses
 * attributs, ni son style, ni ce qui pourrait s'y cacher — c'est
 * `integrationAutorisee` qui décide ensuite si l'adresse est admise.
 */
export function urlDepuisIntegration(saisie: string): string {
  const brut = (saisie || '').trim();
  if (!brut) return '';
  if (!/<iframe/i.test(brut)) return brut;
  const m = brut.match(/<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/i);
  if (!m) return brut;
  // Un extrait copié depuis une page peut porter des entités HTML
  return m[1]
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * Les proportions annoncées par le code `<iframe>` collé.
 *
 * Genially, les frises et la plupart des exerciseurs livrent un `width` et un
 * `height` — parfois en pixels, parfois en pourcentage (`width="100%"`), qui
 * ne dit alors rien des proportions. On ne retient donc que les deux nombres
 * exploitables, et on renvoie `null` dès qu'il en manque un.
 */
export function proportionsDepuisIntegration(
  saisie: string
): { largeur: number; ratio: number } | null {
  const brut = (saisie || '').trim();
  if (!/<iframe/i.test(brut)) return null;
  const nombre = (attribut: string): number | null => {
    const m = brut.match(new RegExp(`\\s${attribut}\\s*=\\s*["']?\\s*(\\d+(?:\\.\\d+)?)\\s*(?:px)?\\s*["']`, 'i'));
    const v = m ? Number(m[1]) : NaN;
    return Number.isFinite(v) && v > 0 ? v : null;
  };
  const largeur = nombre('width');
  const hauteur = nombre('height');
  if (!largeur || !hauteur) return null;
  return { largeur: Math.round(largeur), ratio: largeur / hauteur };
}

/**
 * L'URL d'intégration est-elle sur un domaine autorisé ?
 * Sous-domaines admis (`xxx.genially.com`), HTTPS obligatoire.
 */
export function integrationAutorisee(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    const hote = u.hostname.toLowerCase();
    return DOMAINES_INTEGRATION.some((d) => hote === d || hote.endsWith(`.${d}`));
  } catch {
    return false;
  }
}



/**
 * Taille maximale d'une animation, en caractères.
 *
 * Un document Firestore plafonne à 1 Mo, et l'activité porte déjà ses
 * consignes, son questionnaire et ses images. Une animation HTML/CSS/JS en
 * fait 5 à 30 Ko ; au-delà, c'est presque toujours une image encodée dans le
 * code, qui a sa place dans l'onglet Image.
 */
export const TAILLE_MAX_CODE = 100_000;
