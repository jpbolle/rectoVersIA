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
  aRepondu,
  echelleDe,
  estLikertMatrice,
  estQuestion,
  LIKERT_COLONNES,
  LIKERT_MAX_DEFAUT,
  LIKERT_MIN_DEFAUT,
  LIKERT_NIVEAUX,
  echelonLabel,
  parseAutoEvalAnswers,
} from '@/types/autoevaluation';
import type { AutoEvalAnswer, AutoEvalQuestion, AutoEvalQuestionnaire } from '@/types/autoevaluation';
import { MatriceField } from '@/components/QuestionInteractions';

// `MatriceField` sert aussi au questionnaire de lecture, où une ligne peut
// porter plusieurs colonnes. L'auto-évaluation n'en a jamais qu'une.
function uneParLigne(v: Record<number, number | number[]>): Record<number, number> {
  const out: Record<number, number> = {};
  Object.entries(v).forEach(([ligne, valeur]) => {
    const n = Array.isArray(valeur) ? valeur[0] : valeur;
    if (typeof n === 'number') out[Number(ligne)] = n;
  });
  return out;
}
import { LUCIDITE_LABELS, comparer, estComparable, position } from '@/lib/autoeval-scoring';
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
  // « Le prof s'est-il prononcé ? » — via aRepondu, seul à connaître les
  // échelles à items (toutes leurs lignes, ou rien).
  const faites = comparables.filter((q) => aRepondu(q, prof[q.id])).length;

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

    // Une échelle à items se donne en tableau — le même que l'élève a rempli,
    // sans quoi le prof se prononcerait sur une forme qu'il n'a pas vue.
    if (q.type === 'likert' && estLikertMatrice(q)) {
      return (
        <div className={styles.likert}>
          <div className={styles.likertBornes}>
            <span>1 — {q.likertMin || LIKERT_MIN_DEFAUT}</span>
            <span>
              {LIKERT_NIVEAUX} — {q.likertMax || LIKERT_MAX_DEFAUT}
            </span>
          </div>
          <MatriceField
            items={q.matriceItems ?? []}
            colonnes={LIKERT_COLONNES}
            valeurs={valeur?.matrice ?? {}}
            onChange={(matrice) => onProfAnswerChange(q.id, { matrice: uneParLigne(matrice) })}
            disabled={!modifiable}
            nomGroupe={`${modifiable ? 'prof' : 'eleve'}-${q.id}`}
          />
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
      // Réponses multiples : on les liste toutes, dans l'ordre des options —
      // pas dans l'ordre où l'élève a cliqué, qui ne veut rien dire.
      const indices = q.multiple
        ? (a?.choiceIndexes ?? [])
        : typeof a?.choiceIndex === 'number'
          ? [a.choiceIndex]
          : [];
      const retenues = indices.filter((i) => q.choices?.[i]);
      return retenues.length > 0 ? (
        <>
          {retenues.map((i) => (
            <p key={i} className={styles.temoignage}>
              <span className={styles.puce}>{String.fromCharCode(65 + i)}</span> {q.choices![i]}
            </p>
          ))}
        </>
      ) : (
        <p className={styles.sansReponse}>Pas de réponse.</p>
      );
    }
    if (q.type === 'matrice') {
      const lignes = q.matriceItems ?? [];
      const repondues = lignes.filter((_, i) => typeof a?.matrice?.[i] === 'number');
      return repondues.length > 0 ? (
        <MatriceField
          nomGroupe={`review-${q.id}`}
          items={lignes}
          colonnes={q.choices ?? []}
          valeurs={a?.matrice ?? {}}
          onChange={() => {}}
          disabled
        />
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
          // Une échelle à items n'a pas UNE position mais une par ligne : le
          // regard est donné quand toutes le sont, et le verdict devient un
          // décompte (voir bilanLigne plus bas).
          const matrice = estLikertMatrice(q);
          const pProf = position(q, prof[q.id]);
          const pEleve = position(q, eleve[q.id]);
          const devoile = matrice ? aRepondu(q, prof[q.id]) : pProf !== null;
          const eleveARepondu = matrice ? aRepondu(q, eleve[q.id]) : pEleve !== null;
          const ecart =
            !matrice && devoile && pEleve !== null && pProf !== null ? pEleve - pProf : null;
          const lucidite: Lucidite | null =
            ecart === null ? null : ecart === 0 ? 'juste' : ecart < 0 ? 'sousEstime' : 'surestime';
          // Le décompte ligne à ligne d'une échelle à items — calculé par le
          // même comparateur que le bilan, jamais par une seconde règle.
          const bilanLigne =
            matrice && devoile && eleveARepondu
              ? comparer({ questions: [q] }, eleve, prof)
              : null;

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
                      eleveARepondu ? (
                        <>
                          {rendreEchelle(q, eleve[q.id], false)}
                          {bilanLigne && bilanLigne.comparees > 0 && (
                            <span className={styles.verdict}>
                              {bilanLigne.justes} juste{bilanLigne.justes > 1 ? 's' : ''} ·{' '}
                              {bilanLigne.sousEstimations} sous-estimation
                              {bilanLigne.sousEstimations > 1 ? 's' : ''} ·{' '}
                              {bilanLigne.surestimations} surestimation
                              {bilanLigne.surestimations > 1 ? 's' : ''}
                            </span>
                          )}
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
