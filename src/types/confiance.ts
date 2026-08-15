// DEGRÉ D'ASSURANCE — ce que l'élève pense de sa réponse au moment où il la
// donne, avant de connaître sa note.
//
// C'est un geste métacognitif, pas une note : rien de ce qui est saisi ici
// n'entre dans le score. Ce qui est intéressant, c'est l'ÉCART entre ce que
// l'élève croyait et ce qu'il a obtenu — la même lucidité que mesure
// l'auto-évaluation (voir src/lib/autoeval-scoring.ts), mais posée question
// par question et sur des activités notées.
//
// Il se saisit dans le questionnaire de lecture (application) et dans le
// questionnaire de recherche (extension NavigKid), toujours AU MOMENT DE
// RÉPONDRE : demandé après coup, sur des réponses qu'on relit, le geste perd
// sa sincérité.

export type NiveauConfiance = 1 | 2 | 3;

export const CONFIANCE_SUR: NiveauConfiance = 3;
export const CONFIANCE_DOUTE: NiveauConfiance = 2;
export const CONFIANCE_FAUX: NiveauConfiance = 1;

export interface EchelonConfiance {
  niveau: NiveauConfiance;
  emoji: string;
  label: string;              // ce que lit l'élève
  court: string;              // pour les tableaux et les récapitulatifs
  // Réussite que ce niveau laisse attendre, en pourcentage de la question.
  // Bornes fixées avec l'utilisateur le 2026-08-15.
  seuilMin: number;           // inclus
  seuilMax: number;           // inclus
}

// Du plus assuré au moins assuré — l'ordre d'affichage sous une réponse
export const ECHELLE_CONFIANCE: EchelonConfiance[] = [
  {
    niveau: 3,
    emoji: '😀',
    label: 'Je suis sûr de ma réponse',
    court: 'Sûr',
    seuilMin: 70,
    seuilMax: 100,
  },
  {
    niveau: 2,
    emoji: '😐',
    label: "J'ai un doute",
    court: 'Doute',
    seuilMin: 45,
    seuilMax: 69,
  },
  {
    niveau: 1,
    emoji: '😟',
    label: 'Je sais que c’est faux',
    court: 'Faux',
    seuilMin: 0,
    seuilMax: 44,
  },
];

export function echelonConfiance(niveau: NiveauConfiance): EchelonConfiance {
  return ECHELLE_CONFIANCE.find((e) => e.niveau === niveau) ?? ECHELLE_CONFIANCE[1];
}

// Tranche de réussite d'une question, dans le même vocabulaire que les
// smileys : c'est elle qu'on confronte au degré d'assurance annoncé.
export function trancheDuScore(percent: number): NiveauConfiance {
  if (percent >= 70) return 3;
  if (percent >= 45) return 2;
  return 1;
}

export function isNiveauConfiance(v: unknown): v is NiveauConfiance {
  return v === 1 || v === 2 || v === 3;
}
