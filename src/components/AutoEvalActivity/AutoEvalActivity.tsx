'use client';

// L'élève répond à un questionnaire d'AUTO-ÉVALUATION.
//
// Ce n'est pas une épreuve : rien n'est juste ou faux, rien n'est noté. L'écran
// doit donc dire le contraire de ce que dit un questionnaire ordinaire — d'où
// l'absence totale de points, de compteur de bonnes réponses et de correction.
//
// Les réponses sont enregistrées en JSON dans `travail.content`, comme pour le
// questionnaire de lecture (`parseAutoEvalAnswers`).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  aRepondu,
  echelleDe,
  estLikertMatrice,
  estQuestion,
  LIKERT_COLONNES,
  LIKERT_MAX_DEFAUT,
  LIKERT_MIN_DEFAUT,
  LIKERT_NIVEAUX,
  parseAutoEvalAnswers,
} from '@/types/autoevaluation';

// `MatriceField` est partagé avec le questionnaire de lecture, où une ligne
// peut porter PLUSIEURS colonnes. L'auto-évaluation, elle, n'a jamais qu'une
// réponse par ligne — on ramène donc la valeur à un nombre plutôt que d'élargir
// son modèle pour un besoin qu'elle n'a pas.
function uneParLigne(v: Record<number, number | number[]>): Record<number, number> {
  const out: Record<number, number> = {};
  Object.entries(v).forEach(([ligne, valeur]) => {
    const n = Array.isArray(valeur) ? valeur[0] : valeur;
    if (typeof n === 'number') out[Number(ligne)] = n;
  });
  return out;
}
import type {
  AutoEvalAnswer,
  AutoEvalQuestion,
  AutoEvalQuestionnaire,
} from '@/types/autoevaluation';
import { MatriceField } from '@/components/QuestionInteractions';
import styles from './AutoEvalActivity.module.css';

interface Props {
  quiz: AutoEvalQuestionnaire;
  content: string | undefined | null;
  onChange: (content: string) => void;
  // Lecture seule : travail remis, ou prof en aperçu
  readOnly?: boolean;
  // La remise se fait au BAS du questionnaire, jamais depuis la barre du haut :
  // « Remettre le devoir » est le geste de l'écrit. Absent = pas de remise
  // possible (aperçu prof, travail déjà envoyé).
  onSubmit?: () => void;
  isSubmitting?: boolean;
}

export default function AutoEvalActivity({
  quiz,
  content,
  onChange,
  readOnly = false,
  onSubmit,
  isSubmitting = false,
}: Props) {
  const [answers, setAnswers] = useState<Record<string, AutoEvalAnswer>>({});

  // Le contenu ne se relit qu'au premier rendu et quand l'activité change :
  // le relire à chaque frappe écraserait la saisie en cours (l'auto-save
  // renvoie l'objet `travail` mis à jour)
  const charge = useRef(false);
  useEffect(() => {
    if (charge.current) return;
    charge.current = true;
    const parsed = parseAutoEvalAnswers(content);
    if (parsed) setAnswers(parsed.answers);
  }, [content]);

  // La fonction passée à setAnswers doit rester PURE : React la rejoue pendant
  // le rendu, et prévenir le parent depuis l'intérieur revenait à le faire
  // changer d'état en plein rendu (« Cannot update a component while rendering
  // a different component »). On tient donc l'état courant dans un ref, et on
  // prévient le parent depuis le gestionnaire d'événement lui-même.
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const readOnlyRef = useRef(readOnly);
  readOnlyRef.current = readOnly;

  const majReponse = useCallback((id: string, patch: Partial<AutoEvalAnswer>) => {
    if (readOnlyRef.current) return;
    const prev = answersRef.current;
    const next = { ...prev, [id]: { ...prev[id], ...patch } };
    answersRef.current = next;
    setAnswers(next);
    onChangeRef.current(JSON.stringify({ type: 'autoevaluation', answers: next }));
  }, []);

  const questions = quiz.questions ?? [];
  const aRepondreCount = questions.filter(estQuestion).length;
  const repondues = useMemo(
    () => questions.filter((q) => estQuestion(q) && aRepondu(q, answers[q.id])).length,
    [questions, answers]
  );

  const rendre = (q: AutoEvalQuestion) => {
    const a = answers[q.id] ?? {};

    switch (q.type) {
      // ── Échelles à emoji : la réponse se donne d'un seul clic ──
      case 'competence':
      case 'humeur': {
        const echelle = echelleDe(q.type);
        return (
          <div className={styles.echelons}>
            {echelle.map((e) => {
              const choisi = a.echelon === e.id;
              return (
                <button
                  key={e.id}
                  type="button"
                  className={`${styles.echelon} ${choisi ? styles.echelonOn : ''}`}
                  onClick={() => majReponse(q.id, { echelon: choisi ? null : e.id })}
                  disabled={readOnly}
                  aria-pressed={choisi}
                >
                  <span className={styles.echelonEmoji}>{e.emoji}</span>
                  <span className={styles.echelonTexte}>{e.label}</span>
                </button>
              );
            })}
          </div>
        );
      }

      // ── Échelle de 1 à 5 ──
      // Avec des items, c'est un tableau (le même MatriceField que la matrice,
      // aux colonnes numérotées) ; sans items, le curseur d'origine.
      case 'likert': {
        if (estLikertMatrice(q)) {
          return (
            <div className={styles.likertMatrice}>
              <div className={styles.likertBornes}>
                <span>1 — {q.likertMin || LIKERT_MIN_DEFAUT}</span>
                <span>{LIKERT_NIVEAUX} — {q.likertMax || LIKERT_MAX_DEFAUT}</span>
              </div>
              <MatriceField
                items={q.matriceItems ?? []}
                colonnes={LIKERT_COLONNES}
                valeurs={a.matrice ?? {}}
                onChange={(matrice) => majReponse(q.id, { matrice: uneParLigne(matrice) })}
                disabled={readOnly}
                nomGroupe={`ae-${q.id}`}
              />
            </div>
          );
        }
        const valeur = a.likert ?? 0;
        return (
          <div className={styles.likert}>
            <div className={styles.likertBornes}>
              <span>{q.likertMin || LIKERT_MIN_DEFAUT}</span>
              <span>{q.likertMax || LIKERT_MAX_DEFAUT}</span>
            </div>
            <input
              type="range"
              className={styles.curseur}
              min={1}
              max={LIKERT_NIVEAUX}
              step={1}
              // Tant que rien n'est choisi, le curseur se place au milieu sans
              // que la réponse compte comme donnée
              value={valeur || Math.ceil(LIKERT_NIVEAUX / 2)}
              onChange={(e) => majReponse(q.id, { likert: Number(e.target.value) })}
              disabled={readOnly}
            />
            <div className={styles.likertGraduations}>
              {Array.from({ length: LIKERT_NIVEAUX }, (_, i) => (
                <span
                  key={i}
                  className={`${styles.graduation} ${valeur === i + 1 ? styles.graduationOn : ''}`}
                >
                  {i + 1}
                </span>
              ))}
            </div>
            {!valeur && <p className={styles.aRepondre}>Déplacez le curseur pour répondre.</p>}
          </div>
        );
      }

      case 'qcm':
        return (
          <div className={styles.choices}>
            {q.multiple && (
              <p className={styles.aRepondre}>Tu peux en choisir plusieurs.</p>
            )}
            {(q.choices ?? []).map((opt, j) => {
              const choisi = q.multiple
                ? (a.choiceIndexes ?? []).includes(j)
                : a.choiceIndex === j;
              const basculer = () => {
                if (!q.multiple) {
                  majReponse(q.id, { choiceIndex: choisi ? null : j });
                  return;
                }
                const set = new Set(a.choiceIndexes ?? []);
                if (set.has(j)) set.delete(j);
                else set.add(j);
                majReponse(q.id, { choiceIndexes: [...set].sort((x, y) => x - y) });
              };
              return (
                <button
                  key={j}
                  type="button"
                  className={`${styles.choice} ${choisi ? styles.choiceOn : ''}`}
                  onClick={basculer}
                  disabled={readOnly}
                  aria-pressed={choisi}
                >
                  {/* Carré pour le choix multiple, rond pour le choix unique :
                      la puce dit combien de réponses on peut prendre. */}
                  <span className={styles.choicePuce}>
                    {q.multiple ? (choisi ? '◼' : '◻') : choisi ? '●' : '○'}
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>
        );

      // Matrice : plusieurs items qui partagent les mêmes réponses.
      // Même composant que le questionnaire de lecture — mais SANS `attendu` :
      // en auto-évaluation, aucune colonne n'est « juste ».
      case 'matrice':
        return (
          <MatriceField
            nomGroupe={q.id}
            items={q.matriceItems ?? []}
            colonnes={q.choices ?? []}
            valeurs={a.matrice ?? {}}
            onChange={(matrice) => majReponse(q.id, { matrice: uneParLigne(matrice) })}
            disabled={readOnly}
          />
        );

      case 'texte-court':
        return (
          <input
            type="text"
            className={styles.champCourt}
            value={a.text ?? ''}
            onChange={(e) => majReponse(q.id, { text: e.target.value })}
            placeholder="Ta réponse…"
            disabled={readOnly}
          />
        );

      case 'texte-long':
        return (
          <textarea
            className={styles.champLong}
            value={a.text ?? ''}
            onChange={(e) => majReponse(q.id, { text: e.target.value })}
            placeholder="Explique en quelques phrases…"
            rows={5}
            disabled={readOnly}
          />
        );

      default:
        return null;
    }
  };

  if (questions.length === 0) {
    return (
      <p className={styles.vide}>
        Cette auto-évaluation ne contient encore aucune question.
      </p>
    );
  }

  return (
    <div className={styles.activity}>
      <div className={styles.entete}>
        <h2 className={styles.titre}>Où en es-tu ?</h2>
        {quiz.intention && <p className={styles.intention}>{quiz.intention}</p>}
        <p className={styles.rassurance}>
          Il n’y a ici ni bonne ni mauvaise réponse, et rien n’est noté. Réponds honnêtement :
          c’est ce qui rendra la suite utile.
        </p>
        <div className={styles.progression}>
          <div className={styles.barre}>
            <div
              className={styles.barreFill}
              style={{ width: `${aRepondreCount ? (repondues / aRepondreCount) * 100 : 0}%` }}
            />
          </div>
          <span className={styles.progressionTexte}>
            {repondues} / {aRepondreCount} répondue{repondues > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className={styles.liste}>
        {questions.map((q, index) => {
          if (q.type === 'info') {
            return (
              <div key={q.id} className={styles.info}>
                {q.enonce}
              </div>
            );
          }

          const numero = questions.slice(0, index).filter(estQuestion).length + 1;
          const repondu = aRepondu(q, answers[q.id]);
          return (
            <div key={q.id} className={`${styles.bloc} ${repondu ? styles.blocRepondu : ''}`}>
              <div className={styles.blocHead}>
                <span className={styles.numero}>{numero}</span>
                <p className={styles.enonce}>
                  {q.enonce}
                  {q.obligatoire && <span className={styles.requis} title="Réponse attendue"> *</span>}
                </p>
                {repondu && <span className={styles.coche} title="Tu as répondu">✓</span>}
              </div>

              {q.document && <div className={styles.document}>{q.document}</div>}

              <div className={styles.reponse}>{rendre(q)}</div>
            </div>
          );
        })}
      </div>

      {onSubmit && !readOnly && (
        <>
          <div className={styles.bottomActions}>
            <span className={styles.bottomActionsLine} />
            <div className={styles.bottomActionsRow}>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={onSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Envoi…' : 'Envoyer mes réponses'}
              </button>
            </div>
            <span className={styles.bottomActionsLine} />
          </div>

          {/* Le rappel se pose SOUS le bouton, discret : à côté, il se lisait
              comme un avertissement qui retenait l'envoi. Rien n'est
              obligatoire ici — une question sautée reste un signal. */}
          {repondues < aRepondreCount && (
            <p className={styles.bottomActionsNote}>
              {aRepondreCount - repondues} question
              {aRepondreCount - repondues > 1 ? 's' : ''} sans réponse
            </p>
          )}
        </>
      )}
    </div>
  );
}
