'use client';

// Vue prof (correction) du questionnaire de lecture : réponses de l'élève
// en lecture seule, QCM comptés automatiquement, tracés et fluorages affichés.

import { useState, Fragment } from 'react';
import { DrawCanvas } from '@/components/DrawTools/DrawTools';
import { FluoExtrait, FluoCompare } from '@/components/LectureQuizActivity/LectureQuizActivity';
import { useDidactique } from '@/hooks/useDidactique';
import { habileteLabel } from '@/types/didactique';
import {
  parseLectureAnswers,
  lectureARepondu,
  LECTURE_COMPETENCE_LABELS,
  LECTURE_TYPE_LABELS,
} from '@/types/lecture';
import type { LectureQuiz, LectureQuestion, LectureCompetence } from '@/types/lecture';
import ChampManipule, { estTypeManipule } from '@/components/QuestionInteractions';
import { scoreLectureQuiz, seCorrigeSeule } from '@/lib/lecture-scoring';
import styles from './LectureQuizReview.module.css';

// Libellés : liste unique dans src/types/lecture.ts (voir LECTURE_TYPE_LABELS)
const TYPE_LABELS = LECTURE_TYPE_LABELS;

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

  // Score complet : questions auto-corrigées + points saisis par le prof
  const score = scoreLectureQuiz(quiz, answers, questionScores);
  const scoreByQuestion = new Map(score.parQuestion.map((s) => [s.questionId, s]));
  // Le MÊME calcul sans les reprises du prof : c'est ce que la machine
  // proposait. Il sert à préremplir le champ quand le prof reprend la main, et
  // à lui rappeler ce qu'il écarte.
  const scoreAuto = new Map(
    scoreLectureQuiz(quiz, answers).parQuestion.map((s) => [s.questionId, s.points])
  );
  const totalPoints = quiz.questions.reduce((s, q) => s + (q.points || 0), 0);

  // Note effective affichée pour une question (reprise du prof ou automatique)
  const noteCourante = (q: LectureQuestion) => scoreByQuestion.get(q.id)?.points ?? null;

  // ✔ / ✘ : le maximum ou zéro, d'un geste. Le champ reste ouvert à côté —
  // c'est un raccourci, pas un verrou.
  const poser = (q: LectureQuestion, points: number) =>
    onQuestionScoreChange?.(q.id, points);

  /**
   * Soulignage sans catégories : la machine ne note pas, elle SUGGÈRE.
   * Proportion de mots attendus retrouvés (sans pénalité pour les mots en
   * trop — décision de JP : souligner large ne coûte rien d'office, c'est au
   * professeur d'en tenir compte, les mots excédentaires lui étant montrés en
   * orange par FluoCompare). Rien ne se compte tant qu'il n'a pas appliqué.
   */
  const suggestionFluo = (q: LectureQuestion): number | null => {
    if (q.type !== 'fluorage' || (q.fluoSource ?? 'extrait') !== 'extrait') return null;
    if (q.fluoCategories?.length) return null;
    const attendu = q.fluoAttendu ?? [];
    if (attendu.length === 0 || !(q.points > 0)) return null;
    const eleve = new Set(answers[q.id]?.fluoWords ?? []);
    const trouves = attendu.filter((i) => eleve.has(i)).length;
    return Math.round((trouves / attendu.length) * q.points * 10) / 10;
  };

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
          <Fragment key={q.id}>
          {/* Astérisque de séparation — comme dans la vue élève */}
          {index > 0 && <div className={styles.separateur} aria-hidden="true">✳</div>}
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.num}>{number}</span>
              <span className={styles.typeLabel}>{TYPE_LABELS[q.type]}</span>
              {q.competences.length > 0 && (
                <span className={styles.comps}>
                  {q.competences.map((c) => gesteLabel(c)).join(' · ')}
                </span>
              )}
              {/* Note automatique — toutes les questions que la machine sait
                  corriger, pas seulement les QCM. Le barème est partiel :
                  d'où un score qui peut tomber sur un demi-point. */}
              {/* ── GOUTTIÈRE DE NOTATION ──
                  Trois états, un seul principe : la machine propose, le
                  professeur dispose.
                  1. question auto NON reprise → la note automatique en
                     pastille, plus un ✎ pour la reprendre (aucun corrigé
                     n'est à l'abri d'être incomplet) ;
                  2. question auto REPRISE, ou question à noter à la main →
                     ✔ / ✘ / champ, et ↺ pour rendre la main à l'automatique ;
                  3. lecture seule (correction déjà rendue) → la note nue. */}
              {q.points > 0 && onQuestionScoreChange && (() => {
                const auto = seCorrigeSeule(q);
                const repris = typeof questionScores?.[q.id] === 'number';
                const note = noteCourante(q);

                const boutons = (
                  <>
                    <button
                      type="button"
                      className={`${styles.gutterBtn} ${styles.btnJuste} ${note === q.points ? styles.gutterBtnOn : ''}`}
                      title={`Juste — ${q.points} pt${q.points > 1 ? 's' : ''}`}
                      aria-label="Juste"
                      disabled={disabled}
                      onClick={() => poser(q, q.points)}
                    >
                      ✔
                    </button>
                    <button
                      type="button"
                      className={`${styles.gutterBtn} ${styles.btnFaux} ${note === 0 ? styles.gutterBtnOn : ''}`}
                      title="Faux — 0"
                      aria-label="Faux"
                      disabled={disabled}
                      onClick={() => poser(q, 0)}
                    >
                      ✘
                    </button>
                  </>
                );

                // 1. Note automatique intacte : la pastille, et les ✔ / ✘
                //    juste à côté. Ils sont là D'EMBLÉE — aucun corrigé n'est
                //    à l'abri d'être incomplet, et faire précéder la reprise
                //    d'un bouton à découvrir ne faisait qu'ajouter un clic.
                if (auto && !repris) {
                  return (
                    <span className={styles.autoNote}>
                      <span className={styles.pts}>
                        {note ?? '…'}/{q.points} pt{q.points > 1 ? 's' : ''}
                      </span>
                      {boutons}
                    </span>
                  );
                }

                // 2. Note à la main (question ouverte, ou automatique reprise)
                return (
                  <span className={styles.scoreInput}>
                    {boutons}
                    <input
                      type="number"
                      min={0}
                      max={q.points}
                      step={0.5}
                      value={questionScores?.[q.id] ?? ''}
                      placeholder={auto ? String(scoreAuto.get(q.id) ?? 0) : '—'}
                      title={
                        auto
                          ? 'Note reprise à la main. Videz le champ pour rendre la main à la correction automatique.'
                          : 'Note de cette question — les ✔ / ✘ ne sont qu’un raccourci, vous restez libre du chiffre.'
                      }
                      disabled={disabled}
                      onChange={(e) => {
                        const v = e.target.value;
                        onQuestionScoreChange(q.id, v === '' ? null : Number(v));
                      }}
                    />
                    <span>/ {q.points}</span>
                    {auto && (
                      <button
                        type="button"
                        className={styles.gutterBtn}
                        title={`Rendre la main à la correction automatique (elle donnait ${scoreAuto.get(q.id) ?? 0}/${q.points})`}
                        aria-label="Rendre la main à la correction automatique"
                        disabled={disabled}
                        onClick={() => onQuestionScoreChange(q.id, null)}
                      >
                        ↺
                      </button>
                    )}
                  </span>
                );
              })()}
              {/* 3. Lecture seule */}
              {q.points > 0 && !onQuestionScoreChange && (
                <span className={styles.pts}>
                  {noteCourante(q) ?? '—'}/{q.points} pt{q.points > 1 ? 's' : ''}
                </span>
              )}
            </div>

            <p className={styles.enonce}>{q.enonce}</p>

            {/* Texte joint à la question par le prof */}
            {q.document && <div className={styles.questionDoc}>{q.document}</div>}

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
              <div className={`${styles.choices} ${styles.reponseZone}`}>
                {(q.choices ?? []).map((choice, ci) => {
                  const isStudent = q.multiple
                    ? (answer?.choiceIndexes ?? []).includes(ci)
                    : answer?.choiceIndex === ci;
                  const isCorrect = q.multiple
                    ? (q.correctIndexes ?? []).includes(ci)
                    : q.correctIndex === ci;
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
                {!lectureARepondu(q, answer) ? (
                  <p className={styles.empty}>Pas de réponse.</p>
                ) : null}
              </div>
            )}

            {/* Les types manipulés : le MÊME rendu que côté élève, en lecture
                seule et corrigé affiché. Un second rendu « vue prof » aurait
                divergé au premier ajustement — et le prof doit voir
                exactement ce que son élève a vu. */}
            {estTypeManipule(q.type) && (
              <div className={styles.reponseZone}>
                <ChampManipule
                  question={q}
                  answer={answer ?? {}}
                  onAnswerChange={() => {}}
                  disabled
                  showCorrection
                />
                {!lectureARepondu(q, answer) && <p className={styles.empty}>Pas de réponse.</p>}
              </div>
            )}

            {q.type === 'texte-court' && (
              answer?.text?.trim() ? (
                <p className={`${styles.textAnswer} ${styles.reponseZone}`}>{answer.text}</p>
              ) : (
                <p className={styles.empty}>Pas de réponse.</p>
              )
            )}

            {q.type === 'texte-long' && (
              answer?.text?.trim() ? (
                <div
                  className={`${styles.richAnswer} ${styles.reponseZone}`}
                  dangerouslySetInnerHTML={{ __html: answer.text }}
                />
              ) : (
                <p className={styles.empty}>Pas de réponse.</p>
              )
            )}

            {/* Fluorage à catégories : rendu partagé, corrigé affiché */}
            {q.type === 'fluorage' &&
              (q.fluoSource ?? 'extrait') === 'extrait' &&
              !!q.fluoCategories?.length && (
                <div className={styles.reponseZone}>
                  <ChampManipule
                    question={q}
                    answer={answer ?? {}}
                    onAnswerChange={() => {}}
                    disabled
                    showCorrection
                  />
                </div>
              )}

            {q.type === 'fluorage' &&
              (q.fluoSource ?? 'extrait') === 'extrait' &&
              !q.fluoCategories?.length && (
              (q.fluoAttendu?.length ?? 0) > 0 ? (
                <>
                  {/* Comparaison automatique avec le soulignage attendu du prof */}
                  <FluoCompare
                    texte={q.fluoTexte ?? ''}
                    attendu={q.fluoAttendu ?? []}
                    eleve={answer?.fluoWords ?? []}
                  />
                  {/* Un soulignage ne se note pas tout seul : la machine
                      SUGGÈRE, le professeur confirme. Tant qu'il n'a pas
                      appliqué (ou écrit sa note), la question reste « à
                      noter » et ne pèse pas dans le total. */}
                  {onQuestionScoreChange && suggestionFluo(q) !== null && (
                    <div className={styles.suggestion}>
                      <span>
                        🖍 Correction automatique <b>indicative</b> — suggestion{' '}
                        <b>{suggestionFluo(q)}/{q.points}</b>
                      </span>
                      <button
                        type="button"
                        className={styles.suggestionBtn}
                        disabled={disabled}
                        onClick={() => onQuestionScoreChange(q.id, suggestionFluo(q) as number)}
                      >
                        Appliquer
                      </button>
                      {typeof questionScores?.[q.id] === 'number' && (
                        <span className={styles.suggestionEtat}>
                          Noté {questionScores[q.id]}/{q.points}
                        </span>
                      )}
                    </div>
                  )}
                </>
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
          </Fragment>
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
