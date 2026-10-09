// Le GROUPE d'un portfolio côté serveur (collection `portfolioGroupes`) :
// lecture d'un document, résolution des noms (déchiffrés ici, jamais côté
// client), camarades proposés à l'élève, droit du prof.
//
// Un membre est désigné par sa FICHE `eleves` (eleveId), pas par son uid :
// un camarade qui ne s'est jamais connecté n'a pas d'uid, mais il a une fiche.
// Les noms ne sont PAS stockés dans le groupe : on les relit (RGPD — une
// seule source, chiffrée).

import { adminDb } from '@/lib/firebase/admin';
import { decryptFields, SENSITIVE_ELEVE_FIELDS } from '@/lib/crypto';
import { accesDevoir, peutAgir, type AuthProf } from '@/lib/classe-acces';
import type { IdentiteEleve } from '@/lib/sequence-server';
import type { CamaradeVue, GroupeStatut, GroupeVue, MembreStatut, MembreVue } from '@/types/portfolio';

type Doc = FirebaseFirestore.DocumentSnapshot | FirebaseFirestore.QueryDocumentSnapshot;

export interface GroupeDoc {
  id: string;
  devoirId: string;
  createurEleveId: string;
  membres: { eleveId: string; statut: MembreStatut }[];
  statut: GroupeStatut;
  motif: string;
  createdAt: string;
  updatedAt: string;
}

function iso(v: unknown): string {
  const d = v as { toDate?: () => Date } | string | undefined;
  if (d && typeof d === 'object' && typeof d.toDate === 'function') return d.toDate().toISOString();
  return typeof d === 'string' ? d : '';
}

export function docToGroupe(doc: Doc): GroupeDoc {
  const data = doc.data() ?? {};
  const membres = Array.isArray(data.membres)
    ? data.membres
        .filter((m: unknown) => m && typeof m === 'object' && typeof (m as { eleveId?: unknown }).eleveId === 'string')
        .map((m: { eleveId: string; statut?: unknown }) => ({
          eleveId: m.eleveId,
          statut: (m.statut === 'confirme' || m.statut === 'decline' ? m.statut : 'attente') as MembreStatut,
        }))
    : [];
  return {
    id: doc.id,
    devoirId: typeof data.devoirId === 'string' ? data.devoirId : '',
    createurEleveId: typeof data.createurEleveId === 'string' ? data.createurEleveId : '',
    membres,
    statut: data.statut === 'accepte' || data.statut === 'refuse' ? data.statut : 'attente',
    motif: typeof data.motif === 'string' ? data.motif : '',
    createdAt: iso(data.createdAt),
    updatedAt: iso(data.updatedAt),
  };
}

interface Fiche {
  eleveId: string;
  uid: string | null;
  prenom: string;
  nom: string;
  classeId: string;
}

function ficheDe(d: Doc): Fiche {
  const data = decryptFields(d.data() ?? {}, SENSITIVE_ELEVE_FIELDS) as Record<string, unknown>;
  return {
    eleveId: d.id,
    uid: typeof data.firebaseUid === 'string' && data.firebaseUid ? data.firebaseUid : null,
    prenom: String(data.prenom ?? '').trim(),
    nom: String(data.nom ?? '').trim(),
    classeId: typeof data.classeId === 'string' ? data.classeId : '',
  };
}

/** « Prénom N. » (élève) ou « Prénom Nom » (prof). */
function nomAffiche(f: Fiche, complet: boolean): string {
  if (complet) return `${f.prenom} ${f.nom}`.trim() || 'Élève';
  const initiale = f.nom ? ` ${f.nom[0].toUpperCase()}.` : '';
  return `${f.prenom || 'Élève'}${initiale}`;
}

/** Les fiches d'une liste d'ids, en une lecture. */
export async function fichesParId(eleveIds: string[]): Promise<Map<string, Fiche>> {
  const ids = [...new Set(eleveIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  const docs = await adminDb.getAll(...ids.map((id) => adminDb.collection('eleves').doc(id)));
  return new Map(docs.filter((d) => d.exists).map((d) => [d.id, ficheDe(d)]));
}

/** Un groupe prêt à afficher — noms résolus, `moi` et `createur` posés. */
export async function groupeVue(
  g: GroupeDoc,
  options: { mesEleveIds?: string[]; nomsComplets?: boolean; fiches?: Map<string, Fiche> } = {}
): Promise<GroupeVue> {
  const fiches = options.fiches ?? (await fichesParId(g.membres.map((m) => m.eleveId)));
  const mes = new Set(options.mesEleveIds ?? []);
  const membres: MembreVue[] = g.membres.map((m) => {
    const f = fiches.get(m.eleveId);
    return {
      eleveId: m.eleveId,
      uid: f?.uid ?? null,
      nom: f ? nomAffiche(f, options.nomsComplets === true) : 'Élève',
      statut: m.statut,
      moi: mes.has(m.eleveId),
      createur: m.eleveId === g.createurEleveId,
    };
  });
  return {
    id: g.id,
    devoirId: g.devoirId,
    statut: g.statut,
    motif: g.motif || undefined,
    membres,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
  };
}

/** Tous les groupes d'une activité. */
export async function groupesDe(devoirId: string): Promise<GroupeDoc[]> {
  try {
    const snap = await adminDb.collection('portfolioGroupes').where('devoirId', '==', devoirId).get();
    return snap.docs.map(docToGroupe);
  } catch (e: unknown) {
    if ((e as { code?: number }).code === 5) return [];
    throw e;
  }
}

/**
 * LE groupe d'un élève pour cette activité : celui où il figure et qui n'est
 * pas refusé — à défaut le dernier refusé (pour qu'il lise le motif).
 */
export async function groupeDe(devoirId: string, eleveIds: string[]): Promise<GroupeDoc | null> {
  const tous = (await groupesDe(devoirId)).filter((g) => g.membres.some((m) => eleveIds.includes(m.eleveId)));
  const vivant = tous.filter((g) => g.statut !== 'refuse').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (vivant.length > 0) return vivant[0];
  return tous.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
}

/**
 * Les camarades qu'un élève peut inviter : les élèves de SES classes qui
 * reçoivent l'activité (classes désignées par nom dans `devoir.classes`),
 * lui-même exclu. Prénom + initiale — pas plus que ce que la classe sait.
 */
export async function camaradesDe(
  devoir: { classes?: unknown },
  identite: IdentiteEleve
): Promise<{ camarades: CamaradeVue[]; mesFiches: string[] }> {
  const nomsActivite = Array.isArray(devoir.classes) ? (devoir.classes as string[]) : [];
  const classeIds: string[] = [];
  identite.classeIds.forEach((id, i) => {
    if (nomsActivite.includes(identite.classeNoms[i] ?? '')) classeIds.push(id);
  });
  // Les noms sont rangés dans l'ordre de résolution : par prudence, on
  // relit les classes si l'alignement a échoué
  const ids = classeIds.length > 0 ? classeIds : identite.classeIds;
  if (ids.length === 0) return { camarades: [], mesFiches: identite.eleveIds };
  const snap = await adminDb.collection('eleves').where('classeId', 'in', ids.slice(0, 10)).get();
  const camarades = snap.docs
    .map(ficheDe)
    .filter((f) => !identite.eleveIds.includes(f.eleveId))
    .map((f) => ({ eleveId: f.eleveId, nom: nomAffiche(f, false) }))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  return { camarades, mesFiches: identite.eleveIds };
}

/** Le prof peut-il gérer les groupes de cette activité ? (auteur, titulaire ou coprof en écriture) */
export async function profPeutGerer(devoirId: string, auth: AuthProf & { isAdmin?: boolean }): Promise<boolean> {
  if (auth.isAdmin) return true;
  const acces = await accesDevoir(devoirId, auth);
  if (!acces) return false;
  if (acces.auteur) return true;
  return [...acces.classes.values()].some((a) => peutAgir(a));
}
