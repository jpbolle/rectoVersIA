// L'ÉTAT d'un portfolio côté élève — calcul PUR, partagé par la page élève,
// le sommaire du rail et (plus tard) la lecture de la copie par le prof.
//
//  faite(étape)  = renvoi → l'activité est remise
//                  dépôts → tous les dépôts OBLIGATOIRES sont remplis
//                  sans trace → cochée à la main par l'élève
//  fermee(i)     = l'étape i-1 porte `verrouille` et n'est pas faite
//                  (une étape fermée ferme aussi tout ce qui suit)
//
// Rien n'est stocké : l'état se DÉDUIT de la copie (`Travail.content`, JSON
// `PortfolioContenuEleve`) et de l'état des activités renvoyées — patron de la
// maison (cf. la séquence FLE).

import { cleChamp, estEtapeSansTrace, type PortfolioContenuEleve, type PortfolioDepot, type PortfolioEtape } from '@/types/portfolio';
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
      derniereEtape: typeof v.derniereEtape === 'string' ? v.derniereEtape : undefined,
    };
  } catch {
    return CONTENU_ELEVE_VIDE;
  }
}

export function reponseDe(contenu: PortfolioContenuEleve, etapeId: string, depotId: string): string {
  return contenu.reponses[cleChamp(etapeId, depotId)] ?? '';
}

/** Un dépôt est rempli : texte non vide — ou, pour un dépôt « groupe », groupe ACCEPTÉ par le prof. */
export function depotRempli(contenu: PortfolioContenuEleve, etapeId: string, depot: PortfolioDepot): boolean {
  if (depot.type === 'groupe') return contenu.groupeStatut === 'accepte';
  return reponseDe(contenu, etapeId, depot.id).trim() !== '';
}

export function faite(etape: EtapePortfolioVue, contenu: PortfolioContenuEleve): boolean {
  if (etape.nature === 'activite') return etape.etatRenvoi === 'fait';
  if (estEtapeSansTrace(etape)) return contenu.cochees.includes(etape.id);
  const obligatoires = (etape.depots ?? []).filter((d) => d.obligatoire !== false);
  // Aucun dépôt obligatoire : l'étape est faite dès qu'un dépôt est rempli
  if (obligatoires.length === 0) return (etape.depots ?? []).some((d) => depotRempli(contenu, etape.id, d));
  return obligatoires.every((d) => depotRempli(contenu, etape.id, d));
}

/** L'étape a-t-elle commencé sans être finie ? (au moins un dépôt rempli, ou activité en cours) */
export function enCours(etape: EtapePortfolioVue, contenu: PortfolioContenuEleve): boolean {
  if (faite(etape, contenu)) return false;
  if (etape.nature === 'activite') return etape.etatRenvoi === 'en-cours';
  return (etape.depots ?? []).some((d) => depotRempli(contenu, etape.id, d));
}

/**
 * L'étape `i` est-elle fermée ? Une étape verrouillante non faite ferme la
 * suivante — et, par ricochet, toutes celles d'après (on ne saute pas un verrou).
 */
export function fermee(etapes: EtapePortfolioVue[], i: number, contenu: PortfolioContenuEleve): boolean {
  for (let k = 0; k < i; k++) {
    if (etapes[k].verrouille && !faite(etapes[k], contenu)) return true;
  }
  return false;
}

/** La première étape verrouillante non faite avant `i` — ce qu'il faut finir pour ouvrir `i`. */
export function verrouDe(etapes: EtapePortfolioVue[], i: number, contenu: PortfolioContenuEleve): EtapePortfolioVue | null {
  for (let k = 0; k < i; k++) {
    if (etapes[k].verrouille && !faite(etapes[k], contenu)) return etapes[k];
  }
  return null;
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
  if (etape.nature === 'activite') return etape.etatRenvoi === 'fait' ? [] : ['remettre l’activité'];
  if (estEtapeSansTrace(etape)) return contenu.cochees.includes(etape.id) ? [] : ['cocher l’étape'];
  return (etape.depots ?? [])
    .filter((d) => d.obligatoire !== false && !depotRempli(contenu, etape.id, d))
    .map((d) => (d.type === 'groupe' ? 'l’acceptation du groupe par le professeur' : d.libelle || 'un dépôt'));
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
