// ═══ Tarifs des modèles Claude (gestion des coûts, 2026-10-15) ═══
//
// Dollars par MILLION de jetons, relevés sur la page officielle des tarifs
// (platform.claude.com/docs/en/about-claude/pricing) le 2026-10-15.
// ⚠ À REVOIR à chaque changement de modèle : un modèle absent d'ici est compté
// au tarif Sonnet 5.5 et signalé `tarifInconnu` dans la trace.
//
// Pas d'import serveur ici : la page admin peut lire la table.

export interface TarifModele {
  entree: number;
  /** Écriture en cache (durée 5 min, celle qu'utilise l'app) */
  cacheEcriture: number;
  /** Lecture du cache */
  cacheLecture: number;
  sortie: number;
}

// Haiku 5.5 a deux paliers : au-delà de 100 000 jetons d'entrée, tout est
// facturé 5× plus cher (gros PDF transcrit, par exemple)
const HAIKU_55: TarifModele = { entree: 0.1, cacheEcriture: 0.125, cacheLecture: 0.01, sortie: 0.5 };
const HAIKU_55_LONG: TarifModele = { entree: 0.5, cacheEcriture: 0.625, cacheLecture: 0.05, sortie: 2.5 };
const SEUIL_HAIKU_LONG = 100_000;

const SONNET_55: TarifModele = { entree: 2, cacheEcriture: 2.5, cacheLecture: 0.1, sortie: 10 };

const TARIFS: Record<string, TarifModele> = {
  'claude-sonnet-5-5': SONNET_55,
  'claude-sonnet-4-5': { entree: 3, cacheEcriture: 3.75, cacheLecture: 0.3, sortie: 15 },
  'claude-haiku-4-5': { entree: 1, cacheEcriture: 1.25, cacheLecture: 0.1, sortie: 5 },
};

export interface JetonsIa {
  in: number;
  out: number;
  cacheRead: number;
  cacheWrite: number;
}

/** Le modèle renvoyé par l'API peut porter une date (`claude-sonnet-4-5-20250929`) */
function nomCourt(modele: string): string {
  return modele.replace(/-\d{8}$/, '');
}

export function tarifConnu(modele: string): boolean {
  const court = nomCourt(modele);
  return court === 'claude-haiku-5-5' || court in TARIFS;
}

/** Coût d'un appel, en dollars */
export function coutAppel(modele: string, j: JetonsIa): number {
  const court = nomCourt(modele);
  let tarif: TarifModele;
  if (court === 'claude-haiku-5-5') {
    tarif = j.in + j.cacheRead + j.cacheWrite > SEUIL_HAIKU_LONG ? HAIKU_55_LONG : HAIKU_55;
  } else {
    tarif = TARIFS[court] ?? SONNET_55;
  }
  return (
    (j.in * tarif.entree +
      j.cacheWrite * tarif.cacheEcriture +
      j.cacheRead * tarif.cacheLecture +
      j.out * tarif.sortie) /
    1_000_000
  );
}
