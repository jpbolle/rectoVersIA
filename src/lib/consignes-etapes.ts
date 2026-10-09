// Les consignes d'une activité, lues comme une FEUILLE DE ROUTE.
//
// `Devoir.consignes` reste un texte libre (décision de JP du 2026-10-09,
// option A) : aucune structure ajoutée côté prof, aucune migration. C'est à la
// lecture qu'on découpe — une ligne = une étape cochable par l'élève.
//
// ⚠ La clé d'une étape est SON TEXTE (normalisé), jamais sa position : si le
// prof intercale une ligne après coup, les coches des autres lignes ne se
// décalent pas (piège vécu sur KitSchool, journal › ateliers personnalisés,
// corrigé le 2026-08-20 en passant à des identifiants stables). Le prix : une
// ligne reformulée perd sa coche — et c'est le comportement voulu, puisque
// la consigne a changé.
//
// Une ligne qui se termine par « : » est un TITRE (« Pour ce travail : »),
// affiché mais pas cochable.

export interface ConsigneEtape {
  /** Clé stable de la coche — le texte normalisé (espaces repliés) */
  cle: string;
  /** Texte affiché, débarrassé d'une éventuelle puce de tête (-, •, 1.) */
  texte: string;
  /** `titre` = ligne d'introduction, non cochable */
  genre: 'etape' | 'titre';
}

const PUCE_DE_TETE = /^(?:[-–—•*]|\d{1,2}[.)])\s+/;

function normaliser(ligne: string): string {
  return ligne.replace(/\s+/g, ' ').trim();
}

/** Découpe le texte des consignes en étapes et titres. Les lignes vides sont ignorées. */
export function decouperConsignes(consignes: string | null | undefined): ConsigneEtape[] {
  if (!consignes) return [];
  const vues = new Set<string>();
  const etapes: ConsigneEtape[] = [];
  for (const brute of consignes.split('\n')) {
    const ligne = normaliser(brute);
    if (!ligne) continue;
    const texte = ligne.replace(PUCE_DE_TETE, '');
    if (/:$/.test(texte)) {
      etapes.push({ cle: '', texte, genre: 'titre' });
      continue;
    }
    // Deux lignes identiques partageraient une clé : la seconde en reçoit une
    // dérivée, pour que cocher l'une ne coche pas l'autre.
    let cle = texte;
    let n = 2;
    while (vues.has(cle)) cle = `${texte} (${n++})`;
    vues.add(cle);
    etapes.push({ cle, texte, genre: 'etape' });
  }
  return etapes;
}

/** Avancement : étapes cochées encore présentes dans le texte / étapes cochables. */
export function avancementConsignes(
  etapes: ConsigneEtape[],
  cochees: readonly string[] | null | undefined
): { faites: number; total: number } {
  const set = new Set(cochees ?? []);
  const cochables = etapes.filter((e) => e.genre === 'etape');
  return {
    faites: cochables.filter((e) => set.has(e.cle)).length,
    total: cochables.length,
  };
}

/** Bascule une clé dans la liste des coches, sans doublon. */
export function basculerConsigne(cochees: readonly string[] | null | undefined, cle: string): string[] {
  const actuelles = cochees ?? [];
  return actuelles.includes(cle) ? actuelles.filter((c) => c !== cle) : [...actuelles, cle];
}

/** Garde-fou serveur : une liste de textes courts, rien d'autre. */
export function nettoyerConsignesCochees(valeur: unknown): string[] | null {
  if (!Array.isArray(valeur)) return null;
  const propres = valeur
    .filter((v): v is string => typeof v === 'string')
    .map((v) => normaliser(v))
    .filter((v) => v.length > 0 && v.length <= 1000);
  return Array.from(new Set(propres)).slice(0, 200);
}
