'use client';

// Pictogrammes des types d'activité — un petit dessin par atelier, en SVG
// inline, aux couleurs du projet (traits `currentColor`, aplats des tokens
// Classica). Ils illustrent la carte de choix à la création d'une activité.
// Décision JP du 2026-10-04 : un « schéma » par atelier plutôt qu'une icône
// générique.

interface AtelierPictoProps {
  atelierId: string;
  className?: string;
}

const COMMUN = {
  width: 72,
  height: 54,
  viewBox: '0 0 72 54',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const ACCENT = 'var(--c-accent)';
const PRIMAIRE = 'var(--c-primary-light, var(--c-primary))';
const PAPIER = 'var(--c-bg-element)';

export default function AtelierPicto({ atelierId, className }: AtelierPictoProps) {
  switch (atelierId) {
    case 'ecriture':
      // Une feuille lignée et une plume qui écrit
      return (
        <svg {...COMMUN} className={className} aria-hidden>
          <rect x="10" y="6" width="36" height="42" rx="3" fill={PAPIER} />
          <path d="M17 16h22M17 23h22M17 30h14M17 37h10" />
          <path d="M62 10 42 30l-6 8 8-6 20-20z" fill={ACCENT} stroke="none" />
          <path d="M36 38l6-8" />
        </svg>
      );
    case 'lecture':
      // Une feuille de questionnaire avec cases cochées
      return (
        <svg {...COMMUN} className={className} aria-hidden>
          <rect x="14" y="5" width="44" height="44" rx="3" fill={PAPIER} />
          <rect x="21" y="12" width="7" height="7" rx="1.5" fill={PRIMAIRE} stroke="none" />
          <path d="M23 15.5l2 2 3-4" stroke="#fff" />
          <path d="M33 15.5h18" />
          <rect x="21" y="24" width="7" height="7" rx="1.5" />
          <path d="M33 27.5h18" />
          <rect x="21" y="36" width="7" height="7" rx="1.5" fill={PRIMAIRE} stroke="none" />
          <path d="M23 39.5l2 2 3-4" stroke="#fff" />
          <path d="M33 39.5h12" />
        </svg>
      );
    case 'lecture-oeuvre':
      // Un livre ouvert, un signet
      return (
        <svg {...COMMUN} className={className} aria-hidden>
          <path d="M36 14c-6-5-14-6-24-5v34c10-1 18 0 24 5 6-5 14-6 24-5V9c-10-1-18 0-24 5z" fill={PAPIER} />
          <path d="M36 14v34" />
          <path d="M18 18h12M18 25h12M18 32h8M42 18h12M42 25h12M42 32h8" strokeWidth="1.5" />
          <path d="M50 8v14l3-3 3 3V8" fill={ACCENT} stroke="none" />
        </svg>
      );
    case 'recherche':
      // Une fenêtre de navigateur et une loupe
      return (
        <svg {...COMMUN} className={className} aria-hidden>
          <rect x="6" y="8" width="48" height="36" rx="3" fill={PAPIER} />
          <path d="M6 16h48" />
          <circle cx="11" cy="12" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="16" cy="12" r="1.3" fill="currentColor" stroke="none" />
          <path d="M13 24h22M13 31h16" strokeWidth="1.5" />
          <circle cx="46" cy="33" r="9" fill={PAPIER} strokeWidth="2.5" />
          <path d="M53 40l10 10" strokeWidth="3.5" stroke={ACCENT} />
        </svg>
      );
    case 'vocabulaire':
      // Des étiquettes de mots, l'une mise en avant
      return (
        <svg {...COMMUN} className={className} aria-hidden>
          <rect x="6" y="8" width="26" height="12" rx="6" fill={PAPIER} />
          <rect x="36" y="8" width="30" height="12" rx="6" fill={PRIMAIRE} stroke="none" />
          <rect x="10" y="24" width="34" height="12" rx="6" fill={ACCENT} stroke="none" />
          <rect x="48" y="24" width="18" height="12" rx="6" fill={PAPIER} />
          <rect x="6" y="40" width="22" height="12" rx="6" fill={PAPIER} />
          <rect x="32" y="40" width="30" height="12" rx="6" fill={PAPIER} />
          <path d="M13 14h12M42 14h18" stroke="#fff" strokeWidth="1.5" />
          <path d="M17 30h20" stroke="#fff" strokeWidth="1.5" />
          <path d="M13 46h8M39 46h16M54 30h6" strokeWidth="1.5" />
        </svg>
      );
    case 'autoevaluation':
      // Un miroir sur pied, un visage qui s'y regarde
      return (
        <svg {...COMMUN} className={className} aria-hidden>
          <ellipse cx="36" cy="22" rx="16" ry="18" fill={PAPIER} />
          <ellipse cx="36" cy="22" rx="11" ry="13" fill="none" stroke={PRIMAIRE} strokeWidth="1.5" />
          <circle cx="32" cy="19" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="40" cy="19" r="1.4" fill="currentColor" stroke="none" />
          <path d="M31 26c2.5 2.5 7.5 2.5 10 0" />
          <path d="M36 40v8M26 50h20" />
          <path d="M44 6l2 3 3 1-3 1-2 3-2-3-3-1 3-1z" fill={ACCENT} stroke="none" />
        </svg>
      );
    case 'sondage':
      // Un diagramme en barres qui monte, un point « en direct »
      return (
        <svg {...COMMUN} className={className} aria-hidden>
          <path d="M8 48h56" />
          <rect x="14" y="30" width="10" height="18" rx="2" fill={PAPIER} />
          <rect x="30" y="18" width="10" height="30" rx="2" fill={PRIMAIRE} stroke="none" />
          <rect x="46" y="24" width="10" height="24" rx="2" fill={ACCENT} stroke="none" />
          <circle cx="60" cy="10" r="4" fill="var(--c-danger)" stroke="none" />
          <circle cx="60" cy="10" r="7" stroke="var(--c-danger)" strokeWidth="1.5" opacity="0.5" />
        </svg>
      );
    case 'sequence-fle':
      // Un serpentin d'étapes, trois jalons
      return (
        <svg {...COMMUN} className={className} aria-hidden>
          <path d="M10 12h40a8 8 0 0 1 0 16H22a8 8 0 0 0 0 16h40" strokeWidth="2.5" />
          <circle cx="10" cy="12" r="5" fill={PRIMAIRE} stroke="none" />
          <circle cx="36" cy="28" r="5" fill={ACCENT} stroke="none" />
          <circle cx="62" cy="44" r="5" fill={PAPIER} />
        </svg>
      );
    case 'conceptualisation':
      // Une carte conceptuelle : des boîtes reliées
      return (
        <svg {...COMMUN} className={className} aria-hidden>
          <path d="M36 15v10M30 25 18 36M42 25l12 11" />
          <rect x="24" y="5" width="24" height="11" rx="3" fill={ACCENT} stroke="none" />
          <rect x="8" y="35" width="22" height="11" rx="3" fill={PAPIER} />
          <rect x="44" y="35" width="22" height="11" rx="3" fill={PRIMAIRE} stroke="none" />
          <path d="M22 28h10" strokeWidth="1.2" stroke={ACCENT} />
          <circle cx="36" cy="25" r="2.2" fill="currentColor" stroke="none" />
        </svg>
      );
    default:
      return (
        <svg {...COMMUN} className={className} aria-hidden>
          <rect x="14" y="8" width="44" height="38" rx="4" fill={PAPIER} />
        </svg>
      );
  }
}
