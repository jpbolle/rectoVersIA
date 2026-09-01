// Sessions : lecture, création et résolution côté serveur.
//
// Accès SERVEUR UNIQUEMENT (adminDb) — aucune règle Firestore à écrire, comme
// pour `scenarisations`, `oeuvres` et `certificationsEleves`.
//
// Trois services :
//   - `syncSessions`  : aligner les sessions sur les classes d'une activité ;
//   - `sessionsDuDevoir` : les lire, pour le prof ;
//   - `etatEffectif`  : ce qu'un élève doit VOIR — la session si elle existe,
//                       le devoir sinon.

import { adminDb } from '@/lib/firebase/admin';
import { calculateSchoolYear } from '@/lib/auth-utils';
import { queryElevesByEmail } from '@/lib/eleve-lookup';
import { sessionId } from '@/types/session';
import type { Session } from '@/types/session';

interface DocSession {
  [k: string]: unknown;
}

function toISO(v: unknown): string | null {
  if (!v) return null;
  const d = v as { toDate?: () => Date };
  if (typeof d.toDate === 'function') return d.toDate().toISOString();
  if (v instanceof Date) return v.toISOString();
  return typeof v === 'string' ? v : null;
}

function docToSession(id: string, data: DocSession): Session {
  return {
    id,
    devoirId: String(data.devoirId ?? ''),
    classeId: String(data.classeId ?? ''),
    classeNom: String(data.classeNom ?? ''),
    anneeScolaire: String(data.anneeScolaire ?? ''),
    profId: String(data.profId ?? ''),
    dateRemise: toISO(data.dateRemise),
    disponible: data.disponible === true,
    disponibleAt: toISO(data.disponibleAt),
    corrigeDisponible: data.corrigeDisponible === true,
    corrigeDisponibleAt: toISO(data.corrigeDisponibleAt),
    archive: data.archive === true,
    createdAt: toISO(data.createdAt) ?? '',
    updatedAt: toISO(data.updatedAt) ?? '',
  };
}

/** Les sessions d'une activité, classe par classe (ordre alphabétique). */
export async function sessionsDuDevoir(devoirId: string): Promise<Session[]> {
  const snap = await adminDb
    .collection('sessions')
    .where('devoirId', '==', devoirId)
    .get();
  return snap.docs
    .map((d) => docToSession(d.id, d.data()))
    .sort((a, b) => a.classeNom.localeCompare(b.classeNom));
}

/**
 * Aligne les sessions sur les classes de l'activité.
 *
 * CRÉE seulement — une classe retirée de l'activité laisse sa session en
 * place : ses élèves ont des copies, et les effacer d'un décochage silencieux
 * serait une perte de données. C'est au prof de l'archiver s'il le veut.
 *
 * Une session créée HÉRITE des drapeaux du devoir : la première fois, toutes
 * les classes se retrouvent donc dans l'état qu'elles avaient avant que les
 * sessions existent. Rien ne change à l'écran tant que le prof ne les dissocie
 * pas lui-même.
 */
export async function syncSessions(devoirId: string): Promise<number> {
  const devoirSnap = await adminDb.collection('devoirs').doc(devoirId).get();
  if (!devoirSnap.exists) return 0;
  const devoir = devoirSnap.data()!;
  const profId: string = devoir.profId || '';
  const noms: string[] = Array.isArray(devoir.classes) ? devoir.classes : [];
  if (!profId || noms.length === 0) return 0;

  // Noms de classes -> documents. Firestore limite `in` à 30 valeurs.
  const classes: Array<{ id: string; nom: string; anneeScolaire: string }> = [];
  for (let i = 0; i < noms.length; i += 30) {
    const snap = await adminDb
      .collection('classes')
      .where('profId', '==', profId)
      .where('nom', 'in', noms.slice(i, i + 30))
      .get();
    snap.docs.forEach((d) =>
      classes.push({
        id: d.id,
        nom: d.data().nom || '',
        anneeScolaire: d.data().anneeScolaire || '',
      })
    );
  }
  if (classes.length === 0) return 0;

  const existantes = await sessionsDuDevoir(devoirId);
  const dejaLa = new Set(existantes.map((s) => s.classeId));

  const batch = adminDb.batch();
  let creees = 0;
  const nouvelles: string[] = [];
  const maintenant = new Date();

  classes.forEach((c) => {
    if (dejaLa.has(c.id)) return;
    const id = sessionId(devoirId, c.id);
    batch.set(adminDb.collection('sessions').doc(id), {
      id,
      devoirId,
      classeId: c.id,
      classeNom: c.nom,
      // ── L'ANNÉE DE LA SESSION EST CELLE OÙ ELLE COMMENCE ──
      // Ni celle de la classe (mal étiquetée jusqu'au 2026-09-01 : deux règles
      // d'année scolaire se contredisaient, cf. `classe-utils`), ni celle de
      // l'activité (qui pourra resservir d'une année sur l'autre). Une session
      // ouverte aujourd'hui appartient à l'année d'aujourd'hui, par définition.
      anneeScolaire: calculateSchoolYear(),
      profId,
      dateRemise: devoir.dateRemise ?? null,
      disponible: devoir.disponible ?? true,
      disponibleAt: devoir.disponibleAt ?? null,
      corrigeDisponible: devoir.corrigeDisponible === true,
      corrigeDisponibleAt: devoir.corrigeDisponibleAt ?? null,
      archive: devoir.archive === true,
      createdAt: maintenant,
      updatedAt: maintenant,
    });
    nouvelles.push(id);
    creees++;
  });

  if (creees > 0) {
    await batch.commit();
    // Une session naît souvent DÉJÀ ouverte (elle hérite de l'activité) : elle
    // doit alors figer son questionnaire aussitôt, comme si on venait de
    // l'ouvrir à la main.
    if (devoir.disponible ?? true) {
      await Promise.all(nouvelles.map((id) => figerQuizDeLaSession(id, devoirId)));
    }
  }

  // ── RATTRAPAGE DES SESSIONS OUVERTES AVANT LE FIGEAGE ──
  // Celles d'avant le 2026-09-01 sont ouvertes sans copie figée : si le
  // questionnaire de la bibliothèque changeait, les réponses déjà données
  // seraient relues avec d'autres questions. On les fige à la première
  // consultation du professeur — le questionnaire n'ayant pas bougé depuis,
  // la copie prise MAINTENANT est bien celle que les élèves ont eue.
  // `figerQuizDeLaSession` rend la main aussitôt si la session est déjà figée :
  // le coût est d'une lecture par session, et seulement côté prof.
  const aRattraper = existantes.filter((s) => s.disponible && !nouvelles.includes(s.id));
  if (aRattraper.length > 0) {
    await Promise.all(aRattraper.map((s) => figerQuizDeLaSession(s.id, devoirId)));
  }

  return creees;
}

/** Les identifiants de classes d'un élève (par UID, puis par email). */
export async function classesDeLEleve(uid: string, email: string): Promise<string[]> {
  const [byUid, byEmail] = await Promise.all([
    adminDb.collection('eleves').where('firebaseUid', '==', uid).get(),
    queryElevesByEmail(email),
  ]);
  const ids = new Set<string>();
  [...byUid.docs, ...byEmail.docs].forEach((d) => {
    const c = d.data().classeId;
    if (c) ids.add(c);
  });
  return [...ids];
}

export interface EtatEffectif {
  disponible: boolean;
  corrigeDisponible: boolean;
  dateRemise: string | null;
  /** false = aucune session ne couvre cet élève, on a lu le devoir */
  parSession: boolean;
}

/**
 * Ce qu'un élève doit voir d'une activité.
 *
 * La session prime, le devoir sert de repli — c'est ce repli qui rend la
 * migration indolore : une activité sans session se comporte comme avant.
 *
 * Un élève inscrit dans DEUX classes couvertes par la même activité (rare, mais
 * le modèle l'autorise) : on prend le parti le plus sûr de chaque côté —
 * le corrigé n'apparaît que si TOUTES ses sessions l'ouvrent (sinon on livrerait
 * les réponses à la classe qui n'a pas encore passé l'épreuve), l'activité est
 * ouverte dès qu'UNE le dit (sinon il perdrait l'accès à son propre travail).
 */
export function etatEffectif(
  devoir: { disponible?: boolean; corrigeDisponible?: boolean; dateRemise?: string | null },
  sessions: Session[]
): EtatEffectif {
  if (sessions.length === 0) {
    return {
      disponible: devoir.disponible ?? true,
      corrigeDisponible: devoir.corrigeDisponible === true,
      dateRemise: devoir.dateRemise ?? null,
      parSession: false,
    };
  }
  return {
    disponible: sessions.some((s) => s.disponible),
    corrigeDisponible: sessions.every((s) => s.corrigeDisponible),
    // La plus proche des échéances posées ; aucune si elles sont toutes vides
    dateRemise:
      sessions
        .map((s) => s.dateRemise)
        .filter((d): d is string => !!d)
        .sort()[0] ?? null,
    parSession: true,
  };
}

/**
 * TOUTES les sessions des classes d'un élève, groupées par activité.
 *
 * Une seule requête pour toute la liste des activités : lire session par
 * session ferait une vingtaine d'allers-retours à chaque ouverture de page.
 */
export async function sessionsParDevoir(
  classeIds: string[]
): Promise<Map<string, Session[]>> {
  const parDevoir = new Map<string, Session[]>();
  if (classeIds.length === 0) return parDevoir;
  for (let i = 0; i < classeIds.length; i += 30) {
    const snap = await adminDb
      .collection('sessions')
      .where('classeId', 'in', classeIds.slice(i, i + 30))
      .get();
    snap.docs.forEach((d) => {
      const s = docToSession(d.id, d.data());
      const liste = parDevoir.get(s.devoirId) ?? [];
      liste.push(s);
      parDevoir.set(s.devoirId, liste);
    });
  }
  return parDevoir;
}

/**
 * Les sessions qui couvrent cet élève, pour une activité donnée, ET la copie
 * FIGÉE du questionnaire si l'une d'elles en porte une.
 *
 * Les deux voyagent ensemble parce qu'ils viennent des mêmes documents : les
 * lire deux fois serait payer deux fois. `quizFige` est délibérément tenu hors
 * du type `Session` — c'est un questionnaire entier, et il n'a rien à faire
 * dans la liste qu'on envoie au professeur.
 *
 * Tableau vide = aucune session : l'appelant retombe sur les drapeaux du devoir.
 */
export async function sessionsDeLEleve(
  devoirId: string,
  classeIds: string[]
): Promise<{ sessions: Session[]; quizFige: unknown }> {
  if (classeIds.length === 0) return { sessions: [], quizFige: null };
  const lues = await Promise.all(
    classeIds.map((c) => adminDb.collection('sessions').doc(sessionId(devoirId, c)).get())
  );
  const presentes = lues.filter((d) => d.exists);
  return {
    sessions: presentes.map((d) => docToSession(d.id, d.data()!)),
    quizFige: presentes.map((d) => d.data()!.quizFige).find((q) => !!q) ?? null,
  };
}

/**
 * ═══ LE FIGEAGE ═══
 *
 * À l'instant où une session s'ouvre, elle prend une COPIE du questionnaire.
 * C'est cette copie que ses élèves liront, et qui servira à relire leurs
 * réponses — pour toujours.
 *
 * Pourquoi : le questionnaire vit désormais dans la bibliothèque et sera
 * amélioré d'une année sur l'autre. Sans copie, les réponses de l'an dernier
 * seraient relues avec les questions de cette année : les numéros ne
 * désigneraient plus les mêmes choses, et les corrigés déjà en base
 * pointeraient à côté.
 *
 * ON NE FIGE QU'UNE FOIS, à la première ouverture, et **il n'y a pas de
 * resynchronisation** — décision de JP le 2026-09-01 : retoucher un
 * questionnaire pendant l'épreuve est une habitude de jeunesse de
 * l'application, pas un besoin à outiller.
 *
 * Un échec ici ne doit jamais empêcher une ouverture : l'activité s'ouvre, et
 * `quizDuDevoir` retombe sur la bibliothèque. On perd le figeage, pas le cours.
 */
export async function figerQuizDeLaSession(
  sessionIdOuDoc: string,
  devoirId: string
): Promise<boolean> {
  try {
    const ref = adminDb.collection('sessions').doc(sessionIdOuDoc);
    const snap = await ref.get();
    if (!snap.exists || snap.data()!.quizFige) return false;

    const devoirSnap = await adminDb.collection('devoirs').doc(devoirId).get();
    if (!devoirSnap.exists) return false;
    const devoir = devoirSnap.data()!;
    if (devoir.typeTravail !== 'lire') return false;

    // Import tardif : `questionnaire-lecture-server` importe déjà ce fichier,
    // et un import croisé en tête figerait le module à moitié construit.
    const { quizDuDevoir } = await import('@/lib/questionnaire-lecture-server');
    const { lectureQuizPourFirestore } = await import('@/lib/lecture-server');

    const quiz = await quizDuDevoir(devoir);
    if (!quiz?.questions?.length) return false;

    await ref.update({
      quizFige: lectureQuizPourFirestore(quiz),
      quizFigeAt: new Date(),
      updatedAt: new Date(),
    });
    return true;
  } catch (err) {
    console.error('Erreur figeage du questionnaire de session:', err);
    return false;
  }
}
