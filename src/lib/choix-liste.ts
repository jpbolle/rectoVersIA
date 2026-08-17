// ═══ AJOUTER UNE OPTION À LA TOUCHE ENTRÉE ═══
//
// Demande de JP (2026-08-17) : dans un QCM, la touche Entrée ajoute l'option
// suivante et y place le curseur — on écrit ses cinq propositions d'affilée,
// sans quitter le clavier pour viser « + Ajouter un choix ».
//
// Ce fichier est partagé par les TROIS constructeurs de questionnaires
// (lecture, auto-évaluation, recherche NavigKid). Ils tenaient déjà chacun
// leur suppression d'option, et elles avaient divergé sur le décalage du
// corrigé — l'insertion ne devait pas repartir pour un tour.
//
// ⚠️ LE CORRIGÉ SE DÉCALE. Insérer une option au milieu pousse d'un rang
// toutes celles qui suivent : sans le recalcul ci-dessous, la bonne réponse
// désignerait sa voisine, et RIEN ne le signalerait — ni à l'écran, ni à la
// correction. C'est la symétrie exacte du recalcul déjà fait à la suppression.

/** Le nouvel état d'une liste de choix après insertion à la touche Entrée. */
export interface InsertionChoix {
  choix: string[];
  /** QCM à réponse unique */
  correctIndex?: number;
  /** QCM à réponses multiples, ou cases cochées d'un questionnaire NavigKid */
  correctIndexes?: number[];
  /** Matrice : une colonne attendue par ligne (-1 = ligne hors barème) */
  matriceCorrect?: number[];
}

/**
 * Insère un choix vide JUSTE APRÈS `index` et décale les corrigés.
 *
 * Juste après, et non à la fin : le prof qui ajoute une proposition au milieu
 * de sa liste la veut à cet endroit. Dans le cas courant — on est sur la
 * dernière ligne et on enchaîne — les deux reviennent au même.
 */
export function insererChoix(
  choix: string[],
  index: number,
  corriges: {
    correctIndex?: number;
    correctIndexes?: number[];
    matriceCorrect?: number[];
  } = {}
): InsertionChoix {
  const suivant = index + 1;
  const liste = [...choix];
  liste.splice(suivant, 0, '');

  // Un rang au-delà du point d'insertion se décale d'un cran. Le rang inséré
  // lui-même (`suivant`) n'appartient encore à personne : il est vide.
  const decale = (i: number) => (i >= suivant ? i + 1 : i);

  const out: InsertionChoix = { choix: liste };
  if (typeof corriges.correctIndex === 'number') out.correctIndex = decale(corriges.correctIndex);
  if (corriges.correctIndexes) out.correctIndexes = corriges.correctIndexes.map(decale);
  // Une ligne hors barème vaut -1 : elle ne désigne aucune colonne, donc rien
  // à décaler — la décaler la ferait passer pour une exigence.
  if (corriges.matriceCorrect) {
    out.matriceCorrect = corriges.matriceCorrect.map((c) => (c < 0 ? c : decale(c)));
  }
  return out;
}

/**
 * Donne le focus au champ marqué `data-champ="cle"`, une fois React repassé.
 *
 * Par le DOM et non par une référence : les trois constructeurs rendent leurs
 * options dans des structures différentes, et un registre de références par
 * question dans chacun coûterait plus cher que cette ligne. Le champ visé
 * vient d'être créé — il n'existe pas encore au moment de l'appel, d'où
 * l'attente d'une frame.
 */
export function focaliserChamp(cle: string): void {
  if (typeof window === 'undefined') return;
  requestAnimationFrame(() => {
    const champ = document.querySelector<HTMLInputElement>(
      `[data-champ="${CSS.escape(cle)}"]`
    );
    champ?.focus();
  });
}
