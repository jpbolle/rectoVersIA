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

function sanitizeCertification(raw: unknown): Certification | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  const titre = texte(c.titre, MAX_TITRE);
  if (!titre) return null;
  return {
    titre,
    grille: texte(c.grille, MAX_TITRE) || undefined,
    periodeAnnee: periode(c.periodeAnnee, 'mai-juin') as Certification['periodeAnnee'],
    periodes: nombre(c.periodes, 0),
    devoirId: typeof c.devoirId === 'string' ? c.devoirId.slice(0, 60) : null,
  };
}

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
  };
}

function sanitizeModule(raw: unknown, i: number): ModuleDidactique | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  const obj = (m.objectifs ?? {}) as Record<string, unknown>;
  return {
    id: texte(m.id, 60) || `MOD-${i}`,
    titre: texte(m.titre, MAX_TITRE),
    periodeAnnee: periode(m.periodeAnnee) as ModuleDidactique['periodeAnnee'],
    periodes: nombre(m.periodes, 0),
    methodes: ids(m.methodes),
    uaa: ids(m.uaa),
    habiletes: ids(m.habiletes),
    outils: texte(m.outils, MAX_TITRE),
    objectifs: {
      concepts: texte(obj.concepts),
      habiletes: texte(obj.habiletes),
      savoirEtre: texte(obj.savoirEtre),
    },
    activites: Array.isArray(m.activites)
      ? m.activites.map(sanitizeActivite).filter((a): a is ModuleActivite => a !== null)
      : [],
  };
}

function sanitizeChapitre(raw: unknown, i: number): ChapitreDidactique | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  return {
    id: texte(c.id, 60) || `CHA-${i}`,
    titre: texte(c.titre, MAX_TITRE),
    objectifGeneral: texte(c.objectifGeneral),
    certification: sanitizeCertification(c.certification),
    modules: Array.isArray(c.modules)
      ? c.modules.map(sanitizeModule).filter((m): m is ModuleDidactique => m !== null)
      : [],
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
    objectifGeneral: texte(b.objectifGeneral),
    certification: sanitizeCertification(b.certification),
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
    if (c.certification?.devoirId) out.add(c.certification.devoirId);
  });
  return [...out];
}
