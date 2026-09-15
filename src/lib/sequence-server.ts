// Séquences FLE côté serveur : nettoyage du contenu, résolution de l'élève,
// et la VOIE D'AUTORISATION « par séquence ».
//
// Résultat de la sonde (2026-09-14) : l'accès d'un élève à une activité se
// décide dans TROIS routes (`devoirs/[id]` GET, `travaux` POST, `travaux/mine`
// GET), toutes sur le même motif `etatEffectif` → 403 si `!disponible`. La
// séquence AJOUTE une voie : quand l'état effectif refuse, on regarde si une
// séquence OUVERTE à l'élève contient l'activité. Elle ne retire rien.

import { adminDb } from '@/lib/firebase/admin';
import { queryElevesByEmail } from '@/lib/eleve-lookup';
import { etatEffectif, sessionsDeLEleve } from '@/lib/session-server';
import { concerne, generateEtapeId } from '@/types/sequence-fle';
import type { SequenceFleContenu, SequenceFleEtape } from '@/types/sequence-fle';

function idsOuNull(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  return [...new Set(v.filter((x): x is string => typeof x === 'string' && x.trim() !== ''))];
}

// Nettoie le contenu reçu du client. `undefined` interdit en base : une
// restriction absente s'écrit `null`, un champ absent une chaîne vide.
export function sequenceFlePourFirestore(input: unknown): SequenceFleContenu {
  const raw = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const etapes: SequenceFleEtape[] = [];
  const vus = new Set<string>();
  if (Array.isArray(raw.etapes)) {
    for (const e of raw.etapes) {
      if (!e || typeof e !== 'object') continue;
      const item = e as Record<string, unknown>;
      const nature = item.nature === 'theorie' || item.nature === 'activite' ? item.nature : null;
      const moduleId = typeof item.moduleId === 'string' ? item.moduleId.trim() : '';
      const devoirId = typeof item.devoirId === 'string' ? item.devoirId.trim() : '';
      if (!nature) continue;
      if (nature === 'theorie' && !moduleId) continue;
      if (nature === 'activite' && !devoirId) continue;
      let id = typeof item.id === 'string' && item.id.trim() ? item.id.trim().slice(0, 40) : generateEtapeId();
      while (vus.has(id)) id = generateEtapeId();
      vus.add(id);
      etapes.push({
        id,
        nature,
        moduleId,
        devoirId,
        titre: typeof item.titre === 'string' ? item.titre.trim().slice(0, 200) : '',
        type: typeof item.type === 'string' ? item.type.slice(0, 60) : '',
        atelier: typeof item.atelier === 'string' ? item.atelier.slice(0, 60) : '',
        typeTravail: typeof item.typeTravail === 'string' ? item.typeTravail.slice(0, 40) : '',
        eleves: idsOuNull(item.eleves),
      });
    }
  }
  return { etapes };
}

// Restriction d'élèves d'une activité (`Devoir.eleves`) : null = toute la classe
export function restrictionElevesPourFirestore(input: unknown): string[] | null {
  return idsOuNull(input);
}

/** L'élève est-il EXCLU par la restriction de l'activité ? (null = personne n'est exclu) */
export function eleveExclu(restriction: unknown, eleveIds: string[]): boolean {
  const liste = idsOuNull(restriction);
  return liste !== null && !concerne(liste, eleveIds);
}

// Lecture tolérante d'un document (champ absent = séquence vide)
export function lireSequenceFle(data: unknown): SequenceFleContenu {
  return sequenceFlePourFirestore(data ?? {});
}

// ─── Qui est l'élève ? ───

export interface IdentiteEleve {
  eleveIds: string[]; // ses fiches `eleves` (une par classe)
  classeIds: string[];
  classeNoms: string[];
}

/** Fiches, classes (ids et noms) de l'utilisateur connecté — par uid, puis par email. */
export async function identiteEleve(uid: string, email: string): Promise<IdentiteEleve> {
  const [byUid, byEmail] = await Promise.all([
    adminDb.collection('eleves').where('firebaseUid', '==', uid).get(),
    queryElevesByEmail(email || ''),
  ]);
  const eleveIds = new Set<string>();
  const classeIds = new Set<string>();
  [...byUid.docs, ...byEmail.docs].forEach((d) => {
    eleveIds.add(d.id);
    const c = d.data().classeId;
    if (c) classeIds.add(c);
  });
  const classeNoms: string[] = [];
  await Promise.all(
    [...classeIds].map(async (id) => {
      const c = await adminDb.collection('classes').doc(id).get();
      if (c.exists && c.data()?.nom) classeNoms.push(c.data()!.nom);
    })
  );
  return { eleveIds: [...eleveIds], classeIds: [...classeIds], classeNoms };
}

// ─── Une séquence est-elle ouverte à cet élève ? ───

/**
 * Même règle que n'importe quelle activité : classe, restriction d'élèves
 * (`Devoir.eleves`), état effectif. Le contenu (modules) n'entre pas ici.
 */
export async function sequenceOuverteA(
  devoir: { id: string; classes?: unknown; eleves?: unknown; disponible?: boolean; corrigeDisponible?: boolean; archive?: boolean },
  identite: IdentiteEleve
): Promise<boolean> {
  if (devoir.archive) return false;
  const classes = Array.isArray(devoir.classes) ? (devoir.classes as string[]) : [];
  if (!classes.some((nom) => identite.classeNoms.includes(nom))) return false;
  if (eleveExclu(devoir.eleves, identite.eleveIds)) return false;
  const mes = await sessionsDeLEleve(devoir.id, identite.classeIds);
  return etatEffectif(
    { disponible: devoir.disponible, corrigeDisponible: devoir.corrigeDisponible },
    mes.sessions
  ).disponible;
}

// ─── La voie d'autorisation ───

/**
 * Une séquence ouverte à cet élève contient-elle l'activité ?
 *
 * Appelée UNIQUEMENT quand l'état effectif (session / devoir) a refusé : c'est
 * une porte de plus, jamais une porte de moins. Coût : une lecture des
 * séquences (index simple sur `typeTravail`), puis les sessions des
 * séquences candidates.
 */
export async function ouvertParSequence(uid: string, email: string, devoirId: string): Promise<boolean> {
  const identite = await identiteEleve(uid, email);
  if (identite.eleveIds.length === 0 || identite.classeNoms.length === 0) return false;

  const snap = await adminDb.collection('devoirs').where('typeTravail', '==', 'sequence').get();
  // Séquences de ses classes, qui le concernent, dont une étape (qui le
  // concerne) est cette activité
  const candidates = snap.docs
    .map((d) => ({ id: d.data().id || d.id, data: d.data() }))
    .filter((s) => {
      const classes = Array.isArray(s.data.classes) ? (s.data.classes as string[]) : [];
      return !s.data.archive && classes.some((nom) => identite.classeNoms.includes(nom));
    })
    .filter((s) => !eleveExclu(s.data.eleves, identite.eleveIds))
    .filter((s) =>
      lireSequenceFle(s.data.sequenceFle).etapes.some(
        (e) => e.nature === 'activite' && e.devoirId === devoirId && concerne(e.eleves, identite.eleveIds)
      )
    );

  for (const s of candidates) {
    if (await sequenceOuverteA({ id: s.id, ...s.data }, identite)) return true;
  }
  return false;
}
