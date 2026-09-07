'use client';

// Le QCM en mode Compétition — grandes cases colorées, révélation en vert et
// rouge. Écran approuvé par JP le 2026-09-07.
//
// ⚠ Pourquoi ce composant n'est PAS `QuestionCard` : les six autres types
// retenus passent bien par la carte partagée du questionnaire de lecture, mais
// le QCM se joue ici en cases pleines, lisibles depuis le fond de la classe —
// une liste de boutons ronds ne se lit pas à quatre mètres.

import type { LectureQuestion } from '@/types/lecture';
import styles from './CompetitionQcm.module.css';

/** Les quatre formes, dans l'ordre des quatre teintes. */
const FORMES = ['▲', '◆', '●', '■'];

interface CompetitionQcmProps {
  question: LectureQuestion;
  /** Ce que CE navigateur a coché — le serveur ne le renvoie pas */
  choisis: number[];
  onChoisir: (index: number) => void;
  /** La question court encore : on peut répondre */
  ouverte: boolean;
  /** La question est close : on montre la bonne réponse */
  revele: boolean;
  /**
   * Combien d'élèves ont choisi chaque proposition. Affiché en PASTILLE dans
   * l'encadré, une fois la question close — la question garde sa forme, elle
   * n'est pas remplacée par un graphique.
   */
  parChoix?: number[];
}

export default function CompetitionQcm({
  question,
  choisis,
  onChoisir,
  ouverte,
  revele,
  parChoix,
}: CompetitionQcmProps) {
  const choix = question.choices ?? [];

  // Les bonnes réponses n'arrivent qu'à la révélation (le serveur ne les envoie
  // qu'en phase `resultat`). Avant, cette liste est vide : aucune case ne peut
  // se colorer, même en trafiquant la page.
  const bonnes = question.multiple
    ? question.correctIndexes ?? []
    : typeof question.correctIndex === 'number'
    ? [question.correctIndex]
    : [];
  const montreCorrige = revele && bonnes.length > 0;

  const Case = (i: number) => {
    const juste = bonnes.includes(i);
    const sien = choisis.includes(i);
    const classes = [styles.caseChoix, styles[`teinte${i % 4}`]];
    if (montreCorrige) {
      classes.push(juste ? styles.juste : sien ? styles.faux : styles.eteinte);
    } else if (sien) {
      classes.push(styles.coche);
    }
    const mot = montreCorrige ? question.feedbackParChoix?.[i] : undefined;
    return (
      <li key={i}>
        <button
          type="button"
          className={classes.join(' ')}
          disabled={!ouverte}
          onClick={() => onChoisir(i)}
        >
          <span className={styles.forme} aria-hidden="true">
            {FORMES[i % 4]}
          </span>
          <span className={styles.libelle}>{choix[i]}</span>
          {parChoix && <span className={styles.pastille}>{parChoix[i] ?? 0}</span>}
        </button>
        {mot && <p className={styles.feedback}>{mot}</p>}
      </li>
    );
  };

  const rangs = choix.map((_, i) => i);

  // Pendant la question : les propositions en cases égales. À la révélation :
  // la bonne SEULE sur la première ligne, les autres alignées en dessous —
  // c'est la bonne réponse qu'on regarde, pas la place qu'elle occupait.
  if (!montreCorrige) {
    return <ul className={styles.grille}>{rangs.map(Case)}</ul>;
  }
  return (
    <>
      <ul className={styles.ligneJuste}>{rangs.filter((i) => bonnes.includes(i)).map(Case)}</ul>
      <ul className={styles.ligneAutres}>{rangs.filter((i) => !bonnes.includes(i)).map(Case)}</ul>
    </>
  );
}
