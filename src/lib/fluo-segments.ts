// Découpage d'une suite de mots en SEGMENTS de même nature.
//
// Pourquoi ce fichier existe : un surlignage posé mot par mot saute
// par-dessus les espaces, et le passage se lit comme une série de mots
// barbouillés au lieu d'une phrase soulignée. Le fond doit donc être porté par
// la suite entière, espaces compris — c'est la règle déjà retenue pour le
// fluorage commenté des œuvres (`src/lib/oeuvre-commentaires.ts`), reprise ici
// pour les questions « Souligner du texte » (avec ou sans catégories) et pour
// la comparaison élève/attendu de la correction.
//
// Vit dans `lib` et non dans l'un des composants : `LectureQuizActivity` et
// `QuestionInteractions` s'importent déjà l'un l'autre, un helper posé dans
// l'un des deux fermerait le cycle.

export interface FluoSegment {
  /** Nature commune aux mots du segment ('' = rien à surligner) */
  nature: string;
  /** Indices des mots, dans l'ordre du texte */
  mots: number[];
}

export function segmenter(nb: number, natureDe: (i: number) => string): FluoSegment[] {
  const segments: FluoSegment[] = [];
  for (let i = 0; i < nb; i++) {
    const nature = natureDe(i);
    const dernier = segments[segments.length - 1];
    if (dernier && dernier.nature === nature) dernier.mots.push(i);
    else segments.push({ nature, mots: [i] });
  }
  return segments;
}
