'use client';

// Évaluation d'un questionnaire de lecture : score global + détail par
// habileté. C'est l'équivalent, pour la lecture, de ce que la grille fait pour
// l'écriture — ces activités n'ont pas de grille, ce sont les habiletés
// portées par les questions qui disent ce qui a été travaillé.
//
// Rappel de la règle de calcul (lib/lecture-scoring.ts) : une question portant
// deux habiletés compte ENTIÈREMENT dans chacune. La somme des lignes ne
// retombe donc jamais sur le total, et c'est voulu.

import { useDidactique } from '@/hooks/useDidactique';
import { habileteLabel, habileteObjets } from '@/types/didactique';
import { scoreLectureQuiz } from '@/lib/lecture-scoring';
import { parseLectureAnswers, LECTURE_COMPETENCE_LABELS } from '@/types/lecture';
import type { LectureCompetence, LectureQuiz } from '@/types/lecture';
import styles from './LectureEvaluation.module.css';

interface Props {
  quiz: LectureQuiz | null | undefined;
  travailContent: string | null | undefined;
  questionScores?: Record<string, number>;
  // false = la correction n'est pas encore rendue : on masque les chiffres
  showScores?: boolean;
}

function couleur(percent: number): string {
  if (percent < 35) return 'var(--c-danger, #c0392b)';
  if (percent < 60) return '#d4944c';
  if (percent < 80) return '#5a8f6f';
  return 'var(--c-primary)';
}

export default function LectureEvaluation({
  quiz,
  travailContent,
  questionScores,
  showScores = true,
}: Props) {
  const { config } = useDidactique();

  const answers = parseLectureAnswers(travailContent)?.answers ?? {};
  const score = scoreLectureQuiz(quiz, answers, questionScores);

  const label = (id: string) => {
    const h = config.habiletes.find((x) => x.id === id);
    if (h) return habileteLabel(h);
    return LECTURE_COMPETENCE_LABELS[id as LectureCompetence] ?? id;
  };
  const objet = (id: string) => {
    const h = config.habiletes.find((x) => x.id === id);
    return h ? habileteObjets(h).join(', ') : '';
  };

  if (!quiz?.questions?.length) {
    return <p className={styles.empty}>Cette activité ne porte pas de questionnaire.</p>;
  }

  if (!showScores) {
    return (
      <p className={styles.empty}>
        Ton professeur n&apos;a pas encore rendu la correction. Le score et le détail par
        habileté apparaîtront ici.
      </p>
    );
  }

  const rows = [...score.parHabilete].sort((a, b) => {
    const pa = a.max ? a.points / a.max : 0;
    const pb = b.max ? b.points / b.max : 0;
    return pa - pb;
  });

  return (
    <div className={styles.wrap}>
      <div className={styles.total}>
        <span className={styles.totalValue}>
          {score.points}<span className={styles.totalMax}>/{score.max}</span>
        </span>
        {score.percent !== null && (
          <span className={styles.totalPercent} style={{ color: couleur(score.percent) }}>
            {score.percent}%
          </span>
        )}
      </div>

      {score.aNoter > 0 && (
        <p className={styles.pending}>
          {score.aNoter} question{score.aNoter > 1 ? 's' : ''} pas encore notée
          {score.aNoter > 1 ? 's' : ''} — hors du total.
        </p>
      )}

      <h4 className={styles.title}>Par habileté</h4>

      {rows.length === 0 ? (
        <p className={styles.empty}>
          Aucune habileté n&apos;est rattachée aux questions de ce questionnaire.
        </p>
      ) : (
        <ul className={styles.list}>
          {rows.map((h) => {
            const percent = h.max ? Math.round((h.points / h.max) * 100) : 0;
            return (
              <li key={h.habileteId} className={styles.row}>
                <div className={styles.rowHead}>
                  <span className={styles.rowLabel}>
                    {label(h.habileteId)}
                    {objet(h.habileteId) && (
                      <em className={styles.rowObjet}> — {objet(h.habileteId)}</em>
                    )}
                  </span>
                  <span className={styles.rowScore}>
                    {h.points}/{h.max}
                  </span>
                </div>
                <div className={styles.bar}>
                  <i style={{ width: `${percent}%`, background: couleur(percent) }} />
                </div>
                <span className={styles.rowMeta}>
                  {percent}% · {h.questions} question{h.questions > 1 ? 's' : ''}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <p className={styles.note}>
        Une question qui travaille deux habiletés compte entièrement dans chacune : le
        total des lignes ne correspond donc pas au score global.
      </p>
    </div>
  );
}
