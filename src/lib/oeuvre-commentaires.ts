// ═══════════════════════════════════════════════════════════════════════════
// LE FLUORAGE COMMENTÉ — ancrage des commentaires du prof sur les mots
// ═══════════════════════════════════════════════════════════════════════════
//
// Le prof surligne un mot ou un groupe de mots dans une scène et y attache un
// commentaire ; l'élève clique dessus et le lit.
//
// ANCRAGE PAR INDICES DE MOTS (arbitré le 2026-08-16) : un commentaire retient
// le rang du premier et du dernier mot qu'il couvre. Un seul mécanisme pour
// les deux sortes de blocs — l'extrait, en texte brut, et le bloc informatif,
// en HTML. D'où le tokeniseur ci-dessous, qui saute les balises.
//
// RE-ANCRAGE (arbitré le 2026-08-17) : le flux est désormais toujours
// modifiable, et un texte modifié décale tous les rangs qui le suivent. Chaque
// commentaire retient donc AUSSI les mots exacts qu'il surligne, et se
// recherche lui-même dans le nouveau texte. S'il ne s'y retrouve pas, il
// passe ORPHELIN et attend le prof : un commentaire perdu se réécrit, un
// commentaire posé sur les mauvais mots trompe l'élève sans prévenir.
//
// Aucune dépendance au DOM : ce fichier tourne aussi bien côté serveur que
// dans le navigateur.

import type { OeuvreBloc, OeuvreCommentaire } from '@/types/oeuvre';

/** Un morceau du contenu : du texte visible, ou une balise à laisser tranquille. */
type Morceau = { balise: true; brut: string } | { balise: false; brut: string };

/**
 * Découpe un contenu en balises et en texte visible.
 * Un bloc `vers` n'a pas de balise : tout est du texte.
 */
function morceaux(contenu: string, html: boolean): Morceau[] {
  if (!html) return [{ balise: false, brut: contenu }];
  return contenu
    .split(/(<[^>]+>)/)
    .filter((s) => s !== '')
    .map((s) => ({ balise: s.startsWith('<') && s.endsWith('>'), brut: s }));
}

/** Un mot = une suite de caractères sans espace. La ponctuation reste collée
 *  au mot : « Harpagon, » est UN mot. C'est ce que le prof sélectionne. */
const SEPARATEUR = /(\s+)/;

/** Les mots visibles d'un contenu, dans l'ordre de lecture. */
export function motsDuContenu(contenu: string, html: boolean): string[] {
  const out: string[] = [];
  for (const m of morceaux(contenu || '', html)) {
    if (m.balise) continue;
    for (const jeton of m.brut.split(SEPARATEUR)) {
      if (jeton.trim()) out.push(jeton);
    }
  }
  return out;
}

/** Les mots d'un bloc — seuls l'extrait et le bloc informatif en portent. */
export function motsDuBloc(bloc: OeuvreBloc): string[] {
  if (bloc.type !== 'vers' && bloc.type !== 'texte') return [];
  return motsDuContenu(bloc.contenu || '', bloc.type === 'texte');
}

/**
 * Des CARACTÈRES sélectionnés vers des RANGS DE MOTS.
 *
 * C'est ce que fournit un champ de saisie (`selectionStart` / `selectionEnd`),
 * et c'est là que le prof sélectionne réellement : cliquer un passage l'ouvre
 * en édition, un double-clic au repos n'a donc jamais lieu — le premier clic
 * ouvre le champ avant que le second n'arrive.
 *
 * Tout mot QUE LA SÉLECTION TOUCHE compte, même à moitié : personne ne
 * sélectionne « éper » dans « éperdument » pour commenter une demi-syllabe.
 */
export function indicesDepuisOffsets(
  contenu: string,
  debutCar: number,
  finCar: number
): { debut: number; fin: number } | null {
  if (finCar <= debutCar) return null;
  let rang = 0;
  let debut: number | null = null;
  let fin: number | null = null;
  const motif = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = motif.exec(contenu || '')) !== null) {
    const a = m.index;
    const b = a + m[0].length;
    // Le mot chevauche-t-il la sélection ?
    if (b > debutCar && a < finCar) {
      if (debut === null) debut = rang;
      fin = rang;
    }
    rang++;
  }
  return debut === null || fin === null ? null : { debut, fin };
}

/** Un bloc peut-il porter des commentaires ? Un média n'a pas de mots. */
export function accepteCommentaires(bloc: OeuvreBloc): boolean {
  return bloc.type === 'vers' || bloc.type === 'texte';
}

/**
 * Retrouver un commentaire dans un texte qui a changé.
 *
 * On cherche la suite exacte de ses mots. Plusieurs occurrences (« le » revient
 * cent fois) : on garde la PLUS PROCHE de l'ancien rang — c'est presque
 * toujours la bonne, et c'est la seule heuristique qui ne dépende pas du
 * hasard de l'ordre de recherche.
 */
export function reancrer(
  commentaire: OeuvreCommentaire,
  mots: string[]
): { debut: number; fin: number } | null {
  const cherches = (commentaire.mots || '').split(/\s+/).filter(Boolean);
  if (cherches.length === 0) return null;

  const occurrences: number[] = [];
  for (let i = 0; i + cherches.length <= mots.length; i++) {
    let ok = true;
    for (let j = 0; j < cherches.length; j++) {
      if (mots[i + j] !== cherches[j]) {
        ok = false;
        break;
      }
    }
    if (ok) occurrences.push(i);
  }
  if (occurrences.length === 0) return null;

  const proche = occurrences.reduce((a, b) =>
    Math.abs(b - commentaire.debut) < Math.abs(a - commentaire.debut) ? b : a
  );
  return { debut: proche, fin: proche + cherches.length - 1 };
}

/**
 * Recale TOUS les commentaires d'une section sur ses blocs actuels.
 * À appeler chaque fois que le prof enregistre une section : c'est le seul
 * moment où le texte a pu changer.
 */
export function recalerCommentaires(
  blocs: OeuvreBloc[],
  commentaires: OeuvreCommentaire[]
): OeuvreCommentaire[] {
  const motsParBloc = new Map(blocs.map((b) => [b.id, motsDuBloc(b)]));

  return commentaires.map((c) => {
    const mots = motsParBloc.get(c.blocId);
    // Le bloc a disparu : rien à quoi se raccrocher, le commentaire attend.
    if (!mots) return { ...c, orphelin: true };

    // Toujours en place ? On ne touche à rien — le cas courant, et le seul
    // qui doit être gratuit.
    const enPlace = mots.slice(c.debut, c.fin + 1).join(' ');
    if (enPlace && enPlace === c.mots) {
      return c.orphelin ? { ...c, orphelin: false } : c;
    }

    const retrouve = reancrer(c, mots);
    if (!retrouve) return { ...c, orphelin: true };
    return { ...c, debut: retrouve.debut, fin: retrouve.fin, orphelin: false };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// RENDU
// ═══════════════════════════════════════════════════════════════════════════

/** Les classes CSS à poser — elles viennent du module CSS de l'appelant. */
export interface ClassesBalisage {
  /** Chaque mot, pour que la sélection du prof sache sur quoi elle tombe */
  mot: string;
  /** Un passage commenté */
  marque: string;
  /** Un commentaire dont les mots n'ont pas été retrouvés (vue prof seulement) */
  orphelin?: string;
}

function echapper(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Le contenu d'un bloc, en HTML, avec CHAQUE MOT enveloppé.
 *
 * Deux raisons d'envelopper tous les mots et pas seulement les commentés :
 *  1. la sélection du prof se lit alors sans arithmétique d'offsets — il
 *     suffit de remonter au `[data-mot]` le plus proche ;
 *  2. le même rendu sert au prof et à l'élève, donc le surlignage ne peut
 *     pas diverger entre les deux.
 *
 * Les balises du bloc informatif traversent intactes : on n'enveloppe que le
 * texte visible.
 */
export function baliserContenu(
  contenu: string,
  html: boolean,
  zones: { id: string; debut: number; fin: number; orphelin?: boolean }[],
  classes: ClassesBalisage
): string {
  // Rang -> commentaire qui le couvre. Deux commentaires qui se chevauchent :
  // le dernier posé gagne, il n'y a pas de sens à empiler deux surlignages.
  const parMot = new Map<number, { id: string; orphelin?: boolean }>();
  zones.forEach((z) => {
    for (let i = z.debut; i <= z.fin; i++) parMot.set(i, { id: z.id, orphelin: z.orphelin });
  });

  let rang = 0;
  let out = '';
  // Commentaire dont le surlignage est OUVERT, et les espaces en attente.
  //
  // Le surlignage enveloppe la SUITE des mots d'un même commentaire, espaces
  // compris — un span par mot laissait un blanc entre chaque, et le passage se
  // lisait comme une série de mots barbouillés au lieu d'un passage continu.
  // Les espaces sont donc mis en attente : ils rejoignent le surlignage si le
  // mot suivant appartient au même commentaire, et restent dehors sinon.
  let ouvert: string | null = null;
  let attente = '';

  const fermer = () => {
    if (ouvert !== null) {
      out += '</span>';
      ouvert = null;
    }
    out += attente;
    attente = '';
  };

  for (const m of morceaux(contenu || '', html)) {
    if (m.balise) {
      // Une balise est une frontière sûre : elle pourrait être un bloc, et un
      // surlignage à cheval produirait du HTML mal formé.
      fermer();
      out += m.brut;
      continue;
    }
    for (const jeton of m.brut.split(SEPARATEUR)) {
      const texte = html ? jeton : echapper(jeton);

      if (!jeton.trim()) {
        // `baliserVers` recoupe le résultat sur les retours à la ligne : un
        // surlignage ouvert de part et d'autre serait coupé en deux balises
        // orphelines. On le referme avant.
        if (jeton.includes('\n')) {
          fermer();
          out += texte;
        } else {
          attente += texte;
        }
        continue;
      }

      const zone = parMot.get(rang);
      if (zone?.id !== ouvert) fermer();
      out += attente;
      attente = '';

      if (zone && ouvert === null) {
        const cls = [classes.marque, zone.orphelin ? classes.orphelin : '']
          .filter(Boolean)
          .join(' ');
        out += `<span class="${cls}" data-cmt="${zone.id}" role="button" tabindex="0">`;
        ouvert = zone.id;
      }
      out += `<span class="${classes.mot}" data-mot="${rang}">${texte}</span>`;
      rang++;
    }
  }
  fermer();
  return out;
}

/**
 * Le contenu d'un bloc `vers`, ligne à ligne et déjà balisé.
 * Les vers ne se justifient pas et ne se replient pas : chaque ligne est une
 * ligne, d'où ce découpage plutôt qu'un simple `<br>`.
 */
export function baliserVers(
  contenu: string,
  zones: { id: string; debut: number; fin: number; orphelin?: boolean }[],
  classes: ClassesBalisage
): string[] {
  const lignes = (contenu || '').split('\n');
  // Le rang des mots court d'une ligne à l'autre : on balise le tout d'un
  // coup, puis on recoupe. Baliser ligne par ligne remettrait le compteur à
  // zéro à chaque retour à la ligne.
  const balise = baliserContenu(contenu, false, zones, classes);
  const morceauxLignes = balise.split('\n');
  return morceauxLignes.length === lignes.length ? morceauxLignes : [balise];
}
