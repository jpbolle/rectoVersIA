// L'ÉTAT d'un portfolio côté élève — calcul PUR, partagé par la page élève,
// le sommaire du rail et (plus tard) la lecture de la copie par le prof.
//
//  prete(étape)  = renvoi → l'activité est remise
//                  dépôts → tous les dépôts OBLIGATOIRES sont remplis
//  etatEtape     = à faire → en cours → prête → SOUMISE au prof → validée ✓
//                  ou à reprendre ✗ → (nouvelle soumission) → à revoir…
//                  (2026-10-10 : « Soumettre au professeur » à toute étape à
//                  dépôts ou à activité)
//  faite(étape)  = soumise (ou à revoir, ou validée) — et VALIDÉE si la
//                  validation du prof bloque la suite ;
//                  sans trace → cochée à la main par l'élève
//  fermee(i)     = une étape avant i verrouille la suite (`verrouille`, ou
//                  validation bloquante) et n'est pas faite
//
// Rien n'est stocké : l'état se DÉDUIT de la copie (`Travail.content`, JSON
// `PortfolioContenuEleve`) et de l'état des activités renvoyées — patron de la
// maison (cf. la séquence FLE).

import {
  clePartie,
  estEtapeSansTrace,
  typesDuDepot,
  type PortfolioContenuEleve,
  type PortfolioDepot,
  type PortfolioEtape,
  type TypeDepot,
} from '@/types/portfolio';
import type { EtatActiviteParcours } from '@/types/sequence-fle';

/** Une étape telle que l'élève la reçoit : + l'état de l'activité renvoyée. */
export interface EtapePortfolioVue extends PortfolioEtape {
  etatRenvoi?: EtatActiviteParcours;
}

export interface ParcoursPortfolio {
  devoirId: string;
  intitule: string;
  tacheFinale: string;
  consignes: string;
  etapes: EtapePortfolioVue[];
}

export const CONTENU_ELEVE_VIDE: PortfolioContenuEleve = { type: 'portfolio', reponses: {}, cochees: [] };

/** Lecture tolérante de `Travail.content` (vide, HTML d'un autre dispositif, JSON cassé → vide). */
export function lireContenuEleve(content: string | null | undefined): PortfolioContenuEleve {
  if (!content) return CONTENU_ELEVE_VIDE;
  try {
    const v = JSON.parse(content) as Partial<PortfolioContenuEleve>;
    if (!v || v.type !== 'portfolio') return CONTENU_ELEVE_VIDE;
    return {
      type: 'portfolio',
      reponses: v.reponses && typeof v.reponses === 'object' ? v.reponses : {},
      cochees: Array.isArray(v.cochees) ? v.cochees.filter((c): c is string => typeof c === 'string') : [],
      taches: Array.isArray(v.taches) ? v.taches.filter((c): c is string => typeof c === 'string') : [],
      derniereEtape: typeof v.derniereEtape === 'string' ? v.derniereEtape : undefined,
    };
  } catch {
    return CONTENU_ELEVE_VIDE;
  }
}

/**
 * Une adresse déposée par un élève, ramenée à une URL http(s) valide — ou
 * null. Partagé par l'écran (lien cliquable) et par le serveur (tri à
 * l'enregistrement) : jamais de `javascript:` ni de `data:` chez le prof.
 */
export function lienValide(brut: string): string | null {
  const t = brut.trim();
  if (!t) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (!u.hostname.includes('.')) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Ce que l'élève a déposé dans UNE partie d'un dépôt (le texte par défaut). */
export function reponseDe(
  contenu: PortfolioContenuEleve,
  etapeId: string,
  depotId: string,
  type: TypeDepot = 'texte'
): string {
  return contenu.reponses[clePartie(etapeId, depotId, type)] ?? '';
}

/**
 * Un dépôt est rempli quand TOUTES ses parties le sont (texte non vide ET
 * lien collé…) — pour un dépôt « groupe », quand le prof a ACCEPTÉ le groupe.
 */
export function depotRempli(contenu: PortfolioContenuEleve, etapeId: string, depot: PortfolioDepot): boolean {
  const types = typesDuDepot(depot);
  if (types.includes('groupe')) return contenu.groupeStatut === 'accepte';
  return types.every((t) => partieRemplie(t, reponseDe(contenu, etapeId, depot.id, t)));
}

// Un lien ne compte que s'il est une vraie adresse (pas « drive.goo » à moitié
// tapé) ; un tableau, dès qu'une cellule est remplie.
function partieRemplie(type: TypeDepot, valeur: string): boolean {
  if (type === 'lien') return lienValide(valeur) !== null;
  if (type === 'tableau') return lireTableau(valeur).some((ligne) => ligne.some((c) => c.trim() !== ''));
  return valeur.trim() !== '';
}

/**
 * La partie « tableau » d'un dépôt : ses lignes, stockées en JSON
 * (`string[][]`) dans `reponses`. Lecture tolérante : tout ce qui n'est pas
 * un tableau de lignes de textes donne un tableau vide.
 */
export function lireTableau(valeur: string | null | undefined): string[][] {
  if (!valeur) return [];
  try {
    const v = JSON.parse(valeur);
    if (!Array.isArray(v)) return [];
    return v
      .filter((l): l is unknown[] => Array.isArray(l))
      .map((l) => l.map((c) => (typeof c === 'string' ? c : '')));
  } catch {
    return [];
  }
}

/** Au moins une partie du dépôt est remplie (pour « en cours »). */
export function depotEntame(contenu: PortfolioContenuEleve, etapeId: string, depot: PortfolioDepot): boolean {
  const types = typesDuDepot(depot);
  if (types.includes('groupe')) return !!contenu.groupeStatut;
  return types.some((t) => reponseDe(contenu, etapeId, depot.id, t).trim() !== '');
}

/**
 * L'étape est-elle PRÊTE à être soumise ? Renvoi : l'activité est remise.
 * Dépôts : les obligatoires sont remplis (aucun obligatoire : un au moins).
 */
export function prete(etape: EtapePortfolioVue, contenu: PortfolioContenuEleve): boolean {
  if (etape.nature === 'activite') return etape.etatRenvoi === 'fait';
  const depots = etape.depots ?? [];
  const obligatoires = depots.filter((d) => d.obligatoire !== false);
  if (obligatoires.length === 0) return depots.some((d) => depotRempli(contenu, etape.id, d));
  return obligatoires.every((d) => depotRempli(contenu, etape.id, d));
}

export type EtatEtape = 'a-faire' | 'en-cours' | 'prete' | 'soumise' | 'a-revoir' | 'validee' | 'a-reprendre';

export const ETAT_ETAPE_LABELS: Record<EtatEtape, string> = {
  'a-faire': 'à faire',
  'en-cours': 'en cours',
  prete: 'prête à soumettre',
  soumise: 'soumise',
  'a-revoir': 'resoumise',
  validee: 'validée',
  'a-reprendre': 'à reprendre',
};

/** Où en est une étape à soumettre (dépôts ou activité) — soumission et retour du prof compris. */
export function etatEtape(etape: EtapePortfolioVue, contenu: PortfolioContenuEleve): EtatEtape {
  const soumission = contenu.suivi?.soumissions[etape.id];
  const retour = contenu.suivi?.retours[etape.id];
  if (soumission) {
    // Le retour porte sur la DERNIÈRE soumission : il fait foi
    if (retour && retour.soumissionN >= soumission.n) return retour.decision === 'valide' ? 'validee' : 'a-reprendre';
    // Un retour plus ancien : l'élève a resoumis depuis
    return retour ? 'a-revoir' : 'soumise';
  }
  if (prete(etape, contenu)) return 'prete';
  if (etape.nature === 'activite') return etape.etatRenvoi === 'en-cours' ? 'en-cours' : 'a-faire';
  return (etape.depots ?? []).some((d) => depotEntame(contenu, etape.id, d)) ? 'en-cours' : 'a-faire';
}

/** La validation du prof ferme-t-elle la suite ? */
export function validationBloquante(etape: PortfolioEtape): boolean {
  return etape.validation?.bloquante === true;
}

export function faite(etape: EtapePortfolioVue, contenu: PortfolioContenuEleve): boolean {
  if (estEtapeSansTrace(etape)) return contenu.cochees.includes(etape.id);
  const etat = etatEtape(etape, contenu);
  if (validationBloquante(etape)) return etat === 'validee';
  return etat === 'soumise' || etat === 'a-revoir' || etat === 'validee';
}

/** L'étape a-t-elle commencé sans être finie ? */
export function enCours(etape: EtapePortfolioVue, contenu: PortfolioContenuEleve): boolean {
  if (faite(etape, contenu)) return false;
  if (estEtapeSansTrace(etape)) return false;
  return etatEtape(etape, contenu) !== 'a-faire';
}

/**
 * L'étape `i` est-elle fermée ? Une étape verrouillante non faite ferme la
 * suivante — et, par ricochet, toutes celles d'après (on ne saute pas un verrou).
 */
export function fermee(etapes: EtapePortfolioVue[], i: number, contenu: PortfolioContenuEleve): boolean {
  for (let k = 0; k < i; k++) {
    if (verrouilleLaSuite(etapes[k]) && !faite(etapes[k], contenu)) return true;
  }
  return false;
}

/** La première étape verrouillante non faite avant `i` — ce qu'il faut finir pour ouvrir `i`. */
export function verrouDe(etapes: EtapePortfolioVue[], i: number, contenu: PortfolioContenuEleve): EtapePortfolioVue | null {
  for (let k = 0; k < i; k++) {
    if (verrouilleLaSuite(etapes[k]) && !faite(etapes[k], contenu)) return etapes[k];
  }
  return null;
}

/** « Verrouille l'étape suivante », ou « la suite attend ma validation ». */
export function verrouilleLaSuite(etape: PortfolioEtape): boolean {
  return etape.verrouille === true || validationBloquante(etape);
}

export function avancement(etapes: EtapePortfolioVue[], contenu: PortfolioContenuEleve): { faites: number; total: number } {
  return { faites: etapes.filter((e) => faite(e, contenu)).length, total: etapes.length };
}

/**
 * Où ouvrir le portfolio : là où l'élève en était (`derniereEtape`), sinon la
 * première étape non faite et ouverte, sinon la dernière.
 */
export function indexDepart(etapes: EtapePortfolioVue[], contenu: PortfolioContenuEleve): number {
  if (etapes.length === 0) return 0;
  if (contenu.derniereEtape) {
    const i = etapes.findIndex((e) => e.id === contenu.derniereEtape);
    if (i >= 0 && !fermee(etapes, i, contenu)) return i;
  }
  const premiere = etapes.findIndex((e, i) => !faite(e, contenu) && !fermee(etapes, i, contenu));
  return premiere >= 0 ? premiere : etapes.length - 1;
}

/** Ce qu'il manque pour qu'une étape soit faite — dit en clair sous l'étape. */
export function cequiManque(etape: EtapePortfolioVue, contenu: PortfolioContenuEleve): string[] {
  if (estEtapeSansTrace(etape)) return contenu.cochees.includes(etape.id) ? [] : ['cocher l’étape'];
  if (faite(etape, contenu)) return [];
  const etat = etatEtape(etape, contenu);
  if (etat === 'a-reprendre') return ['reprendre l’étape selon le retour du professeur, puis la soumettre à nouveau'];
  if (etat === 'soumise' || etat === 'a-revoir') return ['la validation du professeur'];
  if (etat === 'prete') return ['soumettre l’étape au professeur'];
  if (etape.nature === 'activite') return ['remettre l’activité', 'puis soumettre l’étape'];
  return (etape.depots ?? [])
    .filter((d) => d.obligatoire !== false && !depotRempli(contenu, etape.id, d))
    .map((d) => (typesDuDepot(d).includes('groupe') ? 'l’acceptation du groupe par le professeur' : d.libelle || 'un dépôt'));
}

/** Échéance dépassée et étape non faite ? */
export function enRetard(etape: EtapePortfolioVue, contenu: PortfolioContenuEleve, aujourdhui = new Date()): boolean {
  if (!etape.echeance || faite(etape, contenu)) return false;
  const limite = new Date(`${etape.echeance}T23:59:59`);
  return !Number.isNaN(limite.getTime()) && limite.getTime() < aujourdhui.getTime();
}

export function echeanceLisible(iso: string | null | undefined, longue = false): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-BE', longue ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'short' });
}
