// ─── Découpe d'un bloc collé en plusieurs blocs ───
//
// Le besoin (JP, 2026-08-16) : encoder une scène réplique par réplique — un
// bloc, une tirade, un locuteur, on recommence — décourage avant la dixième.
// Ce qu'il veut : COLLER LA SCÈNE ENTIÈRE, puis la découper de l'intérieur.
// La souris passe entre deux lignes, un trait apparaît, et l'action choisie
// insère un bloc à cet endroit en renvoyant la suite dans un bloc de plus.
//
// Toute la logique vit ici, hors du composant : c'est du découpage de chaînes,
// ça se lit et ça se corrige sans avoir à ouvrir un écran.

import type { OeuvreBloc } from '@/types/oeuvre';

/**
 * Les LIGNES d'un bloc, au sens où le prof les voit à l'écran.
 *
 *  - `vers`  : une ligne = un vers. C'est le texte brut, séparé par \n.
 *  - `texte` : une ligne = un élément de premier niveau du HTML de Tiptap
 *              (<p>, <h2>, <ul>…). Découper au milieu d'une balise
 *              produirait du HTML cassé — on ne coupe donc qu'entre éléments.
 *
 * Les autres types (image, vidéo, audio) n'ont pas de lignes : on ne les
 * découpe pas.
 */
export function lignesDuBloc(bloc: OeuvreBloc): string[] {
  const contenu = bloc.contenu ?? '';
  if (bloc.type === 'vers') return contenu.split('\n');
  if (bloc.type !== 'texte') return [];

  // Balayage : on accumule les caractères et on ferme une ligne dès qu'une
  // balise fermante de premier niveau se referme (profondeur revenue à 0).
  // Un simple `split('</p>')` casserait sur une liste, où les <li> sont
  // imbriqués dans un <ul> qui, lui, est la ligne.
  const lignes: string[] = [];
  let courante = '';
  let profondeur = 0;
  const jetons = contenu.split(/(<\/?[a-zA-Z][^>]*>)/).filter((x) => x !== '');

  for (const jeton of jetons) {
    courante += jeton;
    if (!jeton.startsWith('<')) continue;
    // Balise auto-fermante (<br />, <img …/>) : ne change pas la profondeur
    if (jeton.endsWith('/>') || /^<(br|img|hr|input)\b/i.test(jeton)) continue;
    if (jeton.startsWith('</')) {
      profondeur = Math.max(0, profondeur - 1);
      if (profondeur === 0) {
        lignes.push(courante);
        courante = '';
      }
    } else {
      profondeur += 1;
    }
  }
  if (courante.trim()) lignes.push(courante);
  return lignes.length ? lignes : [contenu];
}

/** L'inverse de `lignesDuBloc` — le séparateur dépend du type. */
export function rejoindreLignes(type: OeuvreBloc['type'], lignes: string[]): string {
  return type === 'vers' ? lignes.join('\n') : lignes.join('');
}

/** Le texte visible d'une ligne, balises retirées. */
export function ligneEnTexte(ligne: string): string {
  return ligne
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Cette ligne est-elle un NOM DE PERSONNAGE ?
 *
 * Dans une scène de théâtre collée, le locuteur est une ligne à part, courte
 * et en capitales : « ORGON », « MADAME PERNELLE », « ORGON, à Dorine. ».
 * La didascalie qui suit la virgule fait partie de l'indication de jeu : on la
 * garde dans le locuteur, mais on ne la teste pas — elle est en minuscules.
 *
 * Volontairement STRICT : une fausse détection ampute le texte d'une ligne,
 * ce qui est bien plus coûteux qu'un locuteur à saisir à la main.
 */
export function ressembleAUnLocuteur(ligne: string): boolean {
  const t = ligneEnTexte(ligne);
  if (!t || t.length > 60) return false;
  // Une réplique se termine par une ponctuation forte ; un nom, non. Le point
  // final reste toléré : « ORGON, à Dorine. » est une indication de jeu.
  if (/[!?…»:]$/.test(t)) return false;
  const avantVirgule = t.split(',')[0].trim();
  if (!avantVirgule) return false;
  const lettres = [...avantVirgule].filter((c) => /\p{L}/u.test(c));
  if (lettres.length < 2) return false;
  const majuscules = lettres.filter((c) => c === c.toLocaleUpperCase('fr')).length;
  return majuscules / lettres.length >= 0.8;
}

/**
 * Sort le nom du personnage du corps du texte et le pose dans `locuteur`.
 * Ne touche à rien si le bloc a déjà un locuteur : le prof l'a mis, il fait foi.
 */
export function extraireLocuteur(bloc: OeuvreBloc): OeuvreBloc {
  if (bloc.type !== 'vers' || bloc.locuteur?.trim()) return bloc;
  const lignes = lignesDuBloc(bloc);
  // On saute les lignes vides du début : un collage en apporte souvent
  let i = 0;
  while (i < lignes.length && !ligneEnTexte(lignes[i])) i++;
  if (i >= lignes.length || !ressembleAUnLocuteur(lignes[i])) return bloc;
  return {
    ...bloc,
    locuteur: ligneEnTexte(lignes[i]),
    contenu: rejoindreLignes(bloc.type, lignes.slice(i + 1)).replace(/^\n+/, ''),
  };
}

export interface ResultatDecoupe {
  /** Le bloc d'origine, réduit à ce qui était AU-DESSUS du trait */
  haut: OeuvreBloc;
  /** Le bloc inséré à l'endroit du trait — absent pour une simple coupure */
  insere: OeuvreBloc | null;
  /** Ce qui était EN DESSOUS, dans un bloc neuf du même type */
  bas: OeuvreBloc;
}

/**
 * Coupe `bloc` avant la ligne d'index `index` et insère éventuellement un bloc
 * neuf entre les deux moitiés.
 *
 * `index` vaut au minimum 1 et au maximum lignes.length - 1 : on ne coupe
 * qu'ENTRE deux lignes, jamais au bord — sans quoi l'une des deux moitiés
 * serait vide, et le prof se retrouverait avec un bloc fantôme à supprimer.
 */
export function decouperBloc(
  bloc: OeuvreBloc,
  index: number,
  insertion: OeuvreBloc | null,
  nouvelId: () => string
): ResultatDecoupe | null {
  const lignes = lignesDuBloc(bloc);
  if (index < 1 || index >= lignes.length) return null;

  const haut: OeuvreBloc = {
    ...bloc,
    contenu: rejoindreLignes(bloc.type, lignes.slice(0, index)),
  };
  const bas: OeuvreBloc = {
    id: nouvelId(),
    type: bloc.type,
    contenu: rejoindreLignes(bloc.type, lignes.slice(index)),
    // La face suit : on découpe dans une face, les morceaux y restent.
    ...(bloc.face ? { face: bloc.face } : {}),
  };

  // Détection du locuteur sur LES DEUX moitiés : à la première coupure, le
  // nom du personnage de la première réplique est encore dans le haut.
  return {
    haut: extraireLocuteur(haut),
    insere: insertion,
    bas: extraireLocuteur(bas),
  };
}
