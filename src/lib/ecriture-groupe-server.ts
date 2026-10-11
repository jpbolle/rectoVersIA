// LA COPIE DE GROUPE d'une activité d'écriture posée dans une étape COLLECTIVE
// d'un portfolio (plan 2026-10-11-ecriture-collective-portfolio, phase 2 —
// option A choisie par JP : « la main tourne »).
//
// Le texte commun vit dans `ecrituresGroupe/{devoirId}__G-{groupeId}` (serveur
// uniquement, aucune règle Firestore). UN élève à la fois a LA MAIN : il écrit,
// les autres lisent (rafraîchi toutes les 3 s). La main se prend d'un clic dans
// le texte, se rend d'un bouton, et se libère seule après 60 s sans frappe.
// La prise est une TRANSACTION : deux élèves qui cliquent ensemble → un seul
// l'obtient. Jamais d'écrasement.
//
// COPIES MIROIRS : chaque membre garde sa copie dans `travaux` ; le serveur y
// recopie le texte commun à chaque enregistrement (et y pose `groupeEcriture`).
// La correction, l'onglet Corrigé, le tableau d'évolution et le profil lisent
// ces copies individuelles sans rien savoir du groupe.

import { adminDb } from '@/lib/firebase/admin';
import { decryptFields, encrypt, hashEmail, SENSITIVE_ELEVE_FIELDS } from '@/lib/crypto';
import { copieVide, etapesDeLActivite, extraitPourEditeur, soumettreEtapesDeLActivite } from '@/lib/portfolio-activite-server';
import { fichesParId, groupeDe } from '@/lib/portfolio-groupe-server';
import { identiteEleve } from '@/lib/sequence-server';
import { generateTravailId } from '@/lib/travail-utils';

const MAIN_MS = 60_000;
const CONTEXTE_MS = 30_000;
const TAILLE_MAX = 300_000;

export interface MembreEcriture {
  uid: string;
  nom: string; // le prénom — c'est ce que voit la pastille
}

export interface ContexteGroupe {
  cle: string; // id du document `ecrituresGroupe`
  devoirId: string;
  portfolioId: string;
  groupeId: string;
  membres: MembreEcriture[]; // ceux qui se sont déjà connectés (ils ont un uid)
}

export interface EtatEcritureGroupe {
  actif: true;
  contenu: string;
  version: number;
  // Qui écrit en ce moment (null : la main est libre)
  main: { nom: string; moi: boolean } | null;
  membres: string[];
  remise: boolean;
}

// ─── Le contexte : cet élève écrit-il en groupe dans cette activité ? ───
// Mis en cache 30 s par élève et par activité : la page interroge toutes les
// 3 s, il ne faut pas relire les portfolios à chaque fois.
const cache = new Map<string, { valeur: ContexteGroupe | null; expire: number }>();

export async function contexteGroupe(devoirId: string, uid: string, email: string): Promise<ContexteGroupe | null> {
  const k = `${uid}|${devoirId}`;
  const c = cache.get(k);
  if (c && c.expire > Date.now()) return c.valeur;

  let valeur: ContexteGroupe | null = null;
  const identite = await identiteEleve(uid, email);
  for (const { portfolio, etape } of await etapesDeLActivite(devoirId, identite)) {
    if (etape.portee !== 'collective') continue;
    const groupe = await groupeDe(portfolio.id, identite.eleveIds);
    if (!groupe || groupe.statut !== 'accepte') continue;
    const presents = groupe.membres.filter((m) => m.statut !== 'decline');
    // Un groupe d'un seul élève (« je travaille seul ») : copie individuelle
    if (presents.length < 2) continue;
    const fiches = await fichesParId(presents.map((m) => m.eleveId));
    const membres = [...fiches.values()]
      .filter((f) => !!f.uid)
      .map((f) => ({ uid: f.uid as string, nom: f.prenom || 'Un camarade' }));
    if (!membres.some((m) => m.uid === uid)) continue;
    valeur = { cle: `${devoirId}__G-${groupe.id}`, devoirId, portfolioId: portfolio.id, groupeId: groupe.id, membres };
    break;
  }
  cache.set(k, { valeur, expire: Date.now() + CONTEXTE_MS });
  return valeur;
}

// ─── Le document commun ───

interface DocEcriture {
  contenu: string;
  version: number;
  mainUid: string | null;
  mainNom: string;
  mainJusqua: number;
  remise: boolean;
}

function lireDoc(data: FirebaseFirestore.DocumentData | undefined): DocEcriture {
  return {
    contenu: typeof data?.contenu === 'string' ? data.contenu : '',
    version: typeof data?.version === 'number' ? data.version : 0,
    mainUid: typeof data?.mainUid === 'string' && data.mainUid ? data.mainUid : null,
    mainNom: typeof data?.mainNom === 'string' ? data.mainNom : '',
    mainJusqua: typeof data?.mainJusqua === 'number' ? data.mainJusqua : 0,
    remise: data?.remise === true,
  };
}

function mainActive(d: DocEcriture): boolean {
  return !!d.mainUid && d.mainJusqua > Date.now();
}

function vue(d: DocEcriture, ctx: ContexteGroupe, uid: string): EtatEcritureGroupe {
  return {
    actif: true,
    contenu: d.contenu,
    version: d.version,
    main: mainActive(d) ? { nom: d.mainNom, moi: d.mainUid === uid } : null,
    membres: ctx.membres.map((m) => m.nom),
    remise: d.remise,
  };
}

function refDoc(ctx: ContexteGroupe) {
  return adminDb.collection('ecrituresGroupe').doc(ctx.cle);
}

/**
 * Le document commun, créé à la première ouverture : il part de la copie d'un
 * membre déjà entamée (le groupe ne perd rien de ce qui a été écrit avant),
 * sinon de l'extrait attribué au groupe, sinon d'une page blanche.
 */
async function assurerDoc(ctx: ContexteGroupe, uid: string, email: string): Promise<DocEcriture> {
  const ref = refDoc(ctx);
  const snap = await ref.get();
  if (snap.exists) return lireDoc(snap.data());

  let depart = '';
  const copies = await adminDb.getAll(...ctx.membres.map((m) => adminDb.collection('travaux').doc(generateTravailId(ctx.devoirId, m.uid))));
  const entamee = copies.find((c) => c.exists && !copieVide(c.data()?.content));
  if (entamee) depart = String(entamee.data()?.content ?? '');
  else depart = (await extraitPourEditeur(ctx.devoirId, uid, email)) ?? '';

  return adminDb.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    if (s.exists) return lireDoc(s.data());
    const doc = {
      devoirId: ctx.devoirId,
      portfolioId: ctx.portfolioId,
      groupeId: ctx.groupeId,
      uids: ctx.membres.map((m) => m.uid),
      contenu: depart,
      version: 1,
      mainUid: null,
      mainNom: '',
      mainJusqua: 0,
      remise: false,
      updatedAt: new Date().toISOString(),
    };
    tx.set(ref, doc);
    return lireDoc(doc);
  });
}

export async function lireEcriture(ctx: ContexteGroupe, uid: string, email: string): Promise<EtatEcritureGroupe> {
  return vue(await assurerDoc(ctx, uid, email), ctx, uid);
}

function nomDe(ctx: ContexteGroupe, uid: string): string {
  return ctx.membres.find((m) => m.uid === uid)?.nom || 'Un camarade';
}

/** Prendre la main — refusé (sans erreur) si un autre l'a et écrit encore. */
export async function prendreLaMain(ctx: ContexteGroupe, uid: string, email: string): Promise<EtatEcritureGroupe> {
  await assurerDoc(ctx, uid, email);
  const ref = refDoc(ctx);
  const d = await adminDb.runTransaction(async (tx) => {
    const cur = lireDoc((await tx.get(ref)).data());
    if (cur.remise || (mainActive(cur) && cur.mainUid !== uid)) return cur;
    const suite = { ...cur, mainUid: uid, mainNom: nomDe(ctx, uid), mainJusqua: Date.now() + MAIN_MS };
    tx.update(ref, { mainUid: suite.mainUid, mainNom: suite.mainNom, mainJusqua: suite.mainJusqua });
    return suite;
  });
  return vue(d, ctx, uid);
}

/** Rendre la main (seulement si on l'a). */
export async function rendreLaMain(ctx: ContexteGroupe, uid: string): Promise<EtatEcritureGroupe> {
  const ref = refDoc(ctx);
  const d = await adminDb.runTransaction(async (tx) => {
    const cur = lireDoc((await tx.get(ref)).data());
    if (cur.mainUid !== uid) return cur;
    tx.update(ref, { mainUid: null, mainNom: '', mainJusqua: 0 });
    return { ...cur, mainUid: null, mainNom: '', mainJusqua: 0 };
  });
  return vue(d, ctx, uid);
}

/** Recopie le texte commun dans les copies des membres encore modifiables. */
async function recopier(ctx: ContexteGroupe, contenu: string, statut?: 'submitted'): Promise<void> {
  const maintenant = new Date().toISOString();
  const refs = ctx.membres.map((m) => adminDb.collection('travaux').doc(generateTravailId(ctx.devoirId, m.uid)));
  const copies = await adminDb.getAll(...refs);
  const lot = adminDb.batch();
  copies.forEach((c) => {
    if (!c.exists) return;
    const data = c.data()!;
    if (data.verrouille === true || (data.status === 'submitted' && !statut)) return;
    lot.update(c.ref, {
      content: contenu,
      groupeEcriture: ctx.cle,
      updatedAt: maintenant,
      ...(statut ? { status: statut, submittedAt: maintenant } : {}),
    });
  });
  await lot.commit();
}

/**
 * Écrire — seulement avec la main (ou une main libre, que l'on reprend). Chaque
 * écriture prolonge la main de 60 s, puis le texte part dans les copies.
 */
export async function ecrire(
  ctx: ContexteGroupe,
  uid: string,
  contenu: string
): Promise<{ ok: boolean; etat: EtatEcritureGroupe }> {
  const ref = refDoc(ctx);
  const texte = contenu.slice(0, TAILLE_MAX);
  const r = await adminDb.runTransaction(async (tx) => {
    const cur = lireDoc((await tx.get(ref)).data());
    if (cur.remise || (mainActive(cur) && cur.mainUid !== uid)) return { ok: false, d: cur };
    const suite: DocEcriture = {
      ...cur,
      contenu: texte,
      version: cur.version + 1,
      mainUid: uid,
      mainNom: nomDe(ctx, uid),
      mainJusqua: Date.now() + MAIN_MS,
    };
    tx.update(ref, {
      contenu: suite.contenu,
      version: suite.version,
      mainUid: suite.mainUid,
      mainNom: suite.mainNom,
      mainJusqua: suite.mainJusqua,
      updatedAt: new Date().toISOString(),
    });
    return { ok: true, d: suite };
  });
  if (r.ok) await recopier(ctx, texte);
  return { ok: r.ok, etat: vue(r.d, ctx, uid) };
}

/**
 * Remettre la copie pour TOUT le groupe : chaque membre déjà connecté a sa
 * copie remise (créée au besoin, pour que le prof la retrouve), la main est
 * libérée, et l'étape du portfolio est soumise (passerelle).
 */
export async function remettre(ctx: ContexteGroupe, uid: string, email: string): Promise<EtatEcritureGroupe> {
  const d = await assurerDoc(ctx, uid, email);
  const maintenant = new Date().toISOString();

  // Les membres qui n'ont jamais ouvert l'activité n'ont pas encore de copie
  const refs = ctx.membres.map((m) => adminDb.collection('travaux').doc(generateTravailId(ctx.devoirId, m.uid)));
  const copies = await adminDb.getAll(...refs);
  const manquants = ctx.membres.filter((_, i) => !copies[i].exists);
  if (manquants.length > 0) {
    const fiches = await adminDb.collection('eleves').where('firebaseUid', 'in', manquants.map((m) => m.uid).slice(0, 30)).get();
    const emailDe = new Map(
      fiches.docs.map((f) => {
        const data = decryptFields(f.data(), SENSITIVE_ELEVE_FIELDS) as Record<string, unknown>;
        return [String(f.data().firebaseUid), String(data.email ?? '').trim().toLowerCase()];
      })
    );
    const lot = adminDb.batch();
    for (const m of manquants) {
      const mail = emailDe.get(m.uid) ?? '';
      const id = generateTravailId(ctx.devoirId, m.uid);
      lot.set(adminDb.collection('travaux').doc(id), {
        id,
        devoirId: ctx.devoirId,
        sessionId: null,
        studentId: m.uid,
        studentEmail: encrypt(mail),
        studentEmailHash: mail ? hashEmail(mail) : '',
        studentName: encrypt(mail.split('@')[0] || m.nom),
        content: d.contenu,
        status: 'draft',
        selfEvaluation: null,
        groupeEcriture: ctx.cle,
        createdAt: maintenant,
        updatedAt: maintenant,
        submittedAt: null,
      });
    }
    await lot.commit();
  }

  await recopier(ctx, d.contenu, 'submitted');
  await refDoc(ctx).update({ remise: true, mainUid: null, mainNom: '', mainJusqua: 0, updatedAt: maintenant });

  // Une copie renvoyée pour réécriture et remise à nouveau : sa correction
  // redevient invisible le temps d'être revue (même règle que la copie seule)
  await Promise.all(
    ctx.membres.map(async (m) => {
      const corr = adminDb.collection('corrections').doc(`CORR-${generateTravailId(ctx.devoirId, m.uid)}`);
      const s = await corr.get();
      if (s.exists && s.data()?.visibleParEleve === true) await corr.update({ visibleParEleve: false, updatedAt: maintenant });
    })
  );

  try {
    await soumettreEtapesDeLActivite(ctx.devoirId, { uid, email });
  } catch (e) {
    console.error('Passerelle portfolio (copie de groupe) :', e);
  }
  return vue({ ...d, remise: true, mainUid: null, mainNom: '', mainJusqua: 0 }, ctx, uid);
}

/**
 * Le prof a renvoyé une copie du groupe pour réécriture (statut « brouillon ») :
 * le texte commun redevient modifiable.
 */
export async function rouvrirEcriture(cle: string): Promise<void> {
  const ref = adminDb.collection('ecrituresGroupe').doc(cle);
  const s = await ref.get();
  if (s.exists && s.data()?.remise === true) await ref.update({ remise: false, updatedAt: new Date().toISOString() });
}

// ─── Phase 3 : le prof corrige UNE copie, le groupe entier la reçoit ───

/** Les autres copies du même groupe (même texte), la copie `travailId` exclue. */
async function copiesSoeurs(travailId: string): Promise<FirebaseFirestore.QueryDocumentSnapshot[]> {
  const copie = await adminDb.collection('travaux').doc(travailId).get();
  const cle = copie.data()?.groupeEcriture;
  if (typeof cle !== 'string' || !cle) return [];
  const snap = await adminDb.collection('travaux').where('groupeEcriture', '==', cle).get();
  return snap.docs.filter((d) => d.id !== travailId && d.data().devoirId === copie.data()?.devoirId);
}

/**
 * Le prof a agi sur une copie de groupe (renvoi pour réécriture, verrou, non
 * rendu…) : les mêmes champs sont posés sur les copies des autres membres. Un
 * renvoi en brouillon rouvre aussi le texte commun.
 */
export async function repliquerEtatCopie(travailId: string, champs: Record<string, unknown>): Promise<void> {
  if (Object.keys(champs).length === 0) return;
  const soeurs = await copiesSoeurs(travailId);
  if (soeurs.length === 0) return;
  const lot = adminDb.batch();
  soeurs.forEach((d) => lot.update(d.ref, { ...champs, updatedAt: new Date().toISOString() }));
  await lot.commit();
  const cle = soeurs[0].data().groupeEcriture;
  if (champs.status === 'draft' && typeof cle === 'string') await rouvrirEcriture(cle);
}

/**
 * La correction d'une copie de groupe est DUPLIQUÉE sur les copies des autres
 * membres : même texte, mêmes annotations, même grille, même visibilité. Seuls
 * l'id, la copie et l'élève changent.
 */
export async function repliquerCorrection(travailId: string): Promise<void> {
  const soeurs = await copiesSoeurs(travailId);
  if (soeurs.length === 0) return;
  const source = await adminDb.collection('corrections').doc(`CORR-${travailId}`).get();
  if (!source.exists) return;
  const data = source.data()!;
  const lot = adminDb.batch();
  soeurs.forEach((d) => {
    const id = `CORR-${d.id}`;
    lot.set(adminDb.collection('corrections').doc(id), {
      ...data,
      id,
      travailId: d.id,
      studentId: d.data().studentId,
      // La copie d'origine, pour qui voudrait remonter à la source
      repliqueDe: `CORR-${travailId}`,
    });
  });
  await lot.commit();
}

/** « Copie du groupe : … » — les noms complets des membres, pour le prof. */
export async function nomsDuGroupe(cle: string): Promise<string[]> {
  const doc = await adminDb.collection('ecrituresGroupe').doc(cle).get();
  const groupeId = doc.data()?.groupeId;
  if (typeof groupeId !== 'string' || !groupeId) return [];
  const g = await adminDb.collection('portfolioGroupes').doc(groupeId).get();
  const membres = Array.isArray(g.data()?.membres) ? (g.data()!.membres as { eleveId: string; statut: string }[]) : [];
  const fiches = await fichesParId(membres.filter((m) => m.statut !== 'decline').map((m) => m.eleveId));
  return [...fiches.values()].map((f) => `${f.prenom} ${f.nom}`.trim()).filter(Boolean);
}
