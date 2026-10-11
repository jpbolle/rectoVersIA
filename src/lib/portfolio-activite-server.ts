// UNE ACTIVITÉ POSÉE DANS UN PORTFOLIO, côté serveur (plan
// 2026-10-11-ecriture-collective-portfolio) :
//  - retrouver le(s) portfolio(s) de l'élève qui la contiennent ;
//  - l'EXTRAIT attribué au groupe, posé dans l'éditeur d'une copie d'écriture
//    encore vide (phase 1) ;
//  - SOUMETTRE une étape au prof — la route `POST /api/portfolio/suivi` et la
//    remise d'une activité ouverte depuis le portfolio (passerelle, phase 1 bis)
//    passent par la même porte.

import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { poserAnnonce } from '@/lib/annonce-server';
import { docToSection } from '@/lib/oeuvre-server';
import { etatEtape, lireContenuEleve, prete, type EtapePortfolioVue } from '@/lib/portfolio-etat';
import { groupeDe } from '@/lib/portfolio-groupe-server';
import { lirePortfolioContenu } from '@/lib/portfolio-server';
import { cibleSuivi, lireSuivi, suiviDe } from '@/lib/portfolio-suivi-server';
import { eleveExclu, identiteEleve, sequenceOuverteA, type IdentiteEleve } from '@/lib/sequence-server';
import type { OeuvreBloc } from '@/types/oeuvre';
import { etapeASoumettre, valeursAffichees, type PortfolioEtape } from '@/types/portfolio';
import type { EtatActiviteParcours } from '@/types/sequence-fle';

export type DevoirPortfolio = { id: string; [k: string]: unknown };

function etatDe(status: unknown): EtatActiviteParcours {
  if (status === 'submitted') return 'fait';
  if (status === 'draft') return 'en-cours';
  return 'a-faire';
}

// ─── Les portfolios de l'élève qui contiennent cette activité ───

export interface EtapeDActivite {
  portfolio: DevoirPortfolio;
  etapes: PortfolioEtape[];
  etape: PortfolioEtape;
}

/**
 * Les étapes-activités qui renvoient à `devoirId`, dans les portfolios OUVERTS
 * à cet élève (même règle que `ouvertParSequence`). Il n'y en a presque
 * toujours qu'une.
 */
export async function etapesDeLActivite(devoirId: string, identite: IdentiteEleve): Promise<EtapeDActivite[]> {
  if (identite.eleveIds.length === 0 || identite.classeNoms.length === 0) return [];
  const snap = await adminDb.collection('devoirs').where('typeTravail', '==', 'portfolio').get();
  const resultat: EtapeDActivite[] = [];
  for (const d of snap.docs) {
    const data = d.data();
    const classes = Array.isArray(data.classes) ? (data.classes as string[]) : [];
    if (data.archive || !classes.some((nom) => identite.classeNoms.includes(nom))) continue;
    if (eleveExclu(data.eleves, identite.eleveIds)) continue;
    const etapes = lirePortfolioContenu(data.portfolio).etapes;
    const etape = etapes.find((e) => e.nature === 'activite' && e.devoirId === devoirId);
    if (!etape) continue;
    const portfolio: DevoirPortfolio = { ...data, id: data.id || d.id };
    if (await sequenceOuverteA(portfolio as Parameters<typeof sequenceOuverteA>[0], identite)) {
      resultat.push({ portfolio, etapes, etape });
    }
  }
  return resultat;
}

// ─── Phase 1 : l'extrait dans l'éditeur ───

function echapper(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Une scène en HTML pour l'éditeur (Tiptap) : son titre, puis une réplique par
 * paragraphe — le personnage en gras, puis le texte, un vers par ligne. Les
 * blocs « texte » (didascalies, liste des personnages) passent tels quels ;
 * images, vidéos, sons et pages intégrées n'ont rien à faire dans une copie.
 */
export function sceneEnHtml(titre: string, blocs: OeuvreBloc[]): string {
  const parties: string[] = [];
  if (titre) parties.push(`<h2>${echapper(titre)}</h2>`);
  for (const b of blocs) {
    if (b.type === 'vers' && b.contenu?.trim()) {
      const lignes = b.contenu
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map(echapper)
        .join('<br>');
      parties.push(b.locuteur?.trim() ? `<p><strong>${echapper(b.locuteur.trim())}</strong> — ${lignes}</p>` : `<p>${lignes}</p>`);
    } else if (b.type === 'texte' && b.contenu?.trim()) {
      parties.push(b.contenu);
    }
  }
  return parties.join('');
}

/**
 * L'extrait à poser dans une copie d'écriture vide : la scène attribuée au
 * groupe (valeur « œuvre ») que l'étape affiche « dans la colonne de travail ».
 * `null` s'il n'y a rien à poser — l'œuvre ENTIÈRE n'est jamais posée (trop
 * longue pour une copie).
 */
export async function extraitPourEditeur(devoirId: string, uid: string, email: string): Promise<string | null> {
  const identite = await identiteEleve(uid, email);
  for (const { portfolio, etapes, etape } of await etapesDeLActivite(devoirId, identite)) {
    const aPoser = valeursAffichees(etapes, etape, null, 'travail').filter((v) => v.genre === 'oeuvre');
    if (aPoser.length === 0) continue;
    const suivi = await suiviDe((await cibleSuivi(portfolio.id, uid, email)).cle);
    for (const v of aPoser) {
      const valeur = suivi.valeurs[v.valeurId];
      if (!valeur || valeur.genre !== 'oeuvre' || !valeur.oeuvreId || !valeur.sectionId) continue;
      const section = await adminDb.collection('oeuvres').doc(valeur.oeuvreId).collection('sections').doc(valeur.sectionId).get();
      if (!section.exists) continue;
      const html = sceneEnHtml(valeur.titre || '', docToSection(section).blocs);
      if (html) return html;
    }
  }
  return null;
}

/** Une copie d'écriture encore vide (rien, ou un paragraphe vide de Tiptap). */
export function copieVide(content: unknown): boolean {
  if (typeof content !== 'string') return true;
  return content.replace(/<p>\s*<\/p>/g, '').replace(/<br\s*\/?>/g, '').trim() === '';
}

// ─── Soumettre une étape au prof ───

export type ResultatSoumission = { ok: true; n: number } | { ok: false; raison: 'pas-prete' | 'deja-soumise' | 'non-soumissible' };

/**
 * L'élève soumet l'étape `etapeId` du portfolio : vérifie qu'elle est PRÊTE,
 * écrit la soumission dans le suivi (le sien ou celui de son groupe) et
 * prévient le prof (cloche, sans nom d'élève — RGPD).
 */
export async function soumettreEtape(
  portfolio: DevoirPortfolio,
  etapeId: string,
  auth: { uid: string; email: string },
  identite: IdentiteEleve
): Promise<ResultatSoumission> {
  const etape = lirePortfolioContenu(portfolio.portfolio).etapes.find((e) => e.id === etapeId);
  if (!etape || !etapeASoumettre(etape)) return { ok: false, raison: 'non-soumissible' };

  // L'étape doit être PRÊTE — vérifié ici, pas seulement à l'écran
  const travailId = `TRV-${portfolio.id}-${auth.uid}`;
  const travail = await adminDb.collection('travaux').doc(travailId).get();
  const groupe = identite.eleveIds.length > 0 ? await groupeDe(portfolio.id, identite.eleveIds) : null;
  const vue: EtapePortfolioVue = { ...etape };
  if (etape.nature === 'activite' && etape.devoirId) {
    const copie = await adminDb.collection('travaux').doc(`TRV-${etape.devoirId}-${auth.uid}`).get();
    vue.etatRenvoi = copie.exists ? etatDe(copie.data()?.status) : 'a-faire';
  }
  const cible = await cibleSuivi(portfolio.id, auth.uid, auth.email);
  const ref = adminDb.collection('portfolioSuivi').doc(cible.cle);

  const resultat = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const suivi = snap.exists ? lireSuivi(snap.data()) : lireSuivi({});
    const contenu = {
      ...lireContenuEleve(typeof travail.data()?.content === 'string' ? travail.data()!.content : ''),
      groupeStatut: groupe?.statut ?? null,
      suivi,
    };
    const etat = etatEtape(vue, contenu);
    // On soumet une étape prête, ou une étape refusée qu'on a reprise
    if (etat !== 'prete' && etat !== 'a-reprendre') {
      const dejaSoumise = etat === 'soumise' || etat === 'a-revoir' || etat === 'validee';
      return { ok: false as const, raison: dejaSoumise ? ('deja-soumise' as const) : ('pas-prete' as const) };
    }
    if (!prete(vue, contenu)) return { ok: false as const, raison: 'pas-prete' as const };
    const n = (suivi.soumissions[etapeId]?.n ?? 0) + 1;
    tx.set(
      ref,
      {
        devoirId: portfolio.id,
        groupeId: cible.groupeId,
        soumissions: { [etapeId]: { date: new Date().toISOString(), n } },
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return { ok: true as const, n };
  });
  if (!resultat.ok) return resultat;

  // Le prof est prévenu (cloche). Pas de nom d'élève dans la notification :
  // la collection `annonces` ne porte aucune identité d'élève (RGPD).
  try {
    const profId = typeof portfolio.profId === 'string' ? portfolio.profId : '';
    const prof = profId ? await adminAuth.getUser(profId) : null;
    if (prof?.email) {
      await poserAnnonce({
        message: `${resultat.n > 1 ? 'Étape soumise à nouveau' : 'Étape soumise'} : « ${etape.titre} » — ${String(portfolio.intitule || 'portfolio')}`,
        cible: 'collegue',
        destinataireEmail: prof.email,
        auteurUid: auth.uid,
        lien: `/dashboard/travaux/${portfolio.id}/${travailId}`,
        etiquette: '🗂️ Portfolio — à valider',
      });
    }
  } catch (e) {
    console.error('Notification de soumission non écrite:', e);
  }
  return resultat;
}

/**
 * PASSERELLE (JP, 2026-10-11) : l'élève vient de REMETTRE une activité posée
 * dans un portfolio — l'étape qui y renvoie est soumise au prof d'un même
 * geste, sans second clic dans le portfolio. Silencieux : une étape déjà
 * soumise, ou pas encore prête, reste comme elle est.
 */
export async function soumettreEtapesDeLActivite(devoirId: string, auth: { uid: string; email: string }): Promise<void> {
  const identite = await identiteEleve(auth.uid, auth.email);
  for (const { portfolio, etape } of await etapesDeLActivite(devoirId, identite)) {
    await soumettreEtape(portfolio, etape.id, auth, identite);
  }
}
