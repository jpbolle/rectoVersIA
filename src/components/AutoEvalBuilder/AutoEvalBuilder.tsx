'use client';

// Constructeur du questionnaire d'AUTO-ÉVALUATION (verso de la création /
// édition d'une activité de type « autoevaluation »).
//
// Même forme que les constructeurs de lecture et de recherche : des blocs
// repliables, réordonnables en glisser-déposer, l'énoncé dans le corps et les
// réglages dans l'entête. Deux différences de fond :
//  - AUCUN POINT, aucune bonne réponse : l'élève se prononce, il n'est pas
//    corrigé. Ce qui remplace le barème, c'est le caractère obligatoire ou non
//    de la réponse ;
//  - les gestes proposés sont ceux du SAVOIR-ÊTRE et les gestes RÉFLEXIFS —
//    jamais les gestes cognitifs.

import { useState } from 'react';
import { useDidactique } from '@/hooks/useDidactique';
import { TYPES_SAVOIR_ETRE, habileteLabel } from '@/types/didactique';
import {
  AUTOEVAL_TYPE_LABELS,
  ECHELLE_COMPETENCE,
  ECHELLE_HUMEUR,
  LIKERT_MAX_DEFAUT,
  LIKERT_MIN_DEFAUT,
  MATRICE_MODELES,
  LIKERT_NIVEAUX,
  estLikertMatrice,
  estQuestion,
  generateAutoEvalQuestionId,
} from '@/types/autoevaluation';
import type {
  AutoEvalQuestion,
  AutoEvalQuestionType,
  AutoEvalQuestionnaire,
} from '@/types/autoevaluation';
import AutoGrowTextarea from '@/components/AutoGrowTextarea';
import styles from './AutoEvalBuilder.module.css';
import { focaliserChamp, insererChoix } from '@/lib/choix-liste';

interface Props {
  quiz: AutoEvalQuestionnaire | null;
  onChange: (quiz: AutoEvalQuestionnaire | null) => void;
  disabled?: boolean;
  // Habiletés retenues pour l'activité : les questions ne piochent que là-dedans.
  // null = pas de restriction.
  allowedHabiletes?: string[] | null;
}

// Ce qu'on peut ajouter, dans l'ordre du bandeau de boutons
const AJOUTS: { type: AutoEvalQuestionType; label: string; icone: string }[] = [
  { type: 'competence', label: 'Sentiment de compétence', icone: '🤩' },
  { type: 'humeur', label: 'Émotion', icone: '😌' },
  { type: 'likert', label: 'Échelle 1-5', icone: '📊' },
  { type: 'qcm', label: 'Choix multiple', icone: '☑' },
  { type: 'matrice', label: 'Matrice', icone: '▦' },
  { type: 'texte-court', label: 'Réponse courte', icone: '✏️' },
  { type: 'texte-long', label: 'Réponse longue', icone: '📝' },
  { type: 'info', label: 'Bloc informatif', icone: 'ℹ️' },
];

/**
 * Les LIGNES d'un tableau — les affirmations d'une matrice, et celles d'une
 * échelle de 1 à 5 qui en porte plusieurs.
 *
 * Un seul éditeur pour les deux : ce sont les mêmes lignes, dans le même
 * champ (`matriceItems`). Deux éditeurs auraient divergé sur le minimum de
 * lignes, sur le libellé, ou sur la suppression — c'est exactement ce qui
 * était arrivé aux trois champs « énoncé ».
 */
function EditeurItems({
  items,
  minimum,
  onChange,
  disabled,
  styles: s,
}: {
  items: string[];
  /** En dessous, on n'offre plus de supprimer : la question n'aurait plus de sens */
  minimum: number;
  onChange: (items: string[]) => void;
  disabled?: boolean;
  styles: Record<string, string>;
}) {
  return (
    <>
      <div className={s.fieldLabel} style={{ marginTop: 12 }}>
        Les affirmations (les lignes)
      </div>
      {items.map((item, j) => (
        <div key={j} className={s.choice}>
          <span className={s.choiceLabel}>{j + 1}</span>
          <input
            type="text"
            value={item}
            onChange={(e) => {
              const next = [...items];
              next[j] = e.target.value;
              onChange(next);
            }}
            placeholder={`Affirmation ${j + 1}`}
            disabled={disabled}
          />
          {items.length > minimum && (
            <button
              type="button"
              className={s.choiceDel}
              onClick={() => onChange(items.filter((_, k) => k !== j))}
              disabled={disabled}
            >
              ✕
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        className={s.addChoice}
        onClick={() => onChange([...items, ''])}
        disabled={disabled}
      >
        + Ajouter une affirmation
      </button>
    </>
  );
}

function excerpt(texte: string): string {
  const t = texte.trim();
  return t.length > 70 ? `${t.slice(0, 70)}…` : t;
}

export default function AutoEvalBuilder({
  quiz,
  onChange,
  disabled = false,
  allowedHabiletes = null,
}: Props) {
  const { config } = useDidactique();
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [habOpenId, setHabOpenId] = useState<string | null>(null);

  const questions = quiz?.questions ?? [];

  const maj = (patch: Partial<AutoEvalQuestionnaire>) =>
    onChange({ intention: quiz?.intention ?? '', questions, ...patch });

  const majQuestion = (id: string, patch: Partial<AutoEvalQuestion>) =>
    maj({ questions: questions.map((q) => (q.id === id ? { ...q, ...patch } : q)) });

  const ajouter = (type: AutoEvalQuestionType) => {
    const q: AutoEvalQuestion = {
      id: generateAutoEvalQuestionId(),
      type,
      enonce: '',
      competences: [],
      obligatoire: type !== 'info',
      ...(type === 'qcm' ? { choices: ['', ''] } : {}),
      // La matrice démarre sur une échelle de fréquence : une matrice aux
      // colonnes vides ne montre pas à quoi le type sert.
      ...(type === 'matrice'
        ? { choices: [...MATRICE_MODELES[0].colonnes], matriceItems: ['', ''] }
        : {}),
      ...(type === 'likert' ? { likertMin: LIKERT_MIN_DEFAUT, likertMax: LIKERT_MAX_DEFAUT } : {}),
    };
    maj({ questions: [...questions, q] });
    setOpenIds(new Set([q.id]));
  };

  const supprimer = (id: string) => maj({ questions: questions.filter((q) => q.id !== id) });

  const dupliquer = (id: string) => {
    const i = questions.findIndex((q) => q.id === id);
    if (i === -1) return;
    const copie: AutoEvalQuestion = {
      ...JSON.parse(JSON.stringify(questions[i])),
      id: generateAutoEvalQuestionId(),
    };
    const next = [...questions];
    next.splice(i + 1, 0, copie);
    maj({ questions: next });
    setOpenIds(new Set([copie.id]));
  };

  const deplacer = (from: number, to: number) => {
    if (from === to) return;
    const next = [...questions];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    maj({ questions: next });
  };

  const toggleOpen = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Gestes proposés : savoir-être et réflexifs, restreints à ceux retenus
  // pour l'activité si le prof en a coché.
  const habiletesDispo = (q: AutoEvalQuestion) => {
    const cochees = q.competences ?? [];
    const restriction = allowedHabiletes ? new Set(allowedHabiletes) : null;
    return (config?.habiletes ?? [])
      .filter((h) => TYPES_SAVOIR_ETRE.includes(h.type))
      .filter((h) => h.visible || cochees.includes(h.id))
      .filter((h) => !restriction || restriction.has(h.id) || cochees.includes(h.id))
      .map((h) => ({ id: h.id, label: habileteLabel(h), geste: h.geste }));
  };

  const toggleCompetence = (q: AutoEvalQuestion, id: string) => {
    const cochees = q.competences ?? [];
    majQuestion(q.id, {
      competences: cochees.includes(id) ? cochees.filter((c) => c !== id) : [...cochees, id],
    });
  };

  const nbQuestions = questions.filter(estQuestion).length;

  return (
    <div className={styles.builder}>
      <h3 className={styles.title}>Questionnaire d’auto-évaluation</h3>

      <div className={styles.intro}>
        <label className={styles.label}>Sur quoi l’élève se prononce-t-il ?</label>
        <textarea
          className={styles.introArea}
          value={quiz?.intention ?? ''}
          onChange={(e) => maj({ intention: e.target.value })}
          placeholder="Ex. : ta contraction de texte rendue la semaine dernière — ou ton attitude au cours depuis les vacances."
          rows={2}
          disabled={disabled}
        />
        <p className={styles.hint}>
          Rien n’est corrigé ici : l’élève dit où il en est. Ses réponses n’entrent dans aucune
          note, elles nourrissent l’onglet réflexif de son profil.
        </p>
      </div>

      <div className={styles.totalsBar}>
        <span className={styles.totalChip}>
          <strong>{nbQuestions}</strong> question{nbQuestions > 1 ? 's' : ''}
        </span>
        <span className={styles.totalChip}>
          {questions.filter((q) => q.obligatoire && estQuestion(q)).length} obligatoire(s)
        </span>
      </div>

      <div className={styles.qList}>
        {questions.length === 0 && (
          <p className={styles.empty}>
            Aucune question. Commencez par un « sentiment de compétence » ou une échelle, puis
            demandez à l’élève d’expliquer sa position.
          </p>
        )}

        {questions.map((q, index) => {
          const isOpen = openIds.has(q.id);
          const nbHab = (q.competences ?? []).length;
          const info = q.type === 'info';
          return (
            <div
              key={q.id}
              className={`${styles.qBlock} ${info ? styles.qBlockInfo : ''} ${
                dragIndex === index ? styles.dragging : ''
              } ${overIndex === index && dragIndex !== null && dragIndex !== index ? styles.over : ''}`}
              draggable={!disabled}
              onDragStart={() => setDragIndex(index)}
              onDragEnd={() => {
                setDragIndex(null);
                setOverIndex(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setOverIndex(index);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex !== null) deplacer(dragIndex, index);
                setDragIndex(null);
                setOverIndex(null);
              }}
            >
              <div className={styles.qHead} onClick={() => toggleOpen(q.id)}>
                <span className={styles.grip} title="Glisser pour réordonner" onClick={(e) => e.stopPropagation()}>
                  ⠿
                </span>
                <span className={styles.chevron}>{isOpen ? '▾' : '▸'}</span>
                <span className={styles.qNum}>{info ? 'Bloc' : `Question ${index + 1}`}</span>
                <span className={`${styles.qType} ${styles[`type_${q.type.replace('-', '_')}`] ?? ''}`}>
                  {AUTOEVAL_TYPE_LABELS[q.type]}
                </span>
                {!isOpen && q.enonce && <span className={styles.qExcerpt}>{excerpt(q.enonce)}</span>}

                <span className={styles.headRight} onClick={(e) => e.stopPropagation()}>
                  {!info && (
                    <>
                      <span className={styles.habWrap}>
                        <button
                          type="button"
                          className={`${styles.habBtn} ${nbHab > 0 ? styles.habBtnOn : ''}`}
                          onClick={() => setHabOpenId(habOpenId === q.id ? null : q.id)}
                          disabled={disabled}
                          title="Gestes de savoir-être et gestes réflexifs exercés"
                        >
                          Gestes{nbHab > 0 ? ` (${nbHab})` : ''} ▾
                        </button>
                        {habOpenId === q.id && (
                          <>
                            <span className={styles.habBackdrop} onClick={() => setHabOpenId(null)} />
                            <span className={styles.habMenu}>
                              <span className={styles.habMenuTitle}>
                                Savoir-être et gestes réflexifs
                              </span>
                              {habiletesDispo(q).length === 0 && (
                                <span className={styles.habEmpty}>
                                  Aucun geste disponible — à gérer dans Administration du site →
                                  Gestion didactique.
                                </span>
                              )}
                              {habiletesDispo(q).map((h) => (
                                <label key={h.id} className={styles.habItem}>
                                  <input
                                    type="checkbox"
                                    checked={(q.competences ?? []).includes(h.id)}
                                    onChange={() => toggleCompetence(q, h.id)}
                                    disabled={disabled}
                                  />
                                  <span>
                                    {h.label}
                                    <em className={styles.habGeste}> — {h.geste}</em>
                                  </span>
                                </label>
                              ))}
                            </span>
                          </>
                        )}
                      </span>

                      <label className={styles.oblig} title="Une réponse est-elle exigée avant la remise ?">
                        <input
                          type="checkbox"
                          checked={q.obligatoire ?? false}
                          onChange={(e) => majQuestion(q.id, { obligatoire: e.target.checked })}
                          disabled={disabled}
                        />
                        obligatoire
                      </label>
                    </>
                  )}

                  <button
                    type="button"
                    className={styles.qAction}
                    onClick={() => dupliquer(q.id)}
                    title="Dupliquer"
                    disabled={disabled}
                  >
                    ⧉
                  </button>
                  <button
                    type="button"
                    className={`${styles.qAction} ${styles.qDel}`}
                    onClick={() => supprimer(q.id)}
                    title="Supprimer"
                    disabled={disabled}
                  >
                    🗑
                  </button>
                </span>
              </div>

              {isOpen && (
                <div className={styles.qBody}>
                  {/* Hauteur mesurée sur le contenu (AutoGrowTextarea). Le
                      placeholder reste propre à ce constructeur : un bloc
                      informatif et une question ne s'amorcent pas pareil. */}
                  <AutoGrowTextarea
                    className={styles.enonce}
                    value={q.enonce}
                    onChange={(e) => majQuestion(q.id, { enonce: e.target.value })}
                    placeholder={
                      info
                        ? 'Texte affiché à l’élève — une consigne, une transition, un encouragement…'
                        : 'Ex. : Où en es-tu dans ta capacité à organiser un texte en paragraphes ?'
                    }
                    minRows={2}
                    maxRows={12}
                    disabled={disabled}
                  />

                  {/* Aperçu de l'échelle : le prof voit ce que verra l'élève */}
                  {(q.type === 'competence' || q.type === 'humeur') && (
                    <div className={styles.echelle}>
                      <span className={styles.echelleLabel}>Ce que l’élève choisira</span>
                      <div className={styles.echelons}>
                        {(q.type === 'competence' ? ECHELLE_COMPETENCE : ECHELLE_HUMEUR).map((e) => (
                          <span key={e.id} className={styles.echelon} title={e.label}>
                            <span className={styles.echelonEmoji}>{e.emoji}</span>
                            <span className={styles.echelonTexte}>{e.label}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {q.type === 'likert' && (
                    <>
                      <div className={styles.likertRow}>
                        <label className={styles.likertBorne}>
                          Borne basse
                          <input
                            type="text"
                            value={q.likertMin ?? LIKERT_MIN_DEFAUT}
                            onChange={(e) => majQuestion(q.id, { likertMin: e.target.value })}
                            disabled={disabled}
                          />
                        </label>
                        <span className={styles.likertApercu}>
                          {Array.from({ length: LIKERT_NIVEAUX }, (_, i) => (
                            <span key={i} className={styles.likertPoint}>
                              {i + 1}
                            </span>
                          ))}
                        </span>
                        <label className={styles.likertBorne}>
                          Borne haute
                          <input
                            type="text"
                            value={q.likertMax ?? LIKERT_MAX_DEFAUT}
                            onChange={(e) => majQuestion(q.id, { likertMax: e.target.value })}
                            disabled={disabled}
                          />
                        </label>
                      </div>

                      {/* ── La dimension MATRICE de l'échelle ──
                          Ce que « réponses multiples » est au QCM : la même
                          question posée sur plusieurs lignes. Décochée, on
                          revient au curseur simple — et les questionnaires
                          déjà écrits n'ont jamais coché quoi que ce soit. */}
                      <label className={styles.multipleToggle}>
                        <input
                          type="checkbox"
                          checked={estLikertMatrice(q)}
                          onChange={(e) =>
                            majQuestion(q.id, {
                              matriceItems: e.target.checked ? ['', ''] : [],
                            })
                          }
                          disabled={disabled}
                        />
                        Plusieurs items sur la même échelle (tableau)
                      </label>

                      {estLikertMatrice(q) && (
                        <div className={styles.choices}>
                          <EditeurItems
                            items={q.matriceItems ?? []}
                            minimum={2}
                            onChange={(matriceItems) => majQuestion(q.id, { matriceItems })}
                            disabled={disabled}
                            styles={styles}
                          />
                        </div>
                      )}
                    </>
                  )}

                  {/* Le QCM et la matrice partagent leur éditeur de réponses :
                      ce sont les mêmes colonnes. La matrice y ajoute ses
                      lignes, plus bas. */}
                  {(q.type === 'qcm' || q.type === 'matrice') && (
                    <div className={styles.choices}>
                      <p className={styles.hint}>
                        Aucune option n’est « la bonne » : ce sont des positions parmi lesquelles
                        l’élève se reconnaît.
                      </p>

                      {q.type === 'qcm' && (
                        <label className={styles.multipleToggle}>
                          <input
                            type="checkbox"
                            checked={q.multiple === true}
                            onChange={(e) => majQuestion(q.id, { multiple: e.target.checked })}
                            disabled={disabled}
                          />
                          L’élève peut en choisir plusieurs
                        </label>
                      )}

                      {q.type === 'matrice' && (
                        <div className={styles.modeleRow}>
                          {MATRICE_MODELES.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              className={styles.addChoice}
                              onClick={() => majQuestion(q.id, { choices: [...m.colonnes] })}
                              disabled={disabled}
                              title={m.colonnes.join(' · ')}
                            >
                              {m.label}
                            </button>
                          ))}
                        </div>
                      )}

                      {(q.choices ?? []).map((opt, j) => (
                        <div key={j} className={styles.choice}>
                          <span className={styles.choiceLabel}>{String.fromCharCode(65 + j)}</span>
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => {
                              const choices = [...(q.choices ?? [])];
                              choices[j] = e.target.value;
                              majQuestion(q.id, { choices });
                            }}
                            data-champ={`${q.id}-choix-${j}`}
                            // Entrée ajoute l'option suivante et y va. Aucun
                            // corrigé à décaler ici : en auto-évaluation,
                            // aucune option n'est « juste ».
                            onKeyDown={(e) => {
                              if (e.key !== 'Enter') return;
                              e.preventDefault();
                              majQuestion(q.id, {
                                choices: insererChoix(q.choices ?? [], j).choix,
                              });
                              focaliserChamp(`${q.id}-choix-${j + 1}`);
                            }}
                            placeholder={`Option ${String.fromCharCode(65 + j)}`}
                            disabled={disabled}
                          />
                          {(q.choices ?? []).length > 2 && (
                            <button
                              type="button"
                              className={styles.choiceDel}
                              onClick={() =>
                                majQuestion(q.id, {
                                  choices: (q.choices ?? []).filter((_, k) => k !== j),
                                })
                              }
                              disabled={disabled}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        className={styles.addChoice}
                        onClick={() => majQuestion(q.id, { choices: [...(q.choices ?? []), ''] })}
                        disabled={disabled}
                      >
                        {q.type === 'matrice' ? '+ Ajouter une colonne' : '+ Ajouter un choix'}
                      </button>

                      {/* Les lignes de la matrice : c'est ce qui la distingue
                          du QCM — plusieurs affirmations, mêmes réponses. */}
                      {q.type === 'matrice' && (
                        <EditeurItems
                          items={q.matriceItems ?? []}
                          minimum={2}
                          onChange={(matriceItems) => majQuestion(q.id, { matriceItems })}
                          disabled={disabled}
                          styles={styles}
                        />
                      )}
                    </div>
                  )}

                  {!info && (
                    <details className={styles.details}>
                      <summary className={styles.detailsSummary}>Texte d’accompagnement</summary>
                      <textarea
                        className={styles.detailsArea}
                        value={q.document ?? ''}
                        onChange={(e) => majQuestion(q.id, { document: e.target.value })}
                        placeholder="Un rappel de consigne, un extrait du travail à commenter…"
                        rows={3}
                        disabled={disabled}
                      />
                    </details>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.addButtons}>
        {AJOUTS.map((a) => (
          <button
            key={a.type}
            type="button"
            className={styles.btnAdd}
            onClick={() => ajouter(a.type)}
            disabled={disabled}
          >
            {a.icone} {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
