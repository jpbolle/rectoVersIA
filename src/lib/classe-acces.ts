// ═══ QUI PEUT QUOI SUR UNE CLASSE, UNE ACTIVITÉ, UNE COPIE ═══
//
// Serveur uniquement. Depuis le 2026-10-04, une classe peut être partagée avec
// un COPROFESSEUR (un remplaçant). Avant, chaque route comparait `profId` à la
// main ; ce fichier est désormais la seule porte pour :
//
//   - une classe   : `accesClasse`          — titulaire, ou coprofesseur ;
//   - une activité : `accesDevoir`          — son auteur, ou le titulaire /
//                                             coprofesseur d'une classe qu'elle vise ;
//   - une copie    : `accesTravail`         — par la SESSION de la copie.
//
// ⚠ LA PORTÉE : un coprofesseur ne voit et ne touche QUE les sessions, copies et
// corrections de la classe partagée — jamais celles des autres classes d'une
// même activité. Et personne ne modifie une activité qu'il n'a pas créée
// (décision de JP) : PATCH / DELETE d'une activité restent à son auteur.
//
// Pas d'exception admin ici : avant le partage, ces routes n'en faisaient pas
// non plus. Le partage ajoute une porte, il n'en élargit aucune autre.

import { adminAuth, adminDb } from '@/lib/firebase/admin';
import type { AccesClasse, ClassePartage } from '@/types/classe';

export interface AuthProf {
  uid: string;
  email?: string | null;
}

// ─── Partages ────────────────────────────────────────────────────────────

/** Nettoie une liste de partages : minuscules, sans doublon, jamais `undefined`. */
export function normaliserPartagesClasse(raw: unknown): ClassePartage[] {
  if (!Array.isArray(raw)) return [];
  const vus = new Set<string>();
  const out: ClassePartage[] = [];
  for (const item of raw) {
    const p = item as Partial<ClassePartage>;
    const email = typeof p?.email === 'string' ? p.email.toLowerCase().trim() : '';
    if (!email || vus.has(email)) continue;
    vus.add(email);
    out.push({
      email,
      // Jamais `undefined` : Firestore le refuse, et ces objets sont réécrits
      nom: typeof p.nom === 'string' ? p.nom : '',
      mode: p.mode === 'edition' ? 'edition' : 'lecture',
    });
  }
  return out;
}

function emailDe(auth: AuthProf): string {
  return (auth.email || '').toLowerCase().trim();
}

/** Mon accès à une classe, d'après son document. `null` = aucun. */
export function accesClasseDepuisDoc(
  data: { profId?: unknown; partages?: unknown } | undefined | null,
  auth: AuthProf
): AccesClasse | null {
  if (!data) return null;
  if (data.profId === auth.uid) return 'titulaire';
  const email = emailDe(auth);
  if (!email) return null;
  const partage = normaliserPartagesClasse(data.partages).find((p) => p.email === email);
  return partage ? partage.mode : null;
}

/** Peut-on AGIR (corriger, ouvrir, publier…) avec cet accès ? */
export function peutAgir(acces: AccesClasse | 'auteur' | null | undefined): boolean {
  return acces === 'titulaire' || acces === 'edition' || acces === 'auteur';
}

/** Mon accès à une classe, par son id. */
export async function accesClasse(
  classeId: string,
  auth: AuthProf
): Promise<{ acces: AccesClasse; data: FirebaseFirestore.DocumentData } | null> {
  if (!classeId) return null;
  const snap = await adminDb.collection('classes').doc(classeId).get();
  if (!snap.exists) return null;
  const acces = accesClasseDepuisDoc(snap.data(), auth);
  return acces ? { acces, data: snap.data()! } : null;
}

/** Les classes partagées AVEC moi (pas les miennes). */
export async function classesPartageesAvecMoi(
  auth: AuthProf
): Promise<FirebaseFirestore.QueryDocumentSnapshot[]> {
  const email = emailDe(auth);
  if (!email) return [];
  // `partageEmails` : les mêmes emails que `partages`, à plat — Firestore ne
  // sait pas chercher dans un tableau d'objets. Index simple, automatique.
  const snap = await adminDb
    .collection('classes')
    .where('partageEmails', 'array-contains', email)
    .get();
  return snap.docs.filter((d) => d.data().profId !== auth.uid);
}

/** Les ids de TOUTES les classes où j'ai un accès (miennes + partagées). */
export async function classesAccessibles(
  auth: AuthProf
): Promise<Map<string, { acces: AccesClasse; nom: string; partagee: boolean }>> {
  const [miennes, partagees] = await Promise.all([
    adminDb.collection('classes').where('profId', '==', auth.uid).get(),
    classesPartageesAvecMoi(auth),
  ]);
  const out = new Map<string, { acces: AccesClasse; nom: string; partagee: boolean }>();
  miennes.docs.forEach((d) =>
    out.set(d.id, {
      acces: 'titulaire',
      nom: d.data().nom || '',
      // Une de mes classes n'accueille l'activité d'un autre que si je l'ai
      // partagée : c'est ce qui permet de ne pas tout relire à chaque fois
      partagee:
        d.data().aEuDesCoprofs === true ||
        (Array.isArray(d.data().partageEmails) && d.data().partageEmails.length > 0),
    })
  );
  partagees.forEach((d) => {
    const acces = accesClasseDepuisDoc(d.data(), auth);
    if (acces) out.set(d.id, { acces, nom: d.data().nom || '', partagee: true });
  });
  return out;
}

// ─── Activités ───────────────────────────────────────────────────────────

export interface AccesDevoir {
  devoir: FirebaseFirestore.DocumentData;
  /** Je suis l'auteur de l'activité (seul à pouvoir la modifier) */
  auteur: boolean;
  /**
   * Les classes de cette activité où j'ai un droit, et lequel. 'auteur' = une
   * de MES classes, pour une activité à moi. Vide quand `sessionIds` est null.
   */
  classes: Map<string, AccesClasse | 'auteur'>;
  /** Les sessions que je peux voir (ids). `null` = toutes, sans filtre. */
  sessionIds: Set<string> | null;
}

/**
 * Le droit de l'AUTEUR d'une activité sur une de ses classes.
 *
 * ⚠ Être l'auteur ne suffit pas : un remplaçant qui a créé une activité pour
 * la classe du titulaire ne doit plus en voir les copies le jour où le
 * titulaire lui retire l'accès (ou le repasse en lecture). Sa propre classe —
 * ou une classe disparue, comportement d'avant le partage — lui reste acquise ;
 * celle d'un collègue ne vaut que ce que le partage lui laisse AUJOURD'HUI.
 */
async function droitDeLAuteur(
  classeId: string,
  auth: AuthProf
): Promise<AccesClasse | 'auteur' | null> {
  if (!classeId) return 'auteur';
  const snap = await adminDb.collection('classes').doc(classeId).get();
  if (!snap.exists || snap.data()!.profId === auth.uid) return 'auteur';
  return accesClasseDepuisDoc(snap.data(), auth);
}

/**
 * Mon accès à une activité.
 *
 * On passe par ses SESSIONS : chaque session désigne une classe, et c'est mon
 * droit sur cette classe qui décide. L'auteur garde tout sur SES classes ; sur
 * celle d'un collègue, il n'a que ce que le partage lui laisse.
 * Une activité sans session est synchronisée — mais seulement si l'une des
 * classes qu'elle vise m'est accessible : un compte prof quelconque ne déclenche
 * aucune écriture en devinant un identifiant.
 */
export async function accesDevoir(
  devoirId: string,
  auth: AuthProf
): Promise<AccesDevoir | null> {
  if (!devoirId) return null;
  const snap = await adminDb.collection('devoirs').doc(devoirId).get();
  if (!snap.exists) return null;
  const devoir = snap.data()!;
  const auteur = devoir.profId === auth.uid;

  let sessionsSnap = await adminDb.collection('sessions').where('devoirId', '==', devoirId).get();

  if (auteur) {
    const classeIds = [...new Set(sessionsSnap.docs.map((d) => String(d.data().classeId || '')))];
    const droits = await Promise.all(classeIds.map((id) => droitDeLAuteur(id, auth)));
    // Le cas courant : rien que mes classes — aucun filtre, comme avant
    if (droits.every((d) => d === 'auteur')) {
      return { devoir, auteur: true, classes: new Map(), sessionIds: null };
    }
    const classes = new Map<string, AccesClasse | 'auteur'>();
    classeIds.forEach((id, i) => {
      if (droits[i]) classes.set(id, droits[i]!);
    });
    const sessionIds = new Set(
      sessionsSnap.docs.filter((d) => classes.has(String(d.data().classeId || ''))).map((d) => d.id)
    );
    return { devoir, auteur: true, classes, sessionIds };
  }

  if (sessionsSnap.empty) {
    const candidates = await classesDeLActivite(devoir);
    const accessibles = await Promise.all(candidates.map((c) => accesClasse(c.id, auth)));
    if (!accessibles.some(Boolean)) return null;
    // Import tardif : session-server importe ce fichier
    const { syncSessions } = await import('@/lib/session-server');
    await syncSessions(devoirId);
    sessionsSnap = await adminDb.collection('sessions').where('devoirId', '==', devoirId).get();
  }

  const classeIds = [...new Set(sessionsSnap.docs.map((d) => String(d.data().classeId || '')))].filter(Boolean);
  const classes = new Map<string, AccesClasse | 'auteur'>();
  await Promise.all(
    classeIds.map(async (id) => {
      const c = await accesClasse(id, auth);
      if (c) classes.set(id, c.acces);
    })
  );
  if (classes.size === 0) return null;

  const sessionIds = new Set(
    sessionsSnap.docs.filter((d) => classes.has(String(d.data().classeId))).map((d) => d.id)
  );
  return { devoir, auteur: false, classes, sessionIds };
}

/** Mon accès à UNE session d'une activité. */
export function accesSessionDepuis(
  acces: AccesDevoir,
  session: { classeId?: unknown } | null | undefined
): AccesClasse | 'auteur' | null {
  if (acces.sessionIds === null) return 'auteur';
  if (!session) return null;
  return acces.classes.get(String(session.classeId || '')) ?? null;
}

/**
 * Une copie passe-t-elle le filtre des sessions ? Une copie SANS session ne
 * s'ouvre qu'à l'auteur de l'activité, comme avant le partage.
 */
export function copieVisible(acces: AccesDevoir, sessionId: unknown): boolean {
  if (acces.sessionIds === null) return true;
  if (!sessionId) return acces.auteur;
  return acces.sessionIds.has(String(sessionId));
}

/** Mon accès à une session, par son id (`PATCH /api/sessions/[id]`, parties en direct). */
export async function accesSession(
  sessionId: string,
  auth: AuthProf
): Promise<{ acces: AccesClasse | 'auteur'; data: FirebaseFirestore.DocumentData } | null> {
  if (!sessionId) return null;
  const snap = await adminDb.collection('sessions').doc(sessionId).get();
  if (!snap.exists) return null;
  const data = snap.data()!;
  if (data.profId === auth.uid) {
    // Mon activité : ma classe, ou celle d'un collègue selon son partage actuel
    const droit = await droitDeLAuteur(String(data.classeId || ''), auth);
    return droit ? { acces: droit, data } : null;
  }
  // Session d'une activité qui n'est pas la mienne : c'est la CLASSE qui décide
  const c = await accesClasse(String(data.classeId || ''), auth);
  return c ? { acces: c.acces, data } : null;
}

// ─── Copies ──────────────────────────────────────────────────────────────

/** Mon accès (prof) à une copie — par sa SESSION. */
export async function accesTravail(
  travail: FirebaseFirestore.DocumentData,
  auth: AuthProf,
  dejaLu?: AccesDevoir | null
): Promise<{ acces: AccesClasse | 'auteur'; devoir: AccesDevoir } | null> {
  const devoir = dejaLu ?? (await accesDevoir(String(travail.devoirId || ''), auth));
  if (!devoir) return null;
  if (devoir.sessionIds === null) return { acces: 'auteur', devoir };
  const sid = travail.sessionId ? String(travail.sessionId) : '';
  if (!sid) return devoir.auteur ? { acces: 'auteur', devoir } : null;
  if (!devoir.sessionIds.has(sid)) return null;
  const sessionSnap = await adminDb.collection('sessions').doc(sid).get();
  const acces = accesSessionDepuis(devoir, sessionSnap.data());
  return acces ? { acces, devoir } : null;
}

// ─── Résolution des classes d'une activité ───────────────────────────────

const emailParUid = new Map<string, string>();

async function emailDeLUid(uid: string): Promise<string> {
  if (emailParUid.has(uid)) return emailParUid.get(uid)!;
  try {
    const user = await adminAuth.getUser(uid);
    const email = (user.email || '').toLowerCase();
    emailParUid.set(uid, email);
    return email;
  } catch {
    return '';
  }
}

/**
 * Les classes que désigne une activité.
 *
 * Une activité nomme ses classes par leur NOM, et un nom n'est unique que chez
 * un même prof. On cherche donc chez son AUTEUR : ses propres classes, puis
 * celles qu'on lui a partagées EN ÉCRITURE — c'est ce qui permet à un
 * remplaçant de donner ses propres activités à la classe du titulaire.
 *
 * Homonymie : si l'auteur a lui-même une classe de ce nom, c'est la sienne qui
 * l'emporte (le formulaire de création grise d'ailleurs la classe partagée
 * homonyme — pas de devinette).
 *
 * Seule source pour `syncSessions` et `ensureTravaux`, qui avaient chacun leur
 * copie de la même requête.
 */
export async function classesDeLActivite(
  devoir: { profId?: unknown; classes?: unknown }
): Promise<Array<{ id: string; nom: string; anneeScolaire: string }>> {
  const profId = String(devoir.profId || '');
  const noms: string[] = Array.isArray(devoir.classes) ? (devoir.classes as string[]) : [];
  if (!profId || noms.length === 0) return [];

  const out: Array<{ id: string; nom: string; anneeScolaire: string }> = [];
  const nomsTrouves = new Set<string>();

  // Firestore limite `in` à 30 valeurs
  for (let i = 0; i < noms.length; i += 30) {
    const snap = await adminDb
      .collection('classes')
      .where('profId', '==', profId)
      .where('nom', 'in', noms.slice(i, i + 30))
      .get();
    snap.docs.forEach((d) => {
      out.push({ id: d.id, nom: d.data().nom || '', anneeScolaire: d.data().anneeScolaire || '' });
      nomsTrouves.add(d.data().nom || '');
    });
  }

  const restants = noms.filter((n) => !nomsTrouves.has(n));
  if (restants.length === 0) return out;

  const email = await emailDeLUid(profId);
  if (!email) return out;
  const partagees = (await classesPartageesAvecMoi({ uid: profId, email })).filter(
    // Seul un coprofesseur EN ÉCRITURE peut donner une activité à la classe
    (d) => accesClasseDepuisDoc(d.data(), { uid: profId, email }) === 'edition'
  );
  restants.forEach((nom) => {
    const memeNom = partagees.filter((d) => d.data().nom === nom);
    // Deux collègues qui partagent chacun une « 4B » : le nom ne dit pas
    // laquelle — on n'en rattache aucune plutôt que de remplir les deux
    // (le formulaire de création les montre d'ailleurs grisées)
    if (memeNom.length !== 1) return;
    const d = memeNom[0];
    out.push({ id: d.id, nom: d.data().nom || '', anneeScolaire: d.data().anneeScolaire || '' });
  });
  return out;
}

/** « Prénom Nom » d'un prof, pour dire de qui est une activité ou une classe. */
export async function nomDuProf(uid: string): Promise<string> {
  if (!uid) return '';
  const email = await emailDeLUid(uid);
  if (email) {
    const prof = await adminDb.collection('professeurs').doc(email).get();
    const p = prof.data() as { prenom?: string; nom?: string } | undefined;
    const nom = `${p?.prenom || ''} ${p?.nom || ''}`.trim();
    if (nom) return nom;
  }
  try {
    return (await adminAuth.getUser(uid)).displayName || email || '';
  } catch {
    return email;
  }
}
