export function generateDevoirId(): string {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `DEV-${year}${month}${day}-${random}`;
}

export function formatDateRemise(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDateShort(dateString: string): string {
  // La date de remise est facultative
  if (!dateString) return 'date non fixée';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'date non fixée';
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function getTodayString(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

/**
 * Tri des activités par ÉCHÉANCE, de la plus proche à la plus éloignée
 * (JP, 2026-10-09 — partout : tableau de bord prof, listes de l'élève,
 * espaces classique et FLE). Une activité sans échéance ferme la marche :
 * elle n'attend rien de personne, elle n'a pas à passer devant celle de
 * demain. À échéance égale, l'ordre alphabétique de l'intitulé.
 */
export function parEcheance(
  a: { dateRemise?: string | null; intitule: string },
  b: { dateRemise?: string | null; intitule: string }
): number {
  if (!a.dateRemise && !b.dateRemise) return a.intitule.localeCompare(b.intitule);
  if (!a.dateRemise) return 1;
  if (!b.dateRemise) return -1;
  return a.dateRemise.localeCompare(b.dateRemise) || a.intitule.localeCompare(b.intitule);
}

/**
 * Les activités posées dans une étape d'un portfolio de la liste (activité de
 * type portfolio, ou matrice ramenée à cette forme).
 * Mes Activités (prof et élève) ne montre que le portfolio, pas les activités
 * qu'il contient — trop de bruit visuel (JP, 2026-10-11). Le prof corrige leurs
 * copies depuis le tableau d'évolution du portfolio ; l'élève les ouvre depuis
 * l'étape. Une activité qu'aucun portfolio ne contient reste listée.
 */
export function activitesDePortfolio(
  devoirs: { typeTravail?: string; portfolio?: { etapes: { nature: string; devoirId?: string }[] } | null }[]
): Set<string> {
  const ids = new Set<string>();
  for (const d of devoirs) {
    if (d.typeTravail !== 'portfolio' || !d.portfolio) continue;
    for (const e of d.portfolio.etapes) {
      if (e.nature === 'activite' && e.devoirId) ids.add(e.devoirId);
    }
  }
  return ids;
}

