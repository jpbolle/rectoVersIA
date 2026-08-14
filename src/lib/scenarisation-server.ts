// Nettoyage d'une scénarisation reçue du client, avant écriture Firestore.
//
// Le document est écrit en entier à chaque enregistrement (chapitres et modules
// imbriqués) : tout ce qui n'est pas reconnu ici est perdu, ce qui tient le
// document à l'abri des champs parasites. Firestore refuse `undefined` — d'où
// les `?? null` systématiques.

import { PERIODE_IDS } from '@/types/scenarisation';
import type {
  Certification,
  ChapitreDidactique,
  ModuleActivite,
  ModuleDidactique,
  Scenarisation,
} from '@/types/scenarisation';

const MAX_TITRE = 200;
const MAX_TEXTE = 4000;

function texte(v: unknown, max = MAX_TEXTE): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function ids(v: unknown, max = 60): string[] {
  if (!Array.isArray(v)) return [];
  return [
    ...new Set(
      v
        .filter((x): x is string => typeof x === 'string')
        .map((x) => x.trim().slice(0, max))
        .filter(Boolean)
    ),
  ];
}

function periode(v: unknown, defaut = 'sept-oct'): string {
  return typeof v === 'string' && PERIODE_IDS.includes(v) ? v : defaut;
}

function nombre(v: unknown, defaut: number, max = 500): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n < 0) return defaut;
  return Math.min(max, Math.round(n * 2) / 2); // demi-périodes admises
}

function sanitizeCertification(raw: unknown, i = 0): Certification | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  const titre = texte(c.titre, MAX_TITRE);
  if (!titre) return null;
  return {
    id: texte(c.id, 60) || `CERT-${i}`,
    titre,
    grille: texte(c.grille, MAX_TITRE) || undefined,
    periodeAnnee: periode(c.periodeAnnee, 'mai-juin') as Certification['periodeAnnee'],
    periodes: nombre(c.periodes, 0),
    devoirId: typeof c.devoirId === 'string' ? c.devoirId.slice(0, 60) : null,
  };
}

// L'activité porte la didactique fine depuis le 2026-08-14 : durée, méthodes,
// UAA, gestes et outils descendent du module vers elle.
function sanitizeActivite(raw: unknown, i: number): ModuleActivite | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, unknown>;
  const titre = texte(a.titre, MAX_TITRE);
  const devoirId = typeof a.devoirId === 'string' && a.devoirId ? a.devoirId.slice(0, 60) : null;
  if (!titre && !devoirId) return null;
  return {
    id: texte(a.id, 60) || `ACT-${i}`,
    titre,
    devoirId,
    typeTravail: typeof a.typeTravail === 'string' ? a.typeTravail.slice(0, 30) : null,
    periodes: nombre(a.periodes, 0),
    methodes: ids(a.methodes),
    uaa: ids(a.uaa),
    gestes: ids(a.gestes, MAX_TITRE),
    outils: texte(a.outils, MAX_TITRE),
    critique: texte(a.critique),
  };
}

const GENRES_VALIDES = ['module', 'certification', 'suggestion'];

function genre(v: unknown): ModuleDidactique['genre'] {
  return typeof v === 'string' && GENRES_VALIDES.includes(v)
    ? (v as ModuleDidactique['genre'])
    : 'module';
}

function sanitizeModule(raw: unknown, i: number): ModuleDidactique | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  const obj = (m.objectifs ?? {}) as Record<string, unknown>;
  const activites = Array.isArray(m.activites)
    ? m.activites.map(sanitizeActivite).filter((a): a is ModuleActivite => a !== null)
    : [];
  return {
    id: texte(m.id, 60) || `MOD-${i}`,
    titre: texte(m.titre, MAX_TITRE),
    // Module, certification ou suggestion : trois genres, une seule liste
    genre: genre(m.genre),
    periodeAnnee: periode(m.periodeAnnee) as ModuleDidactique['periodeAnnee'],
    objectifs: {
      concepts: texte(obj.concepts),
      gestesCognitifs: ids(obj.gestesCognitifs, MAX_TITRE),
      gestesSavoirEtre: ids(obj.gestesSavoirEtre, MAX_TITRE),
      // Texte d'avant les gestes : `objectifs.habiletes` et `objectifs.savoirEtre`
      // étaient des chaînes libres. On les conserve tant qu'elles disent quelque
      // chose, pour ne rien effacer des scénarisations déjà encodées.
      habiletesTexte: texte(obj.habiletesTexte) || texte(obj.habiletes),
      savoirEtreTexte:
        texte(obj.savoirEtreTexte) ||
        (typeof obj.savoirEtre === 'string' ? texte(obj.savoirEtre) : ''),
    },
    activites,
    // Valeurs héritées : relues telles quelles tant que le module n'a aucune
    // activité pour les porter, effacées dès qu'il en a une
    periodes: activites.length ? 0 : nombre(m.periodes, 0),
    methodes: activites.length ? [] : ids(m.methodes),
    uaa: activites.length ? [] : ids(m.uaa),
    habiletes: activites.length ? [] : ids(m.habiletes, MAX_TITRE),
    outils: activites.length ? '' : texte(m.outils, MAX_TITRE),
  };
}

// Une certification d'avant le 2026-08-14 → un module de genre certification.
// Le client fait déjà cette conversion à la lecture ; on la refait ici pour
// qu'un document jamais rouvert par l'écran ne perde rien non plus.
function certificationEnModule(cert: Certification, i: number): ModuleDidactique {
  return {
    id: cert.id || `MOD-CERT-${i}`,
    titre: cert.titre,
    genre: 'certification',
    periodeAnnee: (cert.periodeAnnee ?? 'mai-juin') as ModuleDidactique['periodeAnnee'],
    objectifs: { concepts: '', gestesCognitifs: [], gestesSavoirEtre: [] },
    activites: [],
    periodes: cert.periodes || 0,
  };
}

function sanitizeChapitre(raw: unknown, i: number): ChapitreDidactique | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  // Objectif général unique d'avant le 2026-08-14 : converti en liste
  const objectifs = ids(c.objectifsGeneraux, MAX_TEXTE);
  const ancienObjectif = texte(c.objectifGeneral);

  const modules = Array.isArray(c.modules)
    ? c.modules.map(sanitizeModule).filter((m): m is ModuleDidactique => m !== null)
    : [];

  // Certifications encore stockées à part : reversées en fin de chapitre
  const anciennes = Array.isArray(c.certifications)
    ? c.certifications.map((x, j) => sanitizeCertification(x, j)).filter((x): x is Certification => x !== null)
    : [];
  const solo = anciennes.length ? [] : [sanitizeCertification(c.certification)].filter((x): x is Certification => x !== null);
  const converties = [...anciennes, ...solo]
    .map(certificationEnModule)
    // Une certification déjà convertie côté client ne doit pas revenir en double
    .filter((mod) => !modules.some((m) => m.id === mod.id));

  return {
    id: texte(c.id, 60) || `CHA-${i}`,
    titre: texte(c.titre, MAX_TITRE),
    objectifsGeneraux: objectifs.length ? objectifs : ancienObjectif ? [ancienObjectif] : [],
    modules: [...modules, ...converties],
  };
}

// Champs modifiables d'une scénarisation. `id`, `profId`, `anneeScolaire` et
// les horodatages restent la propriété du serveur.
export function sanitizeScenarisation(
  body: unknown
): Omit<Scenarisation, 'id' | 'profId' | 'anneeScolaire' | 'createdAt' | 'updatedAt'> {
  const b = (body ?? {}) as Record<string, unknown>;

  const semaines: Record<string, number> = {};
  const src = (b.semaines ?? {}) as Record<string, unknown>;
  PERIODE_IDS.forEach((id) => {
    if (src[id] !== undefined) semaines[id] = nombre(src[id], 0, 20);
  });

  return {
    nom: texte(b.nom, MAX_TITRE) || 'Scénarisation sans nom',
    // Ni objectif général ni certification au niveau du parcours : ils ne sont
    // plus écrits, et disparaissent des documents antérieurs à leur prochaine
    // réécriture (décision de JP, 2026-08-14)
    dureePeriodeMin: nombre(b.dureePeriodeMin, 90, 300) || 90,
    heuresParSemaine: nombre(b.heuresParSemaine, 5, 40),
    semaines,
    chapitres: Array.isArray(b.chapitres)
      ? b.chapitres.map(sanitizeChapitre).filter((c): c is ChapitreDidactique => c !== null)
      : [],
    archive: b.archive === true,
  };
}

// Les activités Recto-versIA rattachées, tous chapitres confondus
export function devoirsRattaches(scen: { chapitres: ChapitreDidactique[] }): string[] {
  const out = new Set<string>();
  scen.chapitres.forEach((c) => {
    c.modules.forEach((m) =>
      m.activites.forEach((a) => {
        if (a.devoirId) out.add(a.devoirId);
      })
    );
  });
  return [...out];
}
