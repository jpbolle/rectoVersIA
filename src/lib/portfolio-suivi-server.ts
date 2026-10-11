// Le SUIVI d'un portfolio côté serveur (plan 2026-10-10-portfolio-validation-
// variables) : soumissions des étapes, retours du prof (✓ / ✗, appréciation,
// commentaire) et VALEURS attribuées (« Le sketch »…).
//
// Collection `portfolioSuivi/{devoirId}__{cible}` — accès serveur uniquement
// (aucune règle Firestore). La CIBLE est le groupe ACCEPTÉ de l'élève
// (`G-{groupeId}`) : une seule vérité pour tous ses membres ; à défaut,
// l'élève lui-même (`U-{uid}`).

import { adminDb } from '@/lib/firebase/admin';
import { fichesParId, groupeDe } from '@/lib/portfolio-groupe-server';
import { identiteEleve } from '@/lib/sequence-server';
import { lienValide } from '@/lib/portfolio-etat';
import { integrationAutorisee } from '@/lib/integration';
import { videoEmbedUrl } from '@/lib/youtube';
import {
  SUIVI_VIDE,
  type Appreciation,
  type GenreValeur,
  type RetourEtape,
  type SoumissionEtape,
  type SuiviPortfolio,
  type ValeurAttribuee,
} from '@/types/portfolio';

export interface CibleSuivi {
  cle: string; // id du document `portfolioSuivi`
  groupeId: string | null;
  // Les uid des élèves concernés (notifications) — le groupe, ou l'élève seul
  uids: string[];
}

/** Le groupe accepté de l'élève, sinon l'élève seul. */
export async function cibleSuivi(devoirId: string, uid: string, email = ''): Promise<CibleSuivi> {
  const identite = await identiteEleve(uid, email);
  const groupe = identite.eleveIds.length > 0 ? await groupeDe(devoirId, identite.eleveIds) : null;
  if (groupe && groupe.statut === 'accepte') {
    const fiches = await fichesParId(groupe.membres.filter((m) => m.statut !== 'decline').map((m) => m.eleveId));
    const uids = [...new Set([uid, ...[...fiches.values()].map((f) => f.uid).filter((u): u is string => !!u)])];
    return { cle: `${devoirId}__G-${groupe.id}`, groupeId: groupe.id, uids };
  }
  return { cle: `${devoirId}__U-${uid}`, groupeId: null, uids: [uid] };
}

function objet(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** Lecture tolérante d'un document de suivi. */
export function lireSuivi(data: unknown): SuiviPortfolio {
  const d = objet(data);
  const soumissions: Record<string, SoumissionEtape> = {};
  for (const [k, v] of Object.entries(objet(d.soumissions))) {
    const s = objet(v);
    if (typeof s.date === 'string') soumissions[k] = { date: s.date, n: typeof s.n === 'number' ? s.n : 1 };
  }
  const lireRetour = (v: unknown): RetourEtape | null => {
    const r = objet(v);
    if (r.decision !== 'valide' && r.decision !== 'refuse') return null;
    return {
      decision: r.decision,
      appreciation: r.appreciation === 'bien' || r.appreciation === 'moyen' || r.appreciation === 'faible' ? r.appreciation : null,
      commentaire: typeof r.commentaire === 'string' ? r.commentaire : '',
      date: typeof r.date === 'string' ? r.date : '',
      soumissionN: typeof r.soumissionN === 'number' ? r.soumissionN : 0,
    };
  };
  const retours: Record<string, RetourEtape> = {};
  for (const [k, v] of Object.entries(objet(d.retours))) {
    const r = lireRetour(v);
    if (r) retours[k] = r;
  }
  // L'historique ; un suivi d'avant le 2026-10-11 n'en a pas : son dernier
  // retour en est le premier élément (rien de plus n'a été gardé)
  const historique: Record<string, RetourEtape[]> = {};
  for (const [k, v] of Object.entries(objet(d.historique))) {
    if (!Array.isArray(v)) continue;
    const liste = v.map(lireRetour).filter((r): r is RetourEtape => r !== null);
    if (liste.length > 0) historique[k] = liste;
  }
  for (const [k, r] of Object.entries(retours)) {
    if (!historique[k]) historique[k] = [r];
  }
  const valeurs: Record<string, ValeurAttribuee> = {};
  for (const [k, v] of Object.entries(objet(d.valeurs))) {
    const propre = valeurPropre(v);
    if (propre) valeurs[k] = propre;
  }
  return { soumissions, retours, historique, valeurs };
}

/**
 * À l'ACCEPTATION d'un groupe (2026-10-11) : ce que ses membres ont déjà fait
 * SEULS — soumissions, retours du prof, valeurs — passe dans le suivi du
 * groupe. Depuis la règle « un groupe déclaré suffit pour soumettre » (JP), un
 * élève peut soumettre AVANT l'acceptation ; sans cette fusion, son étape
 * soumise « disparaîtrait » au moment où le prof accepte (le suivi lu devient
 * celui du groupe). Par étape, la soumission la plus récente l'emporte ; ce
 * que le groupe a déjà reste prioritaire pour les valeurs.
 */
export async function fusionnerSuivisDansGroupe(devoirId: string, groupeId: string, eleveIds: string[]): Promise<void> {
  const fiches = await fichesParId(eleveIds);
  const uids = [...new Set([...fiches.values()].map((f) => f.uid).filter((u): u is string => !!u))];
  if (uids.length === 0) return;
  const refGroupe = adminDb.collection('portfolioSuivi').doc(`${devoirId}__G-${groupeId}`);
  const individuels = await adminDb.getAll(...uids.map((u) => adminDb.collection('portfolioSuivi').doc(`${devoirId}__U-${u}`)));
  const sources = individuels.filter((d) => d.exists).map((d) => lireSuivi(d.data()));
  if (sources.length === 0) return;
  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(refGroupe);
    const fusion = snap.exists ? lireSuivi(snap.data()) : lireSuivi({});
    for (const src of sources) {
      for (const [etapeId, s] of Object.entries(src.soumissions)) {
        const deja = fusion.soumissions[etapeId];
        if (!deja || s.date > deja.date) fusion.soumissions[etapeId] = s;
      }
      for (const [etapeId, r] of Object.entries(src.retours)) {
        const deja = fusion.retours[etapeId];
        if (!deja || r.date > deja.date) fusion.retours[etapeId] = r;
      }
      // Les historiques s'additionnent (sans doublon), dans l'ordre des dates
      for (const [etapeId, liste] of Object.entries(src.historique)) {
        const deja = fusion.historique[etapeId] ?? [];
        const dates = new Set(deja.map((r) => r.date));
        fusion.historique[etapeId] = [...deja, ...liste.filter((r) => !dates.has(r.date))].sort((a, b) => a.date.localeCompare(b.date));
      }
      for (const [valeurId, v] of Object.entries(src.valeurs)) {
        if (!fusion.valeurs[valeurId]) fusion.valeurs[valeurId] = v;
      }
    }
    tx.set(refGroupe, { ...fusion, devoirId, groupeId, updatedAt: new Date().toISOString() }, { merge: true });
  });
}

export async function suiviDe(cle: string): Promise<SuiviPortfolio> {
  const snap = await adminDb.collection('portfolioSuivi').doc(cle).get();
  return snap.exists ? lireSuivi(snap.data()) : SUIVI_VIDE;
}

const GENRES: GenreValeur[] = ['oeuvre', 'lien', 'video', 'integration'];

/**
 * Une valeur attribuée, nettoyée. Œuvre : une référence (jamais le texte).
 * Lien, vidéo, page intégrée : une adresse http(s) — et, pour une vidéo, une
 * adresse que le lecteur sait lire ; pour une page intégrée, un domaine de la
 * liste blanche (une iframe exécute du code étranger chez des mineurs).
 */
export function valeurPropre(v: unknown): ValeurAttribuee | null {
  const d = objet(v);
  const genre = GENRES.includes(d.genre as GenreValeur) ? (d.genre as GenreValeur) : null;
  if (!genre) return null;
  const titre = typeof d.titre === 'string' ? d.titre.trim().slice(0, 300) : '';
  if (genre === 'oeuvre') {
    const oeuvreId = typeof d.oeuvreId === 'string' ? d.oeuvreId.trim().slice(0, 60) : '';
    if (!oeuvreId) return null;
    const sectionId = typeof d.sectionId === 'string' && d.sectionId.trim() ? d.sectionId.trim().slice(0, 60) : null;
    return { genre, oeuvreId, sectionId, titre };
  }
  const url = lienValide(typeof d.url === 'string' ? d.url : '');
  if (!url) return null;
  if (genre === 'video' && !videoEmbedUrl(url)) return null;
  if (genre === 'integration' && !integrationAutorisee(url)) return null;
  return { genre, url, titre };
}

/** Le commentaire et l'appréciation d'un retour, nettoyés. */
export function retourPropre(
  input: { decision?: unknown; appreciation?: unknown; commentaire?: unknown },
  soumissionN: number
): RetourEtape | null {
  if (input.decision !== 'valide' && input.decision !== 'refuse') return null;
  const appreciation: Appreciation | null =
    input.appreciation === 'bien' || input.appreciation === 'moyen' || input.appreciation === 'faible'
      ? input.appreciation
      : null;
  return {
    decision: input.decision,
    appreciation,
    commentaire: typeof input.commentaire === 'string' ? input.commentaire.trim().slice(0, 3000) : '',
    date: new Date().toISOString(),
    soumissionN,
  };
}
