// Écart entre le degré d'assurance annoncé par l'élève et le résultat obtenu.
//
// Le principe est celui de l'auto-évaluation : on ne juge pas la réponse, on
// regarde si l'élève SAIT où il en est. Un élève qui se dit sûr et réussit se
// voit juste ; celui qui se dit sûr et rate se surestime ; celui qui annonce
// une erreur et réussit se sous-estime.
//
// La comparaison passe par des TRANCHES et non par des points (décision du
// 2026-08-15) : « sûr » vaut 70 % et plus, « doute » de 45 à 69 %, « je sais
// que c'est faux » en dessous de 45. Un écart en crans se commente avec un
// élève, un écart en points ne se commente pas.
//
// Ne comptent que les questions à la fois NOTÉES et ACCOMPAGNÉES d'un smiley :
// une question sans barème n'a pas de résultat à confronter, et le smiley reste
// facultatif — l'élève n'est jamais contraint de se prononcer.
//
// Partagé serveur (profil) et client (onglet Évaluation).

import { trancheDuScore } from '@/types/confiance';
import type { NiveauConfiance } from '@/types/confiance';
import type { Lucidite } from '@/lib/autoeval-scoring';

export interface EcartConfiance {
  questionId: string;
  enonce: string;
  annonce: NiveauConfiance;   // ce que l'élève pensait
  obtenu: NiveauConfiance;    // la tranche où il est réellement tombé
  percent: number;            // score réel de la question, en %
  // annonce - obtenu : positif = il se croyait meilleur qu'il n'a été
  ecart: number;
  lucidite: Lucidite;
  // Un cran d'écart est une nuance ; deux crans, un vrai décalage
  net: boolean;
}

export interface BilanConfiance {
  ecarts: EcartConfiance[];
  comparees: number;          // questions notées ET accompagnées d'un smiley
  sansSmiley: number;         // questions notées où l'élève ne s'est pas prononcé
  justes: number;
  sousEstimations: number;
  surestimations: number;
  ecartMoyen: number;         // moyenne des écarts signés
  tendance: Lucidite | null;  // null quand rien n'est comparable
}

export const BILAN_CONFIANCE_VIDE: BilanConfiance = {
  ecarts: [],
  comparees: 0,
  sansSmiley: 0,
  justes: 0,
  sousEstimations: 0,
  surestimations: 0,
  ecartMoyen: 0,
  tendance: null,
};

function luciditeDe(ecart: number): Lucidite {
  if (ecart === 0) return 'juste';
  return ecart > 0 ? 'surestime' : 'sousEstime';
}

/** Une question à confronter : son résultat et le smiley que l'élève a posé. */
export interface EntreeConfiance {
  questionId: string;
  enonce: string;
  /** null quand la question n'est pas notée (pas de barème, ou pas encore corrigée) */
  percent: number | null;
  /** undefined quand l'élève ne s'est pas prononcé */
  confiance?: NiveauConfiance;
}

export function bilanConfiance(entrees: EntreeConfiance[]): BilanConfiance {
  const ecarts: EcartConfiance[] = [];
  let sansSmiley = 0;

  for (const e of entrees) {
    if (e.percent === null) continue;      // rien à confronter
    if (!e.confiance) {
      sansSmiley++;
      continue;
    }
    const obtenu = trancheDuScore(e.percent);
    const ecart = e.confiance - obtenu;
    ecarts.push({
      questionId: e.questionId,
      enonce: e.enonce,
      annonce: e.confiance,
      obtenu,
      percent: e.percent,
      ecart,
      lucidite: luciditeDe(ecart),
      net: Math.abs(ecart) >= 2,
    });
  }

  if (ecarts.length === 0) return { ...BILAN_CONFIANCE_VIDE, sansSmiley };

  const justes = ecarts.filter((e) => e.lucidite === 'juste').length;
  const sousEstimations = ecarts.filter((e) => e.lucidite === 'sousEstime').length;
  const surestimations = ecarts.filter((e) => e.lucidite === 'surestime').length;
  const somme = ecarts.reduce((s, e) => s + e.ecart, 0);
  const ecartMoyen = Math.round((somme / ecarts.length) * 100) / 100;

  // La tendance ne se prononce que si un décalage se dessine : à moins d'un
  // demi-cran de moyenne, l'élève se voit juste.
  const tendance: Lucidite =
    Math.abs(ecartMoyen) < 0.5 ? 'juste' : ecartMoyen > 0 ? 'surestime' : 'sousEstime';

  return {
    ecarts,
    comparees: ecarts.length,
    sansSmiley,
    justes,
    sousEstimations,
    surestimations,
    ecartMoyen,
    tendance,
  };
}

// Phrase adressée à l'élève, dans l'onglet Évaluation
export function phraseLucidite(bilan: BilanConfiance): string {
  if (bilan.comparees === 0) return '';
  const n = bilan.comparees;
  switch (bilan.tendance) {
    case 'surestime':
      return `Sur ${n} question${n > 1 ? 's' : ''}, tu t’es cru plus sûr que tu ne l’étais ${bilan.surestimations} fois. Se relire avant de valider aide souvent.`;
    case 'sousEstime':
      return `Sur ${n} question${n > 1 ? 's' : ''}, tu as réussi ${bilan.sousEstimations} fois là où tu doutais. Tu en sais plus que tu ne le crois.`;
    default:
      return `Sur ${n} question${n > 1 ? 's' : ''}, tu as bien vu où tu en étais ${bilan.justes} fois. Tu te connais bien.`;
  }
}
