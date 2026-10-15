// ═══ Rapport des coûts IA + surveillance depuis la base (2026-10-15) ═══
//
// SERVEUR UNIQUEMENT. Lu par la page admin « Gestion des coûts »
// (/api/admin/couts) et par la surveillance planifiée
// (/api/admin/couts/surveillance). Plan : harnais/plans/2026-10-15-gestion-couts-ia.md
//
// La surveillance EN DIRECT (consommation-ia.ts) vit en mémoire et repart de
// zéro à chaque redémarrage ; celle-ci recalcule tout depuis `consommationIa`.
// Les deux lèvent les mêmes alertes, sous les mêmes identifiants : jamais de
// doublon.

import { adminDb } from '@/lib/firebase/admin';
import { decrypt } from '@/lib/crypto';
import {
  COLLECTION_ALERTES,
  COLLECTION_CONSOMMATION,
  COLLECTION_REACTIVATIONS,
  COLLECTION_SUSPENSIONS,
  SEUILS_IA,
  cleErreur,
  couper,
  jourBruxelles,
  leverAlerte,
  rapportFenetre,
} from '@/lib/consommation-ia';
import type { LigneConsommation } from '@/lib/consommation-ia';
import type {
  AlerteVue,
  CompteCouts,
  CoutActivite,
  CoutConsole,
  CoutEleve,
  ErreurFrequente,
  RapportCouts,
  SuspensionVue,
} from '@/types/couts-ia';

type Ligne = LigneConsommation & { at: Date };

const vide = (): CompteCouts => ({ cout: 0, appels: 0, echecs: 0, coutEchecs: 0 });

function ajouter(c: CompteCouts, l: Ligne): void {
  c.cout += l.coutUsd;
  c.appels += 1;
  if (l.statut === 'erreur') {
    c.echecs += 1;
    c.coutEchecs += l.coutUsd;
  }
}

function enDate(v: unknown): Date {
  if (v instanceof Date) return v;
  const t = v as { toDate?: () => Date } | null;
  return t?.toDate ? t.toDate() : new Date(String(v));
}

/** Les lignes d'un intervalle de jours (`AAAA-MM-JJ`, bornes incluses) */
async function lignesEntre(debut: string, fin: string): Promise<Ligne[]> {
  const snap = await adminDb
    .collection(COLLECTION_CONSOMMATION)
    .where('jour', '>=', debut)
    .where('jour', '<=', fin)
    .get();
  return snap.docs.map((d) => {
    const x = d.data() as LigneConsommation;
    return { ...x, at: enDate(x.at) };
  });
}

function ajouterJours(jour: string, n: number): string {
  const d = new Date(`${jour}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function finDuMois(mois: string): string {
  const [a, m] = mois.split('-').map(Number);
  const dernier = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return `${mois}-${String(dernier).padStart(2, '0')}`;
}

// ── Surveillance depuis la base ─────────────────────────────────────────────

/**
 * Applique les seuils aux lignes du jour : coût du jour, coût par activité,
 * appels par élève, et taux d'échec de la dernière heure (coupure comprise).
 */
export async function surveiller(lignesDuJour: Ligne[]): Promise<number> {
  const jour = jourBruxelles();
  const aujourdhui = lignesDuJour.filter((l) => l.jour === jour);
  let alertes = 0;

  const total = aujourdhui.reduce((s, l) => s + l.coutUsd, 0);
  if (total > SEUILS_IA.coutJour) {
    alertes++;
    await leverAlerte(`cout_jour_${jour}`, {
      type: 'cout_jour',
      message: `La dépense IA du jour dépasse ${SEUILS_IA.coutJour} $.`,
      rapport: [],
    });
  }

  const parActivite = new Map<string, Ligne[]>();
  const parEleve = new Map<string, Ligne[]>();
  for (const l of aujourdhui) {
    if (l.devoirId) parActivite.set(l.devoirId, [...(parActivite.get(l.devoirId) ?? []), l]);
    if (l.uid && l.role === 'eleve') parEleve.set(l.uid, [...(parEleve.get(l.uid) ?? []), l]);
  }

  for (const [uid, ls] of parEleve) {
    if (ls.length >= SEUILS_IA.appelsEleveJour) {
      alertes++;
      await leverAlerte(`eleve_${uid}_${jour}`, {
        type: 'eleve_appels',
        uid,
        devoirId: ls[ls.length - 1].devoirId,
        message: `Un élève a déjà fait ${ls.length} appels à l’IA aujourd’hui.`,
        rapport: [],
      });
    }
  }

  const maintenant = Date.now();
  for (const [devoirId, ls] of parActivite) {
    const cout = ls.reduce((s, l) => s + l.coutUsd, 0);
    if (cout > SEUILS_IA.coutActiviteJour) {
      alertes++;
      await leverAlerte(`cout_activite_${devoirId}_${jour}`, {
        type: 'cout_activite',
        devoirId,
        message: `Une activité dépasse ${SEUILS_IA.coutActiviteJour} $ de dépense IA aujourd’hui.`,
        rapport: [],
      });
    }

    // Dernière heure, appels FACTURÉS seulement, et rien d'avant une réactivation
    const reactivation = await adminDb.collection(COLLECTION_REACTIVATIONS).doc(devoirId).get();
    const depuis = Math.max(
      maintenant - 3_600_000,
      reactivation.exists ? enDate(reactivation.data()?.at).getTime() : 0
    );
    const heure = ls.filter(
      (l) => l.at.getTime() >= depuis && !(l.statut === 'erreur' && l.coutUsd === 0)
    );
    if (heure.length < SEUILS_IA.appelsMinimum) continue;
    const echecs = heure.filter((l) => l.statut === 'erreur').length;
    const taux = echecs / heure.length;
    if (taux >= SEUILS_IA.tauxEchecCoupure) {
      const deja = await adminDb.collection(COLLECTION_SUSPENSIONS).doc(devoirId).get();
      if (!deja.exists) {
        alertes++;
        await couper(devoirId, rapportFenetre(heure.map((l) => ({ ok: l.statut === 'ok', fonction: l.fonction, erreur: l.erreur }))), taux, heure.length);
      }
    } else if (taux >= SEUILS_IA.tauxEchecAlerte) {
      alertes++;
      await leverAlerte(`taux_echec_${devoirId}_${new Date().toISOString().slice(0, 13)}`, {
        type: 'taux_echec',
        devoirId,
        message: `${Math.round(taux * 100)} % d’échecs IA sur ${heure.length} appels en une heure pour une activité.`,
        rapport: rapportFenetre(heure.map((l) => ({ ok: l.statut === 'ok', fonction: l.fonction, erreur: l.erreur }))),
      });
    }
  }
  return alertes;
}

/** RGPD : les traces de plus de 12 mois sont effacées (par lots) */
export async function purgerAnciennes(): Promise<number> {
  const limite = new Date(Date.now() - 365 * 86_400_000);
  const snap = await adminDb.collection(COLLECTION_CONSOMMATION).where('at', '<', limite).limit(400).get();
  if (snap.empty) return 0;
  const lot = adminDb.batch();
  snap.docs.forEach((d) => lot.delete(d.ref));
  await lot.commit();
  return snap.size;
}

/** La surveillance complète : celle qu'appelle la tâche planifiée */
export async function surveillanceComplete(): Promise<{ alertes: number; purgees: number }> {
  const jour = jourBruxelles();
  const lignes = await lignesEntre(jour, jour);
  const alertes = await surveiller(lignes);
  const purgees = await purgerAnciennes();
  return { alertes, purgees };
}

// ── Rapprochement avec la console Anthropic ─────────────────────────────────

interface ResultatCout {
  amount?: string | number;
  currency?: string;
  model?: string | null;
  description?: string | null;
}

/**
 * Le coût FACTURÉ, lu dans l'API de coûts d'Anthropic (clé Admin). Couvre
 * toute l'organisation : une autre application sur le même compte s'y ajoute.
 * Montants en cents (chaînes décimales) ; jours en UTC.
 */
async function coutConsole(mois: string): Promise<CoutConsole> {
  const cle = process.env.ANTHROPIC_ADMIN_KEY;
  if (!cle) return { configure: false };
  const debut = `${mois}-01T00:00:00Z`;
  const finMois = new Date(`${ajouterJours(finDuMois(mois), 1)}T00:00:00Z`);
  const fin = (finMois.getTime() < Date.now() ? finMois : new Date()).toISOString();

  const parJour = new Map<string, number>();
  const parModele = new Map<string, number>();
  let page: string | null = null;
  try {
    for (let i = 0; i < 10; i++) {
      const params = new URLSearchParams({ starting_at: debut, ending_at: fin, limit: '31' });
      params.append('group_by[]', 'description');
      if (page) params.set('page', page);
      const res = await fetch(`https://api.anthropic.com/v1/organizations/cost_report?${params}`, {
        headers: { 'x-api-key': cle, 'anthropic-version': '2023-06-01' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        const texte = await res.text();
        return { configure: true, erreur: `[${res.status}] ${texte.slice(0, 200)}` };
      }
      const json = (await res.json()) as {
        data?: { starting_at?: string; results?: ResultatCout[] }[];
        has_more?: boolean;
        next_page?: string | null;
      };
      for (const bucket of json.data ?? []) {
        const jour = String(bucket.starting_at ?? '').slice(0, 10);
        for (const r of bucket.results ?? []) {
          const dollars = Number(r.amount ?? 0) / 100;
          if (!Number.isFinite(dollars)) continue;
          parJour.set(jour, (parJour.get(jour) ?? 0) + dollars);
          const modele = r.model || r.description || 'autre';
          parModele.set(modele, (parModele.get(modele) ?? 0) + dollars);
        }
      }
      if (!json.has_more || !json.next_page) break;
      page = json.next_page;
    }
  } catch (e) {
    return { configure: true, erreur: e instanceof Error ? e.message : 'Console injoignable' };
  }
  return {
    configure: true,
    total: [...parJour.values()].reduce((s, v) => s + v, 0),
    parJour: [...parJour.entries()].sort().map(([jour, cout]) => ({ jour, cout })),
    parModele: [...parModele.entries()].sort((a, b) => b[1] - a[1]).map(([modele, cout]) => ({ modele, cout })),
  };
}

// ── Noms (déchiffrés) et titres ─────────────────────────────────────────────

async function lireParLots(collection: string, ids: string[]) {
  const docs: FirebaseFirestore.DocumentSnapshot[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const refs = ids.slice(i, i + 100).map((id) => adminDb.collection(collection).doc(id));
    if (refs.length) docs.push(...(await adminDb.getAll(...refs)));
  }
  return docs;
}

async function nomsUtilisateurs(uids: string[]): Promise<Map<string, string>> {
  const noms = new Map<string, string>();
  for (const d of await lireParLots('users', uids)) {
    if (!d.exists) continue;
    const x = d.data()!;
    noms.set(d.id, decrypt(x.displayName) || decrypt(x.email) || '');
  }
  return noms;
}

// ── Le rapport ──────────────────────────────────────────────────────────────

export async function construireRapport(moisDemande?: string | null): Promise<RapportCouts> {
  const aujourdhui = jourBruxelles();
  const mois = moisDemande && /^\d{4}-\d{2}$/.test(moisDemande) ? moisDemande : aujourdhui.slice(0, 7);
  const debutSept = ajouterJours(aujourdhui, -6);
  // Le mois affiché + les 7 derniers jours (qui peuvent déborder sur le mois d'avant)
  const debut = debutSept < `${mois}-01` ? debutSept : `${mois}-01`;
  const lignes = await lignesEntre(debut, finDuMois(mois) > aujourdhui ? finDuMois(mois) : aujourdhui);

  // Surveillance depuis la base, à chaque ouverture de la page
  if (mois === aujourdhui.slice(0, 7)) {
    await surveiller(lignes.filter((l) => l.jour === aujourdhui));
  }

  const duMois = lignes.filter((l) => l.jour.startsWith(mois));
  const totaux = { jour: vide(), mois: vide(), septJours: vide() };
  const parJour = new Map<string, CompteCouts>();
  const parFonction = new Map<string, CompteCouts>();
  const parModele = new Map<string, CompteCouts>();
  const parActivite = new Map<string, { c: CompteCouts; eleves: Map<string, CompteCouts>; fonctions: Set<string> }>();
  const erreurs = new Map<string, ErreurFrequente>();

  for (const l of lignes) {
    if (l.jour === aujourdhui) ajouter(totaux.jour, l);
    if (l.jour >= debutSept) ajouter(totaux.septJours, l);
  }
  for (const l of duMois) {
    ajouter(totaux.mois, l);
    const j = parJour.get(l.jour) ?? vide();
    ajouter(j, l);
    parJour.set(l.jour, j);
    const f = parFonction.get(l.fonction) ?? vide();
    ajouter(f, l);
    parFonction.set(l.fonction, f);
    const modele = l.modele.replace(/-\d{8}$/, '');
    const m = parModele.get(modele) ?? vide();
    ajouter(m, l);
    parModele.set(modele, m);

    const cleA = l.devoirId ?? '';
    const a = parActivite.get(cleA) ?? { c: vide(), eleves: new Map(), fonctions: new Set<string>() };
    ajouter(a.c, l);
    a.fonctions.add(l.fonction);
    if (l.uid && l.role === 'eleve') {
      const e = a.eleves.get(l.uid) ?? vide();
      ajouter(e, l);
      a.eleves.set(l.uid, e);
    }
    parActivite.set(cleA, a);

    if (l.statut === 'erreur') {
      const cle = `${cleErreur(l.erreur ?? 'erreur')}|${l.fonction}`;
      const x = erreurs.get(cle);
      const quand = l.at.toISOString();
      if (x) {
        x.nombre++;
        if (quand > x.dernier) x.dernier = quand;
      } else {
        erreurs.set(cle, {
          cle: cleErreur(l.erreur ?? 'erreur'),
          fonction: l.fonction,
          nombre: 1,
          dernier: quand,
          exemple: l.erreur ?? '',
          devoirId: l.devoirId,
        });
      }
    }
  }

  // Alertes (30 dernières) et coupures en cours
  const [alertesSnap, suspSnap, premiere] = await Promise.all([
    adminDb.collection(COLLECTION_ALERTES).orderBy('at', 'desc').limit(30).get(),
    adminDb.collection(COLLECTION_SUSPENSIONS).get(),
    adminDb.collection(COLLECTION_CONSOMMATION).orderBy('at', 'asc').limit(1).get(),
  ]);
  const suspendues = new Set(suspSnap.docs.map((d) => d.id));

  // Titres, profs et classes des activités ; noms des élèves et des profs
  const devoirIds = [
    ...new Set([
      ...[...parActivite.keys()].filter(Boolean),
      ...suspSnap.docs.map((d) => d.id),
      ...alertesSnap.docs.map((d) => d.data().devoirId as string | null).filter((x): x is string => !!x),
    ]),
  ];
  const devoirs = new Map<string, FirebaseFirestore.DocumentData>();
  for (const d of await lireParLots('devoirs', devoirIds)) if (d.exists) devoirs.set(d.id, d.data()!);
  const uids = new Set<string>();
  for (const a of parActivite.values()) for (const uid of a.eleves.keys()) uids.add(uid);
  for (const d of devoirs.values()) if (d.profId) uids.add(d.profId);
  const noms = await nomsUtilisateurs([...uids]);
  const titre = (id: string | null) =>
    id ? (devoirs.get(id)?.intitule as string | undefined) || 'Activité supprimée' : 'Hors activité';

  const activites: CoutActivite[] = [...parActivite.entries()]
    .map(([cle, a]) => {
      const devoirId = cle || null;
      const d = devoirId ? devoirs.get(devoirId) : undefined;
      const detailEleves: CoutEleve[] = [...a.eleves.entries()]
        .map(([uid, c]) => ({ uid, nom: noms.get(uid) || 'Élève', ...c }))
        .sort((x, y) => y.cout - x.cout);
      return {
        devoirId,
        titre: titre(devoirId),
        prof: d?.profId ? noms.get(d.profId) || '' : '',
        classes: Array.isArray(d?.classes) ? d!.classes.map((c: { nom?: string }) => c?.nom).filter(Boolean).join(', ') : '',
        ...a.c,
        eleves: a.eleves.size,
        coutParEleve: a.eleves.size ? a.c.cout / a.eleves.size : 0,
        suspendue: devoirId ? suspendues.has(devoirId) : false,
        detailEleves,
        fonctions: [...a.fonctions].sort(),
      };
    })
    .sort((x, y) => y.cout - x.cout);

  const alertes: AlerteVue[] = alertesSnap.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      at: enDate(x.at).toISOString(),
      type: String(x.type ?? ''),
      message: String(x.message ?? ''),
      rapport: Array.isArray(x.rapport) ? x.rapport.map(String) : [],
      devoirId: x.devoirId ?? null,
      titreActivite: x.devoirId ? titre(x.devoirId) : null,
      vue: x.vue === true,
    };
  });

  const suspensions: SuspensionVue[] = suspSnap.docs.map((d) => {
    const x = d.data();
    return {
      devoirId: d.id,
      titre: titre(d.id),
      at: enDate(x.at).toISOString(),
      raison: String(x.raison ?? ''),
      rapport: Array.isArray(x.rapport) ? x.rapport.map(String) : [],
    };
  });

  const trie = <T extends CompteCouts>(m: Map<string, CompteCouts>, cle: string) =>
    [...m.entries()].map(([k, c]) => ({ [cle]: k, ...c }) as unknown as T).sort((a, b) => b.cout - a.cout);

  return {
    mois,
    aujourdhui,
    totaux,
    parJour: [...parJour.entries()].sort().map(([jour, c]) => ({ jour, ...c })),
    parFonction: trie(parFonction, 'fonction'),
    parModele: trie(parModele, 'modele'),
    parActivite: activites,
    erreurs: [...erreurs.values()].sort((a, b) => b.nombre - a.nombre).slice(0, 15),
    alertes,
    suspensions,
    console: await coutConsole(mois),
    seuils: { ...SEUILS_IA },
    depuis: premiere.empty ? null : enDate(premiere.docs[0].data().at).toISOString(),
  };
}
