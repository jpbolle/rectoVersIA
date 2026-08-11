'use client';

// Builder du questionnaire de lecture (verso de la création/édition d'une
// activité de type « lire ») : blocs de questions réordonnables en drag & drop,
// 4 types (QCM, texte court, texte long, fluorage), image par question,
// compétences de lecture par question.

import { useRef, useState } from 'react';
import { compressImage } from '@/lib/image-compress';
import {
  LECTURE_COMPETENCES,
  LECTURE_COMPETENCE_LABELS,
  generateLectureQuestionId,
} from '@/types/lecture';
import type {
  LectureQuiz,
  LectureQuestion,
  LectureQuestionType,
  LectureCompetence,
} from '@/types/lecture';
import styles from './LectureQuizBuilder.module.css';

const TYPE_LABELS: Record<LectureQuestionType, string> = {
  qcm: 'QCM',
  'texte-court': 'Texte court',
  'texte-long': 'Texte long',
  fluorage: 'Fluorage de texte',
  info: 'Bloc informatif',
};

function emptyQuestion(type: LectureQuestionType): LectureQuestion {
  const q: LectureQuestion = {
    id: generateLectureQuestionId(),
    type,
    enonce: '',
    points: type === 'info' ? 0 : 1,
    competences: [],
  };
  if (type === 'qcm') {
    q.choices = ['', ''];
    q.correctIndex = 0;
  }
  if (type === 'fluorage') {
    q.fluoSource = 'extrait';
    q.fluoTexte = '';
  }
  return q;
}

interface LectureQuizBuilderProps {
  value: LectureQuiz | null;
  onChange: (quiz: LectureQuiz) => void;
  disabled?: boolean;
  getAuthHeaders?: () => Promise<Record<string, string> | null>;
}

export default function LectureQuizBuilder({
  value,
  onChange,
  disabled = false,
  getAuthHeaders,
}: LectureQuizBuilderProps) {
  const quiz: LectureQuiz = value ?? { mode: 'worksheet', questions: [] };
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [popupImage, setPopupImage] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<string | null>(null);

  const update = (partial: Partial<LectureQuiz>) => onChange({ ...quiz, ...partial });

  const updateQuestion = (id: string, partial: Partial<LectureQuestion>) => {
    update({
      questions: quiz.questions.map((q) => (q.id === id ? { ...q, ...partial } : q)),
    });
  };

  const addQuestion = (type: LectureQuestionType) => {
    update({ questions: [...quiz.questions, emptyQuestion(type)] });
  };

  const removeQuestion = (id: string) => {
    update({ questions: quiz.questions.filter((q) => q.id !== id) });
  };

  const moveQuestion = (from: number, to: number) => {
    if (from === to) return;
    const next = [...quiz.questions];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    update({ questions: next });
  };

  // ── Image de question ──
  const triggerUpload = (questionId: string) => {
    uploadTargetRef.current = questionId;
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const questionId = uploadTargetRef.current;
    if (!file || !questionId || !getAuthHeaders) return;

    setUploadingId(questionId);
    setUploadError(null);
    try {
      const compressed = await compressImage(file);
      if (!compressed) {
        setUploadError(`Impossible de compresser « ${file.name} »`);
        return;
      }
      const formData = new FormData();
      formData.append('files', compressed.blob, compressed.name);
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch('/api/ressources/upload', {
        method: 'POST',
        headers,
        body: formData,
      });
      const json = await res.json();
      if (json.success && json.data?.files?.[0]) {
        const f = json.data.files[0];
        updateQuestion(questionId, { image: { url: f.url, fileId: f.fileId } });
      } else {
        setUploadError(json.message || "Erreur lors de l'upload");
      }
    } catch {
      setUploadError("Erreur de connexion pendant l'upload");
    } finally {
      setUploadingId(null);
    }
  };

  const toggleCompetence = (q: LectureQuestion, comp: LectureCompetence) => {
    const next = q.competences.includes(comp)
      ? q.competences.filter((c) => c !== comp)
      : [...q.competences, comp];
    updateQuestion(q.id, { competences: next });
  };

  return (
    <div className={styles.builder}>
      {/* Choix worksheet / quiz */}
      <div className={styles.modeRow}>
        <span className={styles.modeLabel}>Présentation</span>
        <label className={styles.modeOpt}>
          <input
            type="radio"
            checked={quiz.mode === 'worksheet'}
            onChange={() => update({ mode: 'worksheet' })}
            disabled={disabled}
          />
          📄 Worksheet
          <span
            className={styles.info}
            title="Toutes les questions sur une page — l'élève répond dans l'ordre qu'il veut, remise unique à la fin."
          >
            i
          </span>
        </label>
        <label className={styles.modeOpt}>
          <input
            type="radio"
            checked={quiz.mode === 'quiz'}
            onChange={() => update({ mode: 'quiz' })}
            disabled={disabled}
          />
          🎯 Quiz
          <span
            className={styles.info}
            title="Une question à la fois, navigation ‹ › et barre de progression. Remise unique à la fin."
          >
            i
          </span>
        </label>
      </div>

      {/* Blocs de questions */}
      <div className={styles.qList}>
        {quiz.questions.map((q, index) => (
          <div
            key={q.id}
            className={`${styles.qBlock} ${dragIndex === index ? styles.qBlockDragging : ''} ${overIndex === index && dragIndex !== null && dragIndex !== index ? styles.qBlockOver : ''}`}
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
              if (dragIndex !== null) moveQuestion(dragIndex, index);
              setDragIndex(null);
              setOverIndex(null);
            }}
          >
            <div className={styles.qHead}>
              <span className={styles.grip} title="Glisser pour réordonner">⠿</span>
              <span className={styles.qNum}>
                {q.type === 'info' ? 'ℹ️ Bloc' : `Question ${quiz.questions.slice(0, index).filter((p) => p.type !== 'info').length + 1}`}
              </span>
              <span className={`${styles.qType} ${styles['type_' + q.type.replace('-', '_')]}`}>
                {TYPE_LABELS[q.type]}
              </span>
              {q.type !== 'info' && (
                <span className={styles.qPts}>
                  Points
                  <input
                    type="number"
                    min={0}
                    value={q.points}
                    onChange={(e) => updateQuestion(q.id, { points: Math.max(0, Number(e.target.value) || 0) })}
                    disabled={disabled}
                  />
                </span>
              )}
              <button
                type="button"
                className={`${styles.qDel} ${q.type === 'info' ? styles.qDelRight : ''}`}
                onClick={() => removeQuestion(q.id)}
                title="Supprimer ce bloc"
                disabled={disabled}
              >
                🗑
              </button>
            </div>

            <div className={styles.qBody}>
              <div className={styles.qMain}>
                {q.type === 'info' ? (
                  <textarea
                    className={styles.fluoTextarea}
                    rows={3}
                    value={q.enonce}
                    onChange={(e) => updateQuestion(q.id, { enonce: e.target.value })}
                    placeholder="Texte d'introduction ou de commentaire, affiché tel quel à l'élève dans le questionnaire..."
                    disabled={disabled}
                  />
                ) : (
                  <input
                    type="text"
                    className={styles.enonceInput}
                    value={q.enonce}
                    onChange={(e) => updateQuestion(q.id, { enonce: e.target.value })}
                    placeholder="Énoncé de la question..."
                    disabled={disabled}
                  />
                )}

                {/* QCM : choix + bonne réponse */}
                {q.type === 'qcm' && (
                  <div className={styles.choices}>
                    {(q.choices ?? []).map((choice, ci) => (
                      <div key={ci} className={`${styles.choice} ${q.correctIndex === ci ? styles.choiceCorrect : ''}`}>
                        <input
                          type="radio"
                          checked={q.correctIndex === ci}
                          onChange={() => updateQuestion(q.id, { correctIndex: ci })}
                          title="Bonne réponse"
                          disabled={disabled}
                        />
                        <input
                          type="text"
                          value={choice}
                          onChange={(e) => {
                            const choices = [...(q.choices ?? [])];
                            choices[ci] = e.target.value;
                            updateQuestion(q.id, { choices });
                          }}
                          placeholder={`Choix ${ci + 1}`}
                          disabled={disabled}
                        />
                        {(q.choices ?? []).length > 2 && (
                          <button
                            type="button"
                            className={styles.choiceDel}
                            onClick={() => {
                              const choices = (q.choices ?? []).filter((_, i) => i !== ci);
                              const correctIndex =
                                q.correctIndex !== undefined && q.correctIndex >= choices.length
                                  ? 0
                                  : q.correctIndex === ci
                                    ? 0
                                    : q.correctIndex !== undefined && q.correctIndex > ci
                                      ? q.correctIndex - 1
                                      : q.correctIndex;
                              updateQuestion(q.id, { choices, correctIndex });
                            }}
                            title="Supprimer ce choix"
                            disabled={disabled}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                    <p className={styles.hint}>Cochez la bonne réponse — elle sera corrigée automatiquement.</p>
                    <button
                      type="button"
                      className={styles.addChoice}
                      onClick={() => updateQuestion(q.id, { choices: [...(q.choices ?? []), ''] })}
                      disabled={disabled}
                    >
                      + Ajouter un choix
                    </button>
                  </div>
                )}

                {/* Texte long : note éditeur riche */}
                {q.type === 'texte-long' && (
                  <p className={styles.hint}>
                    L&apos;élève répondra dans un éditeur riche (gras, italique, listes...).
                  </p>
                )}

                {/* Fluorage : source extrait / ressource */}
                {q.type === 'fluorage' && (
                  <div className={styles.fluoBlock}>
                    <div className={styles.fieldLabel}>
                      Texte à fluorer
                      <span
                        className={styles.info}
                        title="Soit un extrait collé dans la question, soit la ressource de l'activité : l'élève fluore alors directement dans l'onglet Ressources, et son fluorage est rattaché à cette question."
                      >
                        i
                      </span>
                    </div>
                    <div className={styles.modeRow}>
                      <label className={styles.modeOpt}>
                        <input
                          type="radio"
                          checked={(q.fluoSource ?? 'extrait') === 'extrait'}
                          onChange={() => updateQuestion(q.id, { fluoSource: 'extrait' })}
                          disabled={disabled}
                        />
                        Extrait ci-dessous
                      </label>
                      <label className={styles.modeOpt}>
                        <input
                          type="radio"
                          checked={q.fluoSource === 'ressource'}
                          onChange={() => updateQuestion(q.id, { fluoSource: 'ressource' })}
                          disabled={disabled}
                        />
                        📚 La ressource de l&apos;activité
                      </label>
                    </div>
                    {(q.fluoSource ?? 'extrait') === 'extrait' ? (
                      <textarea
                        className={styles.fluoTextarea}
                        rows={3}
                        value={q.fluoTexte ?? ''}
                        onChange={(e) => updateQuestion(q.id, { fluoTexte: e.target.value })}
                        placeholder="Collez ici l'extrait que l'élève devra fluorer..."
                        disabled={disabled}
                      />
                    ) : (
                      <p className={styles.hint}>
                        L&apos;élève fluorera directement dans le texte de l&apos;onglet Ressources ;
                        son surlignage sera visible dans votre correction.
                      </p>
                    )}
                  </div>
                )}

                {/* Réponse idéale du prof (toutes les questions, pas les blocs info) */}
                {q.type !== 'info' && (
                  <>
                    <div className={styles.fieldLabel}>
                      Votre réponse idéale
                      <span
                        className={styles.info}
                        title="Jamais montrée à l'élève — affichée dans votre page de correction pour comparer avec sa réponse."
                      >
                        i
                      </span>
                    </div>
                    <textarea
                      className={styles.fluoTextarea}
                      rows={2}
                      value={q.reponseIdeale ?? ''}
                      onChange={(e) => updateQuestion(q.id, { reponseIdeale: e.target.value })}
                      placeholder="Rédigez la réponse attendue (facultatif)..."
                      disabled={disabled}
                    />
                  </>
                )}

                {/* Compétences de lecture (pas pour les blocs info) */}
                {q.type !== 'info' && (
                  <>
                    <div className={styles.fieldLabel}>
                      Compétences de lecture exercées
                      <span
                        className={styles.info}
                        title="Cochez une ou plusieurs compétences — les résultats alimenteront l'onglet Lire du profil de l'élève."
                      >
                        i
                      </span>
                    </div>
                    <div className={styles.compRow}>
                      {LECTURE_COMPETENCES.map((comp) => (
                        <button
                          key={comp}
                          type="button"
                          className={`${styles.comp} ${q.competences.includes(comp) ? styles.compOn : ''}`}
                          onClick={() => toggleCompetence(q, comp)}
                          disabled={disabled}
                        >
                          {LECTURE_COMPETENCE_LABELS[comp]}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Image de la question */}
              <div className={styles.qImgZone}>
                {q.image ? (
                  <>
                    <div className={styles.thumb} onClick={() => setPopupImage(q.image!.url)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={q.image.url} alt="" />
                      <span className={styles.zoomTag}>🔍 agrandir</span>
                    </div>
                    <button
                      type="button"
                      className={styles.imgBtn}
                      onClick={() => triggerUpload(q.id)}
                      disabled={disabled || uploadingId === q.id}
                    >
                      {uploadingId === q.id ? 'Envoi...' : "↺ Remplacer l'image"}
                    </button>
                    <button
                      type="button"
                      className={styles.imgRemove}
                      onClick={() => updateQuestion(q.id, { image: null })}
                      disabled={disabled}
                    >
                      ✕ Retirer
                    </button>
                    <p className={styles.imgNote}>
                      ✏️ L&apos;élève reçoit les outils de tracé — ses tracés sont enregistrés et visibles par vous.
                    </p>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className={styles.imgBtn}
                      onClick={() => triggerUpload(q.id)}
                      disabled={disabled || uploadingId === q.id}
                    >
                      {uploadingId === q.id ? 'Envoi...' : '🖼 Joindre une image'}
                    </button>
                    <p className={styles.imgNote}>
                      Vignette + agrandissement, et atelier de tracé pour l&apos;élève.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {uploadError && <p className={styles.uploadError}>{uploadError}</p>}

      {/* Ajouter une question */}
      <div className={styles.addRow}>
        <button type="button" className={styles.addQ} onClick={() => addQuestion('qcm')} disabled={disabled}>+ QCM</button>
        <button type="button" className={styles.addQ} onClick={() => addQuestion('texte-court')} disabled={disabled}>+ Texte court</button>
        <button type="button" className={styles.addQ} onClick={() => addQuestion('texte-long')} disabled={disabled}>+ Texte long</button>
        <button type="button" className={styles.addQ} onClick={() => addQuestion('fluorage')} disabled={disabled}>+ Fluorage de texte</button>
        <button type="button" className={styles.addQ} onClick={() => addQuestion('info')} disabled={disabled}>+ Bloc informatif</button>
      </div>

      {/* Input fichier caché (upload image de question) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />

      {/* Popup d'agrandissement */}
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
