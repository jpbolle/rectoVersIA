// Écart entre l'auto-évaluation de l'élève et la correction du prof, sur une
// grille d'écriture.
//
// C'est le cas le plus simple des trois mesures de lucidité de l'application :
// ici, l'élève et le prof se prononcent sur LES MÊMES CRITÈRES et LA MÊME
// ÉCHELLE à six niveaux. L'écart se lit donc directement en crans, sans
// conversion ni tranche — contrairement au degré d'assurance, où un smiley doit
// être rapproché d'un pourcentage (voir confiance-scoring.ts).
//
// Ne comptent que les critères que LES DEUX ont évalués : un critère où l'élève
// ne s'est pas prononcé, ou que le prof n'a pas encore noté, n'a rien à
// confronter. Les critères masqués pour l'activité sont exclus.
//
// Rien ici n'est une note : le score de l'élève n'entre dans aucun calcul de
// points, il ne sert qu'à mesurer l'écart avec celui du prof.

import { LEVEL_LABELS, LEVEL_PERCENTAGES } from '@/types/grille';
import type { Lucidite } from '@/lib/autoeval-scoring';

// Le strict nécessaire au calcul : la grille complète côté client (`Grille`),
// mais aussi la forme allégée que le profil charge côté serveur (`GrilleEntry`
// dans profil-stats.ts). Exiger `Grille` obligerait le profil à recharger des
// grilles entières pour trois champs.
export interface GrillePourLucidite {
  criteria: { id: string; name: string; weight: number }[];
}

export interface EcartCritere {
  criterionId: string;
  nom: string;
  eleve: number;              // niveau 0-5 que l'élève s'est attribué
  prof: number;               // niveau 0-5 retenu par le professeur
  ecart: number;              // eleve - prof, en crans ; positif = il se surestime
  lucidite: Lucidite;
  net: boolean;               // deux crans ou plus : un vrai décalage
}

export interface BilanGrille {
  ecarts: EcartCritere[];
  comparees: number;
  /** Critères évalués par le prof mais que l'élève n'a pas renseignés */
  sansAutoEval: number;
  justes: number;
  sousEstimations: number;
  surestimations: number;
  ecartMoyen: number;
  tendance: Lucidite | null;
  /** Score que l'élève s'attribuait, en % — null si rien de comparable */
  scoreEleve: number | null;
  /** Score du prof sur les mêmes critères, en % */
  scoreProf: number | null;
}

export const BILAN_GRILLE_VIDE: BilanGrille = {
  ecarts: [],
  comparees: 0,
  sansAutoEval: 0,
  justes: 0,
  sousEstimations: 0,
  surestimations: 0,
  ecartMoyen: 0,
  tendance: null,
  scoreEleve: null,
  scoreProf: null,
};

function luciditeDe(ecart: number): Lucidite {
  if (ecart === 0) return 'juste';
  return ecart > 0 ? 'surestime' : 'sousEstime';
}

export function bilanGrille(
  grille: GrillePourLucidite | null | undefined,
  selfEvaluation: Record<string, number> | null | undefined,
  evaluation: Record<string, number> | null | undefined,
  hiddenCriteria?: string[]
): BilanGrille {
  if (!grille || !evaluation) return BILAN_GRILLE_VIDE;

  const masques = new Set(hiddenCriteria || []);
  const ecarts: EcartCritere[] = [];
  let sansAutoEval = 0;
  let pointsEleve = 0;
  let pointsProf = 0;
  let poidsTotal = 0;

  for (const critere of grille.criteria) {
    const prof = evaluation[critere.id];
    if (prof === undefined) continue;              // pas encore corrigé
    if (masques.has(critere.id)) continue;         // critère retiré de l'activité

    const eleve = selfEvaluation?.[critere.id];
    if (eleve === undefined) {
      sansAutoEval++;
      continue;
    }

    const ecart = eleve - prof;
    ecarts.push({
      criterionId: critere.id,
      nom: critere.name,
      eleve,
      prof,
      ecart,
      lucidite: luciditeDe(ecart),
      net: Math.abs(ecart) >= 2,
    });

    // Les deux scores portent sur les MÊMES critères : les comparer n'aurait
    // aucun sens si l'un couvrait plus de terrain que l'autre.
    poidsTotal += critere.weight;
    pointsEleve += (critere.weight * (LEVEL_PERCENTAGES[eleve] ?? 0)) / 100;
    pointsProf += (critere.weight * (LEVEL_PERCENTAGES[prof] ?? 0)) / 100;
  }

  if (ecarts.length === 0) return { ...BILAN_GRILLE_VIDE, sansAutoEval };

  const somme = ecarts.reduce((s, e) => s + e.ecart, 0);
  const ecartMoyen = Math.round((somme / ecarts.length) * 100) / 100;

  return {
    ecarts,
    comparees: ecarts.length,
    sansAutoEval,
    justes: ecarts.filter((e) => e.lucidite === 'juste').length,
    sousEstimations: ecarts.filter((e) => e.lucidite === 'sousEstime').length,
    surestimations: ecarts.filter((e) => e.lucidite === 'surestime').length,
    ecartMoyen,
    // À moins d'un demi-cran de moyenne, l'élève se voit juste
    tendance:
      Math.abs(ecartMoyen) < 0.5 ? 'juste' : ecartMoyen > 0 ? 'surestime' : 'sousEstime',
    scoreEleve: poidsTotal > 0 ? Math.round((pointsEleve / poidsTotal) * 100) : null,
    scoreProf: poidsTotal > 0 ? Math.round((pointsProf / poidsTotal) * 100) : null,
  };
}

export function niveauLabel(niveau: number): string {
  return LEVEL_LABELS[niveau] ?? String(niveau);
}

// Phrase adressée à l'élève, sous le bilan
export function phraseGrille(bilan: BilanGrille): string {
  if (bilan.comparees === 0) return '';
  const ecartScore =
    bilan.scoreEleve !== null && bilan.scoreProf !== null
      ? Math.abs(bilan.scoreEleve - bilan.scoreProf)
      : null;

  switch (bilan.tendance) {
    case 'surestime':
      return `Tu t’es attribué ${bilan.scoreEleve} % là où ton professeur en retient ${bilan.scoreProf} %${
        ecartScore !== null ? ` — ${ecartScore} points d’écart` : ''
      }. Relis les critères où le décalage est le plus net : c’est là que tu ne vois pas encore ce qui est attendu.`;
    case 'sousEstime':
      return `Tu t’es attribué ${bilan.scoreEleve} % alors que ton professeur en retient ${bilan.scoreProf} %${
        ecartScore !== null ? ` — ${ecartScore} points d’écart` : ''
      }. Tu es plus solide que tu ne le crois.`;
    default:
      return `Tu t’es attribué ${bilan.scoreEleve} %, ton professeur ${bilan.scoreProf} %. Tu sais où tu en es : c’est précieux pour progresser seul.`;
  }
}
