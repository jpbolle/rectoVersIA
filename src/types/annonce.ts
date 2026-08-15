// Annonce de l'administration — le seul message poussé « à la main » dans la
// cloche. Toutes les autres notifications sont calculées à la lecture depuis
// des événements existants (voir /api/notifications) ; une annonce n'ayant
// aucun événement derrière elle, il faut bien l'écrire quelque part.
//
// Collection `annonces` : accès SERVEUR uniquement (adminDb), donc aucune
// règle Firestore — même choix que `scenarisations`.

export type AnnonceCible = 'profs' | 'eleves' | 'tous';

export interface Annonce {
  id: string;                 // ANN-YYYYMMDD-XXXX
  message: string;
  cible: AnnonceCible;
  lien: string | null;        // chemin interne de l'app ("/roadmap"), jamais une URL externe
  auteurUid: string;          // uid de l'admin — jamais l'email (donnée personnelle)
  createdAt: string;          // ISO
}

export interface CreateAnnonceData {
  message: string;
  cible: AnnonceCible;
  lien?: string | null;
}

export const CIBLE_LABELS: Record<AnnonceCible, string> = {
  profs: 'Professeurs',
  eleves: 'Élèves',
  tous: 'Tout le monde',
};

// Pages proposées au menu déroulant, avec le public qui peut les atteindre.
// Une page prof ne doit jamais être proposée pour une annonce aux élèves :
// le lien mènerait à une redirection.
export const PAGES_APP: { path: string; label: string; pour: AnnonceCible }[] = [
  { path: '/roadmap', label: 'Roadmap — nouveautés et à venir', pour: 'tous' },
  { path: '/rgpd', label: 'Données personnelles (RGPD)', pour: 'tous' },
  { path: '/dashboard', label: 'Mes Activités (prof)', pour: 'profs' },
  { path: '/classes', label: 'Mes Classes (prof)', pour: 'profs' },
  { path: '/grilles', label: 'Mes Ressources (prof)', pour: 'profs' },
  { path: '/archives', label: 'Archives (prof)', pour: 'profs' },
  { path: '/activites', label: 'Mes Activités (élève)', pour: 'eleves' },
  { path: '/mes-classes', label: 'Mes Classes (élève)', pour: 'eleves' },
  { path: '/mes-ressources', label: 'Mes ressources personnelles (élève)', pour: 'eleves' },
  { path: '/profil', label: 'Mon Profil (élève)', pour: 'eleves' },
];

// Pages proposables pour une cible donnée. Pour « tout le monde », seules les
// pages communes tiennent : les autres sont fermées à la moitié des lecteurs.
export function pagesPourCible(cible: AnnonceCible): { path: string; label: string }[] {
  return PAGES_APP.filter((p) => p.pour === 'tous' || p.pour === cible);
}

export function generateAnnonceId(): string {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ANN-${year}${month}${day}-${random}`;
}

// Un lien d'annonce est toujours un chemin interne : jamais d'URL absolue
// (une annonce ne doit pas pouvoir renvoyer les élèves hors de l'app), jamais
// de « // » en tête (que le navigateur lirait comme un autre domaine).
export function normalizeLien(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const lien = raw.trim();
  if (!lien) return null;
  if (!lien.startsWith('/') || lien.startsWith('//')) return null;
  return lien.slice(0, 200);
}
