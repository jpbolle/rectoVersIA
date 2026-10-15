// ═══ Consommation de l'IA : trace, surveillance, coupure (2026-10-15) ═══
//
// SERVEUR UNIQUEMENT (adminDb). Plan : harnais/plans/2026-10-15-gestion-couts-ia.md
//
// Né de l'incident du 2026-10-14 : 232 générations de vocabulaire ratées,
// toutes facturées, passées inaperçues six jours. Désormais :
//  - chaque appel Claude laisse UNE ligne dans `consommationIa` (réussi ou
//    raté, avec son coût) — c'est `suivreIa()` (src/lib/claude.ts) qui l'écrit ;
//  - une surveillance EN DIRECT, en mémoire du serveur, compte les échecs de
//    chaque activité sur l'heure écoulée : au-delà du seuil, alerte, puis
//    coupure de l'IA pour CETTE activité seulement (réactivable par l'admin) ;
//  - le coût du jour et les appels par élève déclenchent aussi une alerte.
// La trace ne doit JAMAIS faire échouer l'appel : toute erreur d'écriture est
// avalée (journal PM2 seulement).
//
// RGPD : uid seulement, aucun nom ; lignes purgées après 12 mois.

import { adminDb } from '@/lib/firebase/admin';
import { coutAppel, tarifConnu } from '@/lib/tarifs-ia';
import type { JetonsIa } from '@/lib/tarifs-ia';

export const COLLECTION_CONSOMMATION = 'consommationIa';
export const COLLECTION_ALERTES = 'alertesIa';
export const COLLECTION_SUSPENSIONS = 'iaSuspensions';
/** Date de la dernière réactivation par l'admin : les échecs d'avant ne comptent plus */
export const COLLECTION_REACTIVATIONS = 'iaReactivations';

// ── Seuils (choisis le 2026-10-15, à ajuster à l'usage) ──
export const SEUILS_IA = {
  /** Alerte quand la dépense du jour (toute l'app) dépasse ce montant, en $ */
  coutJour: 2,
  /** Alerte quand une activité dépasse ce montant dans la journée, en $ */
  coutActiviteJour: 1,
  /** Nombre minimal d'appels sur l'heure avant de juger un taux d'échec */
  appelsMinimum: 10,
  /** Taux d'échec d'une activité sur l'heure : alerte */
  tauxEchecAlerte: 0.2,
  /** Taux d'échec d'une activité sur l'heure : COUPURE de l'IA de l'activité */
  tauxEchecCoupure: 0.5,
  /** Appels d'un même élève dans la journée : alerte */
  appelsEleveJour: 60,
} as const;

/** Qui appelle, pour quoi : ce qui permet le coût par activité */
export interface ContexteIa {
  /** Identifiant stable de la fonction, ex. `vocabulaire.etude` */
  fonction: string;
  uid?: string | null;
  role?: string | null;
  /** L'activité (devoir) ouverte, quand on la connaît */
  devoirId?: string | null;
}

export type StatutAppel = 'ok' | 'erreur';

export interface LigneConsommation {
  at: Date;
  jour: string;
  fonction: string;
  modele: string;
  in: number;
  out: number;
  cacheRead: number;
  cacheWrite: number;
  coutUsd: number;
  tarifInconnu?: boolean;
  statut: StatutAppel;
  erreur?: string | null;
  devoirId: string | null;
  uid: string | null;
  role: string | null;
  dureeMs: number;
}

export interface AlerteIa {
  at: Date;
  type: 'cout_jour' | 'cout_activite' | 'taux_echec' | 'coupure' | 'eleve_appels' | 'erreur_api';
  message: string;
  /** Les lignes de l'enquête : « 12 × Réponse illisible (JSON) — vocabulaire.etude » */
  rapport: string[];
  devoirId?: string | null;
  uid?: string | null;
  vue: boolean;
}

/** Date du jour à Bruxelles, `AAAA-MM-JJ` */
export function jourBruxelles(d: Date = new Date()): string {
  return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Brussels' });
}

/** Message d'erreur lisible et court, pour la trace et les regroupements */
export function messageErreur(e: unknown): string {
  let m = e instanceof Error ? e.message : String(e);
  // Erreur de l'API : son message propre plutôt que le JSON brut
  const interne = (e as { error?: { error?: { message?: unknown } } } | null)?.error?.error?.message;
  if (typeof interne === 'string' && interne) m = interne;
  const statut = (e as { status?: number } | null)?.status;
  if (typeof statut === 'number') m = `[${statut}] ${m}`;
  return m.slice(0, 300);
}

/** Regroupe des messages qui ne diffèrent que par des nombres (positions JSON…) */
export function cleErreur(m: string): string {
  return m.replace(/\d+/g, '#').slice(0, 120);
}

// ── Coupure de l'IA d'une activité ──────────────────────────────────────────

export class IaSuspendueError extends Error {
  constructor() {
    super(
      'L’aide de l’IA est momentanément suspendue pour cette activité (surveillance des coûts). Préviens ton professeur.'
    );
    this.name = 'IaSuspendueError';
  }
}

/** Pour les `catch` des routes : le message de suspension passe tel quel */
export function messageErreurIa(e: unknown, parDefaut: string): string {
  return e instanceof IaSuspendueError ? e.message : parDefaut;
}

// Cache d'une minute : une lecture Firestore par activité et par minute au plus
const cacheSuspension = new Map<string, { suspendue: boolean; lu: number }>();
const DUREE_CACHE_MS = 60_000;

export async function estSuspendue(devoirId: string): Promise<boolean> {
  const c = cacheSuspension.get(devoirId);
  if (c && Date.now() - c.lu < DUREE_CACHE_MS) return c.suspendue;
  try {
    const snap = await adminDb.collection(COLLECTION_SUSPENSIONS).doc(devoirId).get();
    cacheSuspension.set(devoirId, { suspendue: snap.exists, lu: Date.now() });
    return snap.exists;
  } catch {
    return false;
  }
}

/** Réactivation par l'admin : efface la coupure et repart d'une fenêtre vide */
export async function reactiverIa(devoirId: string): Promise<void> {
  await adminDb.collection(COLLECTION_SUSPENSIONS).doc(devoirId).delete();
  await adminDb.collection(COLLECTION_REACTIVATIONS).doc(devoirId).set({ at: new Date() });
  cacheSuspension.delete(devoirId);
  fenetres.delete(devoirId);
}

// ── Alertes ─────────────────────────────────────────────────────────────────

/**
 * Écrit une alerte sous un identifiant FIXE (`cle`) : rejouée plusieurs fois
 * (plusieurs processus, surveillance relancée), elle reste une seule alerte.
 * N'écrase pas une alerte déjà marquée « vue ».
 */
export async function leverAlerte(cle: string, alerte: Omit<AlerteIa, 'at' | 'vue'>): Promise<void> {
  const ref = adminDb.collection(COLLECTION_ALERTES).doc(cle);
  try {
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists) return;
      tx.set(ref, { ...alerte, at: new Date(), vue: false });
    });
  } catch (e) {
    console.error('[consommation-ia] alerte non écrite :', e);
  }
}

// ── Surveillance en direct (mémoire du processus) ───────────────────────────
//
// Pas de requête Firestore par appel : des compteurs en mémoire. Ils repartent
// de zéro à chaque redémarrage du serveur (déploiement) — la surveillance
// complète, recalculée depuis la base, tourne à l'ouverture de la page admin.

const UNE_HEURE = 3_600_000;
const fenetres = new Map<string, { t: number; ok: boolean; fonction: string; erreur?: string }[]>();
const compteurs = { jour: '', cout: 0, parEleve: new Map<string, number>(), parActivite: new Map<string, number>() };

export function rapportFenetre(evts: { ok: boolean; fonction: string; erreur?: string | null }[]): string[] {
  const groupes = new Map<string, number>();
  for (const e of evts) {
    if (e.ok) continue;
    const cle = `${cleErreur(e.erreur ?? 'erreur')} — ${e.fonction}`;
    groupes.set(cle, (groupes.get(cle) ?? 0) + 1);
  }
  return [...groupes.entries()].sort((a, b) => b[1] - a[1]).map(([cle, n]) => `${n} × ${cle}`);
}

export async function couper(
  devoirId: string,
  rapport: string[],
  taux: number,
  total: number,
  raisonManuelle?: string
): Promise<void> {
  try {
    await adminDb.collection(COLLECTION_SUSPENSIONS).doc(devoirId).set({
      at: new Date(),
      raison: raisonManuelle ?? `${Math.round(taux * 100)} % d’échecs sur ${total} appels en une heure`,
      rapport,
    });
    cacheSuspension.set(devoirId, { suspendue: true, lu: Date.now() });
  } catch (e) {
    console.error('[consommation-ia] coupure non écrite :', e);
    return;
  }
  if (raisonManuelle) return;
  const heure = new Date().toISOString().slice(0, 13);
  await leverAlerte(`coupure_${devoirId}_${heure}`, {
    type: 'coupure',
    devoirId,
    message: `IA coupée pour une activité : ${Math.round(taux * 100)} % d’échecs sur ${total} appels en une heure. Réactivable dans Gestion des coûts.`,
    rapport,
  });
}

function observer(ligne: LigneConsommation): void {
  // Compteurs du jour (remis à zéro au changement de date)
  if (compteurs.jour !== ligne.jour) {
    compteurs.jour = ligne.jour;
    compteurs.cout = 0;
    compteurs.parEleve.clear();
    compteurs.parActivite.clear();
  }
  compteurs.cout += ligne.coutUsd;
  if (compteurs.cout > SEUILS_IA.coutJour) {
    void leverAlerte(`cout_jour_${ligne.jour}`, {
      type: 'cout_jour',
      message: `La dépense IA du jour dépasse ${SEUILS_IA.coutJour} $.`,
      rapport: [],
    });
  }
  if (ligne.uid && ligne.role === 'eleve') {
    const n = (compteurs.parEleve.get(ligne.uid) ?? 0) + 1;
    compteurs.parEleve.set(ligne.uid, n);
    if (n === SEUILS_IA.appelsEleveJour) {
      void leverAlerte(`eleve_${ligne.uid}_${ligne.jour}`, {
        type: 'eleve_appels',
        uid: ligne.uid,
        devoirId: ligne.devoirId,
        message: `Un élève a déjà fait ${n} appels à l’IA aujourd’hui.`,
        rapport: [],
      });
    }
  }
  // L'API a refusé l'appel lui-même (limite de dépense atteinte, clé, surcharge) :
  // rien n'est facturé, mais toute l'IA de l'app est peut-être à l'arrêt
  const nonFacture = ligne.statut === 'erreur' && ligne.coutUsd === 0;
  if (nonFacture) {
    const heure = new Date().toISOString().slice(0, 13);
    void leverAlerte(`erreur_api_${heure}`, {
      type: 'erreur_api',
      message: 'L’API Claude refuse des appels (limite de dépense atteinte ? clé ? surcharge ?).',
      rapport: [`${ligne.erreur ?? 'erreur'} — ${ligne.fonction}`],
    });
  }
  // La coupure vise l'hémorragie : seuls les appels FACTURÉS entrent dans la fenêtre
  if (!ligne.devoirId || nonFacture) return;
  const devoirId = ligne.devoirId;

  const coutActivite = (compteurs.parActivite.get(devoirId) ?? 0) + ligne.coutUsd;
  compteurs.parActivite.set(devoirId, coutActivite);
  if (coutActivite > SEUILS_IA.coutActiviteJour) {
    void leverAlerte(`cout_activite_${devoirId}_${ligne.jour}`, {
      type: 'cout_activite',
      devoirId,
      message: `Une activité dépasse ${SEUILS_IA.coutActiviteJour} $ de dépense IA aujourd’hui.`,
      rapport: [],
    });
  }

  // Taux d'échec sur l'heure glissante
  const maintenant = Date.now();
  const evts = (fenetres.get(devoirId) ?? []).filter((e) => maintenant - e.t < UNE_HEURE);
  evts.push({ t: maintenant, ok: ligne.statut === 'ok', fonction: ligne.fonction, erreur: ligne.erreur ?? undefined });
  fenetres.set(devoirId, evts);
  if (evts.length < SEUILS_IA.appelsMinimum) return;

  const echecs = evts.filter((e) => !e.ok).length;
  const taux = echecs / evts.length;
  if (taux >= SEUILS_IA.tauxEchecCoupure) {
    // Fenêtre vidée : après réactivation, il faudra de NOUVEAUX échecs
    fenetres.delete(devoirId);
    void couper(devoirId, rapportFenetre(evts), taux, evts.length);
  } else if (taux >= SEUILS_IA.tauxEchecAlerte) {
    const heure = new Date().toISOString().slice(0, 13);
    void leverAlerte(`taux_echec_${devoirId}_${heure}`, {
      type: 'taux_echec',
      devoirId,
      message: `${Math.round(taux * 100)} % d’échecs IA sur ${evts.length} appels en une heure pour une activité.`,
      rapport: rapportFenetre(evts),
    });
  }
}

// ── Écriture d'une ligne ────────────────────────────────────────────────────

export interface AppelTrace {
  contexte: ContexteIa;
  modele: string;
  jetons: JetonsIa;
  statut: StatutAppel;
  erreur?: string | null;
  dureeMs: number;
}

/** Un appel noté : sa ligne, et la promesse de son document en base */
export interface TraceAppel {
  ligne: LigneConsommation;
  ref: Promise<FirebaseFirestore.DocumentReference | null>;
}

/**
 * Note un appel. Un échec survenu APRÈS l'appel (réponse illisible) met cette
 * même ligne à jour via `marquerEchec` : l'appel a été facturé quand même.
 */
export function noterAppel(a: AppelTrace): TraceAppel {
  const ligne: LigneConsommation = {
    at: new Date(),
    jour: jourBruxelles(),
    fonction: a.contexte.fonction,
    modele: a.modele,
    ...a.jetons,
    coutUsd: coutAppel(a.modele, a.jetons),
    ...(tarifConnu(a.modele) ? {} : { tarifInconnu: true }),
    statut: a.statut,
    erreur: a.erreur ?? null,
    devoirId: a.contexte.devoirId ?? null,
    uid: a.contexte.uid ?? null,
    role: a.contexte.role ?? null,
    dureeMs: a.dureeMs,
  };
  // Un appel « ok » peut encore échouer à la lecture : il n'entre dans la
  // surveillance qu'après un court délai, le temps que la route le juge
  if (ligne.statut === 'erreur') observer(ligne);
  else
    enAttente.set(
      ligne,
      setTimeout(() => {
        enAttente.delete(ligne);
        observer(ligne);
      }, 5_000)
    );
  const ref = adminDb
    .collection(COLLECTION_CONSOMMATION)
    .add(ligne)
    .catch((e) => {
      console.error('[consommation-ia] trace non écrite :', e);
      return null;
    });
  return { ligne, ref };
}

const enAttente = new Map<LigneConsommation, ReturnType<typeof setTimeout>>();

/** L'appel a été facturé mais son résultat est inutilisable */
export function marquerEchec(trace: TraceAppel, e: unknown): void {
  if (trace.ligne.statut === 'erreur') return;
  const erreur = messageErreur(e);
  trace.ligne.statut = 'erreur';
  trace.ligne.erreur = erreur;
  // Encore en attente : compté comme échec (sinon, déjà compté, on n'y touche plus)
  const minuteur = enAttente.get(trace.ligne);
  if (minuteur) {
    clearTimeout(minuteur);
    enAttente.delete(trace.ligne);
    observer(trace.ligne);
  }
  void trace.ref.then((r) => r?.update({ statut: 'erreur', erreur }).catch(() => undefined));
}
