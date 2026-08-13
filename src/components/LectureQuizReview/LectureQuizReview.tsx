'use client';

// Vue prof (correction) du questionnaire de lecture : réponses de l'élève
// en lecture seule, QCM comptés automatiquement, tracés et fluorages affichés.

import { useState } from 'react';
import { DrawCanvas } from '@/components/DrawTools/DrawTools';
import { FluoExtrait, FluoCompare } from '@/components/LectureQuizActivity/LectureQuizActivity';
import { useDidactique } from '@/hooks/useDidactique';
import { habileteLabel } from '@/types/didactique';
import { parseLectureAnswers, LECTURE_COMPETENCE_LABELS } from '@/types/lecture';
import type { LectureQuiz, LectureQuestion, LectureCompetence } from '@/types/lecture';
import { scoreLectureQuiz } from '@/lib/lecture-scoring';
import styles from './LectureQuizReview.module.css';

const TYPE_LABELS: Record<LectureQuestion['type'], string> = {
  qcm: 'QCM',
  'texte-court': 'Réponse courte',
  'texte-long': 'Réponse longue',
  fluorage: 'Souligner du texte',
  info: 'Bloc informatif',
};

interface LectureQuizReviewProps {
  quiz: LectureQuiz;
  travailContent: string | null | undefined;
  // Points attribués aux questions ouvertes ({questionId: points}) — les QCM
  // sont comptés automatiquement, jamais stockés
  questionScores?: Record<string, number>;
  onQuestionScoreChange?: (questionId: string, points: number | null) => void;
  disabled?: boolean;
}

export default function LectureQuizReview({
  quiz,
  travailContent,
  questionScores,
  onQuestionScoreChange,
  disabled,
}: LectureQuizReviewProps) {
  const state = parseLectureAnswers(travailContent);
  const answers = state?.answers ?? {};
  const [popupImage, setPopupImage] = useState<string | null>(null);

  // Libellés des gestes de lecture : config didactique, repli sur les slugs
  // historiques puis sur l'id brut (geste supprimé de la config)
  const { config: didactique } = useDidactique();
  const gesteLabel = (id: string) => {
    const h = didactique.habiletes.find((x) => x.id === id);
    if (h) return habileteLabel(h);
    return LECTURE_COMPETENCE_LABELS[id as LectureCompetence] ?? id;
  };

  // Score complet : QCM automatiques + points saisis sur les questions ouvertes
  const score = scoreLectureQuiz(quiz, answers, questionScores);
  const scoreByQuestion = new Map(score.parQuestion.map((s) => [s.questionId, s]));
  const totalPoints = quiz.questions.reduce((s, q) => s + (q.points || 0), 0);

  return (
    <div className={styles.review}>
      {totalPoints > 0 && (
        <div className={styles.autoScore}>
          🎯 <b>{score.points}/{score.max}</b>
          {score.percent !== null && <> ({score.percent}%)</>}
          <span className={styles.totalPts}> sur {totalPoints} pts au total</span>
          {score.aNoter > 0 && (
            <span className={styles.totalPts}>
              {' '}· {score.aNoter} question{score.aNoter > 1 ? 's' : ''} à noter
            </span>
          )}
        </div>
      )}

      {quiz.questions.map((q, index) => {
        const answer = answers[q.id];
        // Bloc informatif : simple rappel du texte du prof
        if (q.type === 'info') {
          return (
            <div key={q.id} className={`${styles.card} ${styles.cardInfo}`}>
              <div className={styles.cardHead}>
                <span className={styles.typeLabel}>ℹ️ {TYPE_LABELS.info}</span>
              </div>
              {/* Contenu riche (Tiptap) du bloc informatif */}
              <div
                className={`${styles.enonce} ${styles.enonceInfo}`}
                dangerouslySetInnerHTML={{ __html: q.enonce }}
              />
              {q.audio && (
                <div className={styles.audioBlock}>
                  { }
                  <audio controls src={q.audio.url} className={styles.audioPlayer} />
                  <span className={styles.audioMeta}>
                    🔊 Écouté {answer?.audioPlays ?? 0} fois
                    {q.audio.maxEcoutes ? ` (max ${q.audio.maxEcoutes})` : ''}
                  </span>
                </div>
              )}
            </div>
          );
        }
        const number = quiz.questions.slice(0, index).filter((p) => p.type !== 'info').length + 1;
        return (
          <div key={q.id} className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.num}>{number}</span>
              <span className={styles.typeLabel}>{TYPE_LABELS[q.type]}</span>
              {q.competences.length > 0 && (
                <span className={styles.comps}>
                  {q.competences.map((c) => gesteLabel(c)).join(' · ')}
                </span>
              )}
              {q.points > 0 && q.type === 'qcm' && (
                <span className={styles.pts}>
                  {scoreByQuestion.get(q.id)?.points ?? 0}/{q.points} pt{q.points > 1 ? 's' : ''}
                </span>
              )}
              {q.points > 0 && q.type !== 'qcm' && onQuestionScoreChange && (
                <span className={styles.scoreInput}>
                  <input
                    type="number"
                    min={0}
                    max={q.points}
                    step={0.5}
                    value={questionScores?.[q.id] ?? ''}
                    placeholder="—"
                    disabled={disabled}
                    onChange={(e) => {
                      const v = e.target.value;
                      onQuestionScoreChange(q.id, v === '' ? null : Number(v));
                    }}
                  />
                  <span>/ {q.points}</span>
                </span>
              )}
              {q.points > 0 && q.type !== 'qcm' && !onQuestionScoreChange && (
                <span className={styles.pts}>
                  {scoreByQuestion.get(q.id)?.points ?? '—'}/{q.points}
                </span>
              )}
            </div>

            <p className={styles.enonce}>{q.enonce}</p>

            {/* Audio de la question + nombre d'écoutes consommées par l'élève */}
            {q.audio && (
              <div className={styles.audioBlock}>
                { }
                <audio controls src={q.audio.url} className={styles.audioPlayer} />
                <span className={styles.audioMeta}>
                  🔊 Écouté {answer?.audioPlays ?? 0} fois
                  {q.audio.maxEcoutes ? ` (max ${q.audio.maxEcoutes})` : ''}
                </span>
              </div>
            )}

            {/* Image + tracés de l'élève (lecture seule) */}
            {q.image && (
              <div className={styles.imgBlock}>
                <DrawCanvas
                  imageUrl={q.image.url}
                  shapes={answer?.shapes || []}
                  tool="select"
                  selectedShapeId={null}
                  setSelectedShapeId={() => {}}
                  readOnly
                />
                <div className={styles.imgFooter}>
                  <button type="button" className={styles.zoomBtn} onClick={() => setPopupImage(q.image!.url)}>
                    🔍 Agrandir l&apos;image
                  </button>
                  <span className={styles.shapeCount}>
                    {(answer?.shapes?.length ?? 0) > 0
                      ? `✏️ ${answer!.shapes!.length} tracé${answer!.shapes!.length > 1 ? 's' : ''} de l'élève`
                      : 'Aucun tracé'}
                  </span>
                </div>
              </div>
            )}

            {/* QCM : réponse élève vs bonne réponse */}
            {q.type === 'qcm' && (
              <div className={styles.choices}>
                {(q.choices ?? []).map((choice, ci) => {
                  const isStudent = answer?.choiceIndex === ci;
                  const isCorrect = q.correctIndex === ci;
                  return (
                    <div
                      key={ci}
                      className={`${styles.choice} ${isCorrect ? styles.choiceCorrect : ''} ${isStudent && !isCorrect ? styles.choiceWrong : ''}`}
                    >
                      <span className={styles.choiceMark}>
                        {isStudent ? (isCorrect ? '✅' : '❌') : isCorrect ? '✔' : ''}
                      </span>
                      {choice}
                      {isStudent && <span className={styles.studentTag}>réponse de l&apos;élève</span>}
                    </div>
                  );
                })}
                {answer?.choiceIndex === undefined || answer?.choiceIndex === null ? (
                  <p className={styles.empty}>Pas de réponse.</p>
                ) : null}
              </div>
            )}

            {q.type === 'texte-court' && (
              answer?.text?.trim() ? (
                <p className={styles.textAnswer}>{answer.text}</p>
              ) : (
                <p className={styles.empty}>Pas de réponse.</p>
              )
            )}

            {q.type === 'texte-long' && (
              answer?.text?.trim() ? (
                <div
                  className={styles.richAnswer}
                  dangerouslySetInnerHTML={{ __html: answer.text }}
                />
              ) : (
                <p className={styles.empty}>Pas de réponse.</p>
              )
            )}

            {q.type === 'fluorage' && (q.fluoSource ?? 'extrait') === 'extrait' && (
              (q.fluoAttendu?.length ?? 0) > 0 ? (
                // Comparaison automatique avec le soulignage attendu du prof
                <FluoCompare
                  texte={q.fluoTexte ?? ''}
                  attendu={q.fluoAttendu ?? []}
                  eleve={answer?.fluoWords ?? []}
                />
              ) : (
                <FluoExtrait
                  texte={q.fluoTexte ?? ''}
                  fluoWords={answer?.fluoWords ?? []}
                  disabled
                />
              )
            )}

            {q.type === 'fluorage' && q.fluoSource === 'ressource' && (
              <p className={styles.empty}>
                🖍 L&apos;élève a souligné dans la ressource de l&apos;activité — son soulignage
                est visible dans l&apos;onglet Ressources (annotations de l&apos;élève).
              </p>
            )}

            {/* Commentaire du soulignage par l'élève */}
            {q.type === 'fluorage' && answer?.text?.trim() && (
              <p className={styles.textAnswer}>💬 {answer.text}</p>
            )}

            {/* Réponse idéale du prof — pour comparaison */}
            {q.reponseIdeale && (
              <div className={styles.ideale}>
                <span className={styles.idealeLabel}>🎓 Votre réponse idéale</span>
                <p className={styles.idealeText}>{q.reponseIdeale}</p>
              </div>
            )}
          </div>
        );
      })}

      {popupImage && (
        <div className={styles.popup} onClick={() => setPopupImage(null)}>
          <div className={styles.popupInner} onClick={(e) => e.stopPropagation()}>
            <button type="button" className={styles.popupClose} onClick={() => setPopupImage(null)}>✕</button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={popupImage} alt="" />
          </div>
        </div>
      )}
    </div>
  );
}
