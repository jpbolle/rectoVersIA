// Comparaison des DEUX REGARDS sur une auto-évaluation : celui de l'élève et
// celui du prof, donnés aux mêmes questions.
//
// Ce fichier ne calcule aucune note. Ce qu'il mesure, c'est la LUCIDITÉ : un
// élève qui se situe où le prof le situe se voit juste ; un élève qui se place
// systématiquement plus bas se sous-estime, et l'inverse se surestime.
//
// RÈGLE DE FOND — seules les questions ORDONNÉES se comparent :
//  - sentiment de compétence (5 échelons, du plus faible au plus fort) ;
//  - échelle de 1 à 5.
// Une ÉMOTION ne se compare pas : personne ne peut dire à un élève qu'il s'est
// trompé en se sentant découragé. Un choix multiple et un texte ne se placent
// sur aucun axe. Ces questions restent à lire, jamais à confronter.
//
// Partagé serveur (profil) et client (écran de correction, onglet Évaluation).

import { ECHELLE_COMPETENCE, estLikertMatrice } from '@/types/autoevaluation';
import type {
  AutoEvalAnswer,
  AutoEvalQuestion,
  AutoEvalQuestionnaire,
} from '@/types/autoevaluation';

export type Lucidite = 'juste' | 'sousEstime' | 'surestime';

export interface EcartQuestion {
  // `AE-…` pour une question, `AE-…#3` pour la 4ᵉ ligne d'une échelle à items :
  // chaque ligne se compare séparément. Ne jamais s'en servir pour retrouver
  // la question dans le questionnaire sans couper au « # ».
  questionId: string;
  enonce: string;
  // Positions ramenées à une échelle de 1 à 5
  eleve: number;
  prof: number;
  // eleve - prof : négatif = l'élève se place plus bas que le prof
  ecart: number;
  lucidite: Lucidite;
  // Un écart d'un cran est une nuance ; deux crans ou plus, un vrai décalage
  net: boolean;
  competences: string[];
}

export interface BilanAutoEval {
  ecarts: EcartQuestion[];
  // Nombre de questions ordonnées auxquelles les DEUX ont répondu
  comparees: number;
  // Questions ordonnées en attente du regard du prof
  enAttenteProf: number;
  justes: number;
  sousEstimations: number;
  surestimations: number;
  // Moyenne des écarts signés — la tendance générale de l'élève
  ecartMoyen: number;
  tendance: Lucidite | null;
}

// Une question se compare-t-elle ? C'est la question centrale du module.
export function estComparable(q: AutoEvalQuestion): boolean {
  return q.type === 'competence' || q.type === 'likert';
}

// Position d'une réponse sur une échelle de 1 à 5, ou null si pas répondu
export function position(q: AutoEvalQuestion, a: AutoEvalAnswer | undefined): number | null {
  if (!a) return null;
  if (q.type === 'competence') {
    const i = ECHELLE_COMPETENCE.findIndex((e) => e.id === a.echelon);
    return i === -1 ? null : i + 1;
  }
  if (q.type === 'likert') {
    return typeof a.likert === 'number' && a.likert > 0 ? a.likert : null;
  }
  return null;
}

/**
 * Ce qui se compare dans UNE question — une ligne, ou plusieurs.
 *
 * Une échelle à items est une matrice de positions : chaque ligne est une
 * question ordonnée à part entière, avec sa propre lucidité. Les fondre en une
 * moyenne dirait à l'élève qu'il « se voit juste en moyenne », ce qui ne veut
 * rien dire — il peut se surestimer sur un point et se sous-estimer sur un
 * autre, et c'est justement ce qu'il faut lui montrer.
 */
function lignesComparables(q: AutoEvalQuestion): { cle: string; enonce: string; ligne: number | null }[] {
  if (!estLikertMatrice(q)) return [{ cle: q.id, enonce: q.enonce, ligne: null }];
  return (q.matriceItems ?? []).map((item, i) => ({
    cle: `${q.id}#${i}`,
    enonce: item.trim() ? `${q.enonce} — ${item}` : q.enonce,
    ligne: i,
  }));
}

/** Position d'une LIGNE d'échelle : la colonne cochée vaut 1 à 5. */
function positionLigne(
  q: AutoEvalQuestion,
  a: AutoEvalAnswer | undefined,
  ligne: number | null
): number | null {
  if (ligne === null) return position(q, a);
  const colonne = a?.matrice?.[ligne];
  return typeof colonne === 'number' ? colonne + 1 : null;
}

function lucditeDe(ecart: number): Lucidite {
  if (ecart === 0) return 'juste';
  return ecart < 0 ? 'sousEstime' : 'surestime';
}

export function comparer(
  quiz: AutoEvalQuestionnaire | null | undefined,
  reponsesEleve: Record<string, AutoEvalAnswer> | undefined,
  reponsesProf: Record<string, AutoEvalAnswer> | undefined
): BilanAutoEval {
  const vide: BilanAutoEval = {
    ecarts: [],
    comparees: 0,
    enAttenteProf: 0,
    justes: 0,
    sousEstimations: 0,
    surestimations: 0,
    ecartMoyen: 0,
    tendance: null,
  };
  if (!quiz?.questions?.length) return vide;

  const ecarts: EcartQuestion[] = [];
  let enAttenteProf = 0;

  quiz.questions.filter(estComparable).forEach((q) => {
    lignesComparables(q).forEach(({ cle, enonce, ligne }) => {
      const pEleve = positionLigne(q, reponsesEleve?.[q.id], ligne);
      const pProf = positionLigne(q, reponsesProf?.[q.id], ligne);
      if (pProf === null) {
        // Le prof ne s'est pas encore prononcé : rien à comparer, mais on le compte
        if (pEleve !== null) enAttenteProf++;
        return;
      }
      if (pEleve === null) return; // l'élève n'a pas répondu : pas d'écart à mesurer

      const ecart = pEleve - pProf;
      ecarts.push({
        questionId: cle,
        enonce,
        eleve: pEleve,
        prof: pProf,
        ecart,
        lucidite: lucditeDe(ecart),
        net: Math.abs(ecart) >= 2,
        competences: q.competences ?? [],
      });
    });
  });

  const justes = ecarts.filter((e) => e.lucidite === 'juste').length;
  const sousEstimations = ecarts.filter((e) => e.lucidite === 'sousEstime').length;
  const surestimations = ecarts.filter((e) => e.lucidite === 'surestime').length;
  const somme = ecarts.reduce((s, e) => s + e.ecart, 0);
  const ecartMoyen = ecarts.length ? somme / ecarts.length : 0;

  // La tendance ne se prononce qu'au-delà d'un demi-cran de moyenne : en deçà,
  // l'élève est globalement juste et le dire autrement serait abusif.
  let tendance: Lucidite | null = null;
  if (ecarts.length) {
    if (Math.abs(ecartMoyen) < 0.5) tendance = 'juste';
    else tendance = ecartMoyen < 0 ? 'sousEstime' : 'surestime';
  }

  return {
    ecarts,
    comparees: ecarts.length,
    enAttenteProf,
    justes,
    sousEstimations,
    surestimations,
    ecartMoyen,
    tendance,
  };
}

export const LUCIDITE_LABELS: Record<Lucidite, string> = {
  juste: 'Se voit juste',
  sousEstime: 'Se sous-estime',
  surestime: 'Se surestime',
};

export const LUCIDITE_COURT: Record<Lucidite, string> = {
  juste: 'juste',
  sousEstime: 'sous-estimation',
  surestime: 'surestimation',
};

// Phrase adressée à l'élève — on lui parle de lui, sans le juger
export function phraseTendance(bilan: BilanAutoEval): string {
  if (!bilan.comparees) return '';
  switch (bilan.tendance) {
    case 'juste':
      return 'Ton regard sur ton travail rejoint celui de ton professeur : tu te situes avec justesse.';
    case 'sousEstime':
      return 'Tu te places plus bas que ton professeur ne te place : tu vaux mieux que ce que tu crois.';
    case 'surestime':
      return 'Tu te places plus haut que ton professeur ne te place : il reste du chemin là où tu te croyais arrivé.';
    default:
      return '';
  }
}
