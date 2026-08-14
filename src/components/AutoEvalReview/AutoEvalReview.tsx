'use client';

// Écran de correction d'une auto-évaluation — colonne de gauche du prof.
//
// LE PRINCIPE (posé par JP le 2026-08-15) : le prof ne lit PAS d'abord les
// réponses de l'élève. Il répond lui-même aux mêmes questions, en donnant son
// propre regard sur cet élève. La réponse de l'élève ne se découvre qu'ensuite,
// juste à côté de la sienne — sinon le prof serait influencé et la comparaison
// ne vaudrait plus rien.
//
// Le dévoilement se fait QUESTION PAR QUESTION : dès que le prof s'est
// prononcé sur une question, l'élève se découvre sur celle-là.
//
// Seules les questions ORDONNÉES (sentiment de compétence, échelle 1-5) se
// confrontent ainsi. Une émotion, un choix multiple, un texte : le prof les lit
// d'emblée, comme un témoignage — il n'y a rien à y confronter.

import { useMemo } from 'react';
import {
  echelleDe,
  estQuestion,
  LIKERT_MAX_DEFAUT,
  LIKERT_MIN_DEFAUT,
  LIKERT_NIVEAUX,
  echelonLabel,
  parseAutoEvalAnswers,
} from '@/types/autoevaluation';
import type { AutoEvalAnswer, AutoEvalQuestion, AutoEvalQuestionnaire } from '@/types/autoevaluation';
import { LUCIDITE_LABELS, estComparable, position } from '@/lib/autoeval-scoring';
import type { Lucidite } from '@/lib/autoeval-scoring';
import styles from './AutoEvalReview.module.css';

interface Props {
  quiz: AutoEvalQuestionnaire;
  // Réponses de l'élève (JSON de travail.content)
  travailContent: string | undefined | null;
  // Regard du prof, déjà enregistré
  profAnswers: Record<string, AutoEvalAnswer> | undefined;
  onProfAnswerChange: (questionId: string, answer: AutoEvalAnswer) => void;
}

export default function AutoEvalReview({
  quiz,
  travailContent,
  profAnswers,
  onProfAnswerChange,
}: Props) {
  const eleve = useMemo(
    () => parseAutoEvalAnswers(travailContent)?.answers ?? {},
    [travailContent]
  );
  const prof = profAnswers ?? {};

  const questions = quiz.questions ?? [];
  const comparables = questions.filter(estComparable);
  const faites = comparables.filter((q) => position(q, prof[q.id]) !== null).length;

  // ── Rendu d'une échelle : la même pour le prof et pour l'élève ──

  const rendreEchelle = (
    q: AutoEvalQuestion,
    valeur: AutoEvalAnswer | undefined,
    modifiable: boolean
  ) => {
    if (q.type === 'competence' || q.type === 'humeur') {
      return (
        <div className={styles.echelons}>
          {echelleDe(q.type).map((e) => {
            const choisi = valeur?.echelon === e.id;
            return (
              <button
                key={e.id}
                type="button"
                className={`${styles.echelon} ${choisi ? styles.echelonOn : ''}`}
                onClick={
                  modifiable
                    ? () => onProfAnswerChange(q.id, { echelon: choisi ? null : e.id })
                    : undefined
                }
                disabled={!modifiable}
                title={e.label}
              >
                <span className={styles.echelonEmoji}>{e.emoji}</span>
                <span className={styles.echelonTexte}>{e.label}</span>
              </button>
            );
          })}
        </div>
      );
    }

    if (q.type === 'likert') {
      const v = valeur?.likert ?? 0;
      return (
        <div className={styles.likert}>
          <div className={styles.likertBornes}>
            <span>{q.likertMin || LIKERT_MIN_DEFAUT}</span>
            <span>{q.likertMax || LIKERT_MAX_DEFAUT}</span>
          </div>
          <div className={styles.likertPoints}>
            {Array.from({ length: LIKERT_NIVEAUX }, (_, i) => {
              const n = i + 1;
              const choisi = v === n;
              return (
                <button
                  key={n}
                  type="button"
                  className={`${styles.likertPoint} ${choisi ? styles.likertPointOn : ''}`}
                  onClick={
                    modifiable ? () => onProfAnswerChange(q.id, { likert: choisi ? null : n }) : undefined
                  }
                  disabled={!modifiable}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    return null;
  };

  // ── Réponse non comparable de l'élève : à lire, pas à confronter ──

  const rendreTemoignage = (q: AutoEvalQuestion) => {
    const a = eleve[q.id];
    if (q.type === 'humeur') {
      return a?.echelon ? (
        <p className={styles.temoignage}>{echelonLabel('humeur', a.echelon)}</p>
      ) : (
        <p className={styles.sansReponse}>Pas de réponse.</p>
      );
    }
    if (q.type === 'qcm') {
      const i = a?.choiceIndex;
      return typeof i === 'number' && q.choices?.[i] ? (
        <p className={styles.temoignage}>
          <span className={styles.puce}>{String.fromCharCode(65 + i)}</span> {q.choices[i]}
        </p>
      ) : (
        <p className={styles.sansReponse}>Pas de réponse.</p>
      );
    }
    // texte court / long
    const texte = a?.text?.replace(/<[^>]*>/g, ' ').trim();
    return texte ? (
      <blockquote className={styles.citation}>{texte}</blockquote>
    ) : (
      <p className={styles.sansReponse}>Pas de réponse.</p>
    );
  };

  return (
    <div className={styles.review}>
      <div className={styles.entete}>
        <p className={styles.consigne}>
          Répondez d’abord vous-même : votre regard sur cet élève. Sa réponse se découvre
          ensuite, à côté de la vôtre.
        </p>
        <div className={styles.avancee}>
          <div className={styles.barre}>
            <div
              className={styles.barreFill}
              style={{ width: `${comparables.length ? (faites / comparables.length) * 100 : 0}%` }}
            />
          </div>
          <span className={styles.avanceeTexte}>
            {faites} / {comparables.length} question{comparables.length > 1 ? 's' : ''} évaluée
            {faites > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className={styles.liste}>
        {questions.map((q, index) => {
          if (!estQuestion(q)) {
            return (
              <div key={q.id} className={styles.info}>
                {q.enonce}
              </div>
            );
          }

          const numero = questions.slice(0, index).filter(estQuestion).length + 1;
          const comparable = estComparable(q);
          const pProf = position(q, prof[q.id]);
          const pEleve = position(q, eleve[q.id]);
          const devoile = pProf !== null;
          const ecart = devoile && pEleve !== null ? pEleve - pProf : null;
          const lucidite: Lucidite | null =
            ecart === null ? null : ecart === 0 ? 'juste' : ecart < 0 ? 'sousEstime' : 'surestime';

          return (
            <div key={q.id} className={styles.bloc}>
              <div className={styles.blocHead}>
                <span className={styles.numero}>{numero}</span>
                <p className={styles.enonce}>{q.enonce}</p>
                {comparable && !devoile && (
                  <span className={styles.verrou} title="Répondez pour découvrir l’élève">
                    🔒
                  </span>
                )}
              </div>

              {q.document && <div className={styles.document}>{q.document}</div>}

              {comparable ? (
                <div className={styles.duel}>
                  <div className={styles.colonne}>
                    <span className={styles.colonneTitre}>Mon regard</span>
                    {rendreEchelle(q, prof[q.id], true)}
                  </div>

                  <div className={`${styles.colonne} ${devoile ? '' : styles.colonneVoilee}`}>
                    <span className={styles.colonneTitre}>L’élève</span>
                    {devoile ? (
                      pEleve !== null ? (
                        <>
                          {rendreEchelle(q, eleve[q.id], false)}
                          {lucidite && (
                            <span className={`${styles.verdict} ${styles[lucidite]}`}>
                              {lucidite === 'juste' && '✓ '}
                              {lucidite === 'sousEstime' && '↓ '}
                              {lucidite === 'surestime' && '↑ '}
                              {LUCIDITE_LABELS[lucidite]}
                              {ecart !== null && ecart !== 0 && (
                                <em className={styles.ecartVal}>
                                  {' '}
                                  ({Math.abs(ecart)} cran{Math.abs(ecart) > 1 ? 's' : ''})
                                </em>
                              )}
                            </span>
                          )}
                        </>
                      ) : (
                        <p className={styles.sansReponse}>L’élève n’a pas répondu.</p>
                      )
                    ) : (
                      <div className={styles.voile}>
                        <span className={styles.voileTexte}>
                          Prononcez-vous pour découvrir sa réponse
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                // Non comparable : le témoignage de l'élève, lisible d'emblée
                <div className={styles.libre}>
                  <span className={styles.colonneTitre}>Ce que dit l’élève</span>
                  {rendreTemoignage(q)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
