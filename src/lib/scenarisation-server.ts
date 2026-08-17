// Nettoyage d'une scénarisation reçue du client, avant écriture Firestore.
//
// Le document est écrit en entier à chaque enregistrement (chapitres et modules
// imbriqués) : tout ce qui n'est pas reconnu ici est perdu, ce qui tient le
// document à l'abri des champs parasites. Firestore refuse `undefined` — d'où
// les `?? null` systématiques.

import { PERIODE_IDS } from '@/types/scenarisation';
import { CEINTURE_DEPART, CEINTURE_IDS } from '@/types/ceintures';
import { calculateSchoolYear } from '@/lib/auth-utils';
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
    concepts: texte(a.concepts),
    outils: texte(a.outils, MAX_TITRE),
    critique: texte(a.critique),
  };
}

const GENRES_VALIDES = ['module', 'certification', 'suggestion'];

// Chaîne vide admise : le prof peut déclarer une certification avant de savoir
// quelle ceinture elle accordera. La BLANCHE est refusée : elle est acquise dès
// l'entrée dans le parcours, aucune certification ne l'accorde.
function ceinture(v: unknown): string {
  if (typeof v !== 'string' || v === CEINTURE_DEPART) return '';
  return CEINTURE_IDS.includes(v) ? v : '';
}

// Notée, ou accordée au seul fait d'être faite. Absent = 'note' : les
// certifications encodées avant ce champ gardent leur comportement.
function cotation(v: unknown): 'note' | 'fait' {
  return v === 'fait' ? 'fait' : 'note';
}

// Poids en % du total de l'UAA. Firestore refuse `undefined` et 0 n'aurait
// aucun sens (une certification qui ne compte pas) : on retombe sur 100.
function ponderation(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return 100;
  return Math.min(100, Math.round(n));
}

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
  const g = genre(m.genre);
  return {
    id: texte(m.id, 60) || `MOD-${i}`,
    titre: texte(m.titre, MAX_TITRE),
    // Module, certification ou suggestion : trois genres, une seule liste
    genre: g,
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
    // Propre à la certification : ce qu'elle certifie, la ceinture qu'elle
    // accorde et son poids dans l'UAA. Un module ordinaire ne les porte pas —
    // les écrire à vide ne ferait qu'alourdir le document.
    ...(g === 'certification'
      ? {
          uaaCertifiees: ids(m.uaaCertifiees, 10),
          ceinture: ceinture(m.ceinture),
          ponderation: ponderation(m.ponderation),
          cotation: cotation(m.cotation),
        }
      : {}),
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

  const tous = [...modules, ...converties];

  // Une suggestion n'est plus un module : si le client en renvoie encore une
  // (document d'avant le 2026-08-15 jamais rouvert), elle redevient du texte
  // plutôt que d'être perdue au premier enregistrement.
  const suggestionsHeritees = tous
    .filter((m) => m.genre === 'suggestion')
    .map((m) => m.titre.trim())
    .filter(Boolean);

  return {
    id: texte(c.id, 60) || `CHA-${i}`,
    titre: texte(c.titre, MAX_TITRE),
    // Identité visuelle du chapitre — sans elle, la couleur redeviendrait
    // fonction de la position à chaque relecture
    couleur: typeof c.couleur === 'string' && /^#[0-9a-f]{6}$/i.test(c.couleur) ? c.couleur : undefined,
    objectifsGeneraux: objectifs.length ? objectifs : ancienObjectif ? [ancienObjectif] : [],
    modules: tous.filter((m) => m.genre !== 'suggestion'),
    suggestions: [...ids(c.suggestions, MAX_TEXTE), ...suggestionsHeritees],
  };
}

// Champs modifiables d'une scénarisation. `id`, `profId` et les horodatages
// restent la propriété du serveur.
//
// L'ANNÉE SCOLAIRE, elle, est saisie par le prof, pas déduite de la date : « Français
// — 4e générale » revient chaque année, et c'est elle qui distingue les copies.
// Une valeur hors format retombe sur l'année en cours plutôt que d'être écrite
// telle quelle — elle sert de filtre, elle ne peut pas être libre.
function anneeScolaire(v: unknown): string {
  return typeof v === 'string' && /^\d{4}-\d{4}$/.test(v) ? v : calculateSchoolYear();
}

export function sanitizeScenarisation(
  body: unknown
): Omit<Scenarisation, 'id' | 'profId' | 'createdAt' | 'updatedAt'> {
  const b = (body ?? {}) as Record<string, unknown>;

  const semaines: Record<string, number> = {};
  const src = (b.semaines ?? {}) as Record<string, unknown>;
  PERIODE_IDS.forEach((id) => {
    if (src[id] !== undefined) semaines[id] = nombre(src[id], 0, 20);
  });

  return {
    nom: texte(b.nom, MAX_TITRE) || 'Scénarisation sans nom',
    anneeScolaire: anneeScolaire(b.anneeScolaire),
    // Ni objectif général ni certification au niveau du parcours : ils ne sont
    // plus écrits, et disparaissent des documents antérieurs à leur prochaine
    // réécriture (décision de JP, 2026-08-14)
    dureePeriodeMin: nombre(b.dureePeriodeMin, 90, 300) || 90,
    heuresParSemaine: nombre(b.heuresParSemaine, 5, 40),
    // Classes concernées, par NOM (comme devoirs.classes) : c'est ce qui dit
    // quels élèves seront notés aux certifications du parcours.
    classes: ids(b.classes, MAX_TITRE),
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
