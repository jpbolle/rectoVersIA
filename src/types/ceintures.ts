// Ceintures de compétence — la progression d'un élève dans une UAA.
//
// Le modèle est celui du judo, repris tel quel du tableau de bord de JP : une
// certification réussie accorde la ceinture qu'elle porte, et la ceinture la
// plus haute obtenue dit où en est l'élève dans cette UAA.
//
//   blanche → jaune → verte → bleue → NOIRE → rouge
//                                       ↑        ↑
//                        réussite de l'UAA    dépassement
//
// La NOIRE n'est donc pas le bout du parcours : c'est le seuil de réussite,
// celui qui fait apparaître le badge de l'UAA. La rouge se gagne au-delà.
//
// Les images vivent dans public/ceintures/ (un karatéka par couleur, un
// bouclier par UAA). Les couleurs servent aux pastilles et aux arcs de la roue
// — elles ne remplacent jamais l'image, elles l'accompagnent.

export interface Ceinture {
  id: string;
  rang: number;      // 1 → 6, l'ordre de progression
  label: string;
  couleur: string;   // pastilles, arcs de la roue
  contour?: string;  // pour la blanche, invisible sans trait
  image: string;
}

export const CEINTURES: Ceinture[] = [
  { id: 'blanche', rang: 1, label: 'Blanche', couleur: '#f4f1ea', contour: '#c9c2b4', image: '/ceintures/ceinture-blanche.png' },
  { id: 'jaune',   rang: 2, label: 'Jaune',   couleur: '#e8b33c', image: '/ceintures/ceinture-jaune.png' },
  { id: 'verte',   rang: 3, label: 'Verte',   couleur: '#3d8f5f', image: '/ceintures/ceinture-verte.png' },
  { id: 'bleue',   rang: 4, label: 'Bleue',   couleur: '#3d6fa6', image: '/ceintures/ceinture-bleue.png' },
  { id: 'noire',   rang: 5, label: 'Noire',   couleur: '#2b2926', image: '/ceintures/ceinture-noire.png' },
  { id: 'rouge',   rang: 6, label: 'Rouge',   couleur: '#b8362f', image: '/ceintures/ceinture-rouge.png' },
];

export const CEINTURE_IDS = CEINTURES.map((c) => c.id);

// La BLANCHE est acquise d'emblée : elle ne se gagne pas, elle dit qu'on entre
// dans le parcours. Aucune certification ne l'accorde — d'où sa sortie des
// menus déroulants (CEINTURES_ATTRIBUABLES) — et tout élève la porte déjà.
export const CEINTURE_DEPART = 'blanche';

export const CEINTURES_ATTRIBUABLES = CEINTURES.filter((c) => c.id !== CEINTURE_DEPART);

// Une certification est réussie — et sa ceinture acquise — à partir de 60 %.
// C'est le seuil « Suffisant » de l'échelle à 6 niveaux des grilles.
export const SEUIL_CERTIFICATION = 60;

// La ceinture qui vaut réussite de l'UAA (et déclenche son badge)
export const CEINTURE_REUSSITE = 'noire';

export function ceintureParId(id: string | null | undefined): Ceinture | null {
  if (!id) return null;
  return CEINTURES.find((c) => c.id === id) ?? null;
}

export function rangDe(id: string | null | undefined): number {
  return ceintureParId(id)?.rang ?? 0;
}

// La plus haute d'une série — les ceintures ne se gagnent pas forcément dans
// l'ordre : le prof accorde la ceinture qu'il veut à chaque certification.
// Le plancher est la BLANCHE : elle est acquise dès l'entrée dans le parcours.
export function ceintureLaPlusHaute(ids: (string | null | undefined)[]): string {
  let meilleure: string = CEINTURE_DEPART;
  ids.forEach((id) => {
    if (rangDe(id) > rangDe(meilleure)) meilleure = id ?? CEINTURE_DEPART;
  });
  return meilleure;
}

// L'élève est en réussite dans une UAA dès la ceinture noire
export function estEnReussite(ceintureId: string | null | undefined): boolean {
  return rangDe(ceintureId) >= rangDe(CEINTURE_REUSSITE);
}

// Le bouclier d'une UAA — affiché quand elle est acquise
export function badgeUaa(uaa: string | number): string {
  return `/ceintures/badge-uaa-${uaa}.png`;
}
