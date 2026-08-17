'use client';

// Builder du questionnaire de lecture (verso de la création/édition d'une
// activité de type « lire ») : blocs de questions repliables (accordéon) et
// réordonnables en drag & drop, 4 types (QCM, texte court, texte long,
// souligner du texte), image et audio par question (limite d'écoutes),
// gestes de lecture par question (menu déroulant dans l'entête).

import { useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { compressImage } from '@/lib/image-compress';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useDidactique } from '@/hooks/useDidactique';
import { habileteLabel, habiletesOfType } from '@/types/didactique';
import { FluoExtrait } from '@/components/LectureQuizActivity/LectureQuizActivity';
import {
  LECTURE_COMPETENCE_LABELS,
  LECTURE_TYPE_LABELS,
  estAutoCorrigeable,
  generateLectureQuestionId,
} from '@/types/lecture';
import type { LectureCompetence } from '@/types/lecture';
import type {
  LectureQuiz,
  LectureQuestion,
  LectureQuestionImage,
  LectureQuestionType,
} from '@/types/lecture';
import AutoGrowTextarea from '@/components/AutoGrowTextarea';
import { MATRICE_MODELES } from '@/types/autoevaluation';
import ExtraitOeuvreModal from './ExtraitOeuvreModal';
import {
  EditeurAppariement,
  EditeurEnsembles,
  EditeurFluoCategories,
  EditeurImageAnnotee,
  EditeurMatrice,
  EditeurOrdre,
} from './TypeEditors';
import styles from './LectureQuizBuilder.module.css';
import { focaliserChamp, insererChoix } from '@/lib/choix-liste';

// Éditeur riche des blocs informatifs (même éditeur que l'onglet Texte des ressources)
const InfoEditor = dynamic(() => import('@/components/RessourcesInput/DocumentEditor'), {
  ssr: false,
  loading: () => <div className={styles.hint}>Chargement de l&apos;éditeur...</div>,
});

// Libellés : liste unique dans src/types/lecture.ts (voir LECTURE_TYPE_LABELS)
const TYPE_LABELS = LECTURE_TYPE_LABELS;

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
  if (type === 'matrice') {
    // On démarre sur une échelle de fréquence plutôt que sur des colonnes
    // vides : c'est le cas le plus fréquent, et une matrice vide ne montre
    // pas à quoi sert le type.
    q.choices = [...MATRICE_MODELES[0].colonnes];
    q.matriceItems = [''];
    q.matriceCorrect = [-1];
  }
  if (type === 'appariement') {
    q.appariementGauche = [];
    q.appariementDroite = [];
  }
  if (type === 'ordre') {
    q.ordreItems = [];
  }
  if (type === 'image-annotee') {
    q.annotations = [];
    q.annotationsReserve = 'bas';
  }
  if (type === 'ensembles') {
    q.ensembles = [
      { id: `e-${Date.now()}-0`, titre: '' },
      { id: `e-${Date.now()}-1`, titre: '' },
    ];
    q.ensembleItems = [];
  }
  return q;
}

// Résumé de l'énoncé affiché dans l'entête quand le bloc est replié
function excerpt(html: string): string {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > 70 ? `${text.slice(0, 70)}…` : text;
}

interface LectureQuizBuilderProps {
  value: LectureQuiz | null;
  onChange: (quiz: LectureQuiz) => void;
  disabled?: boolean;
  getAuthHeaders?: () => Promise<Record<string, string> | null>;
  // Habiletés retenues pour l'activité : les questions ne peuvent piocher que
  // là-dedans. null = pas de restriction (toutes celles de l'atelier).
  allowedHabiletes?: string[] | null;
}

export default function LectureQuizBuilder({
  value,
  onChange,
  disabled = false,
  getAuthHeaders,
  allowedHabiletes = null,
}: LectureQuizBuilderProps) {
  const quiz: LectureQuiz = value ?? { mode: 'worksheet', questions: [] };
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [popupImage, setPopupImage] = useState<string | null>(null);
  // Sélecteur d'extrait : quelle question, et lequel de ses deux champs de
  // texte reçoit le passage. `null` = popup fermée.
  const [extraitCible, setExtraitCible] = useState<{
    id: string;
    champ: 'document' | 'fluoTexte';
  } | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<string | null>(null);
  // Où poser le média une fois monté. `null` = l'image (ou l'audio) de la
  // question, comportement historique. Un éditeur de type y met son rappel
  // pour viser un JETON à la place — sans ce détour, il faudrait dupliquer
  // toute la chaîne d'upload (compression, en-têtes, gestion d'erreur).
  const poseMediaRef = useRef<((media: LectureQuestionImage) => void) | null>(null);
  // Audio de question : upload de fichier + enregistrement micro
  const audioInputRef = useRef<HTMLInputElement>(null);
  const audioTargetRef = useRef<string | null>(null);
  const [uploadingAudioId, setUploadingAudioId] = useState<string | null>(null);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  // 32 kb/s : qualité voix compacte — ~3 min sous la limite de 700 Ko
  const {
    isRecording,
    recordingDuration,
    startRecording,
    stopRecording,
    error: recorderError,
  } = useAudioRecorder({ audioBitsPerSecond: 32000 });

  // ── Accordéon : questions dépliées (une nouvelle question replie les autres) ──
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const toggleOpen = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Menu déroulant « Gestes de lecture » ouvert (id de question) ──
  const [gestesOpenId, setGestesOpenId] = useState<string | null>(null);

  const update = (partial: Partial<LectureQuiz>) => onChange({ ...quiz, ...partial });

  const updateQuestion = (id: string, partial: Partial<LectureQuestion>) => {
    update({
      questions: quiz.questions.map((q) => (q.id === id ? { ...q, ...partial } : q)),
    });
  };

  const addQuestion = (type: LectureQuestionType) => {
    const nq = emptyQuestion(type);
    update({ questions: [...quiz.questions, nq] });
    // La nouvelle question se déplie, les autres se replient
    setOpenIds(new Set([nq.id]));
  };

  const removeQuestion = (id: string) => {
    update({ questions: quiz.questions.filter((q) => q.id !== id) });
  };

  // Duplication : la copie se place juste après l'originale et s'ouvre seule.
  // Même geste que dans les constructeurs de recherche et d'auto-évaluation —
  // seul l'identifiant change, sinon les deux blocs seraient la même question.
  const duplicateQuestion = (id: string) => {
    const index = quiz.questions.findIndex((q) => q.id === id);
    if (index === -1) return;
    const copie: LectureQuestion = {
      ...JSON.parse(JSON.stringify(quiz.questions[index])),
      id: generateLectureQuestionId(),
    };
    const next = [...quiz.questions];
    next.splice(index + 1, 0, copie);
    update({ questions: next });
    setOpenIds(new Set([copie.id]));
  };

  const moveQuestion = (from: number, to: number) => {
    if (from === to) return;
    const next = [...quiz.questions];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    update({ questions: next });
  };

  const totalPoints = quiz.questions.reduce((sum, q) => sum + (q.points || 0), 0);

  // ── Image de question ──
  const triggerUpload = (questionId: string) => {
    uploadTargetRef.current = questionId;
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const questionId = uploadTargetRef.current;
    // Destination du média : l'image de la question par défaut, ou un JETON
    // (appariement, remise en ordre, ensembles) quand un éditeur de type a
    // posé son propre rappel avant d'ouvrir le sélecteur de fichier.
    const poser = poseMediaRef.current;
    poseMediaRef.current = null;
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
      // Ne garder que l'Authorization : le navigateur fixe lui-même le
      // Content-Type multipart (avec sa boundary). Envoyer le
      // 'Content-Type: application/json' de getAuthHeaders rend le fichier
      // illisible côté serveur.
      const res = await fetch('/api/ressources/upload', {
        method: 'POST',
        headers: { Authorization: headers.Authorization },
        body: formData,
      });
      const json = await res.json();
      if (json.success && json.data?.files?.[0]) {
        const f = json.data.files[0];
        const media = { url: f.url, fileId: f.fileId };
        if (poser) poser(media);
        else updateQuestion(questionId, { image: media });
      } else {
        setUploadError(json.message || "Erreur lors de l'upload");
      }
    } catch {
      setUploadError("Erreur de connexion pendant l'upload");
    } finally {
      setUploadingId(null);
    }
  };

  // ── Audio de question (upload ou enregistrement micro) ──
  const MAX_AUDIO_BYTES = 700 * 1024; // limite Firestore (~2-3 min en qualité voix)

  const uploadAudioBlob = async (questionId: string, blob: Blob, name: string) => {
    if (!getAuthHeaders) return;
    if (blob.size > MAX_AUDIO_BYTES) {
      const sizeKB = Math.round(blob.size / 1024);
      setUploadError(
        `Audio trop volumineux : ${sizeKB} Ko (max 700 Ko, soit ~2-3 min en qualité voix). Raccourcissez ou compressez le fichier.`
      );
      return;
    }
    setUploadingAudioId(questionId);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('files', blob, name);
      const headers = await getAuthHeaders();
      if (!headers) return;
      // Idem : seule l'Authorization, sinon le fichier est illisible côté serveur
      const res = await fetch('/api/ressources/upload', {
        method: 'POST',
        headers: { Authorization: headers.Authorization },
        body: formData,
      });
      const json = await res.json();
      if (json.success && json.data?.files?.[0]) {
        const f = json.data.files[0];
        // Destination : un JETON si un éditeur de type l'a demandé, sinon
        // l'audio de la question. Même aiguillage que pour les images.
        const poser = poseMediaRef.current;
        poseMediaRef.current = null;
        if (poser) {
          poser({ url: f.url, fileId: f.fileId });
        } else {
          // Remplacement : on conserve la limite d'écoutes déjà réglée
          const prev = quiz.questions.find((q) => q.id === questionId)?.audio;
          updateQuestion(questionId, {
            audio: { url: f.url, fileId: f.fileId, maxEcoutes: prev?.maxEcoutes ?? null },
          });
        }
      } else {
        setUploadError(json.message || "Erreur lors de l'upload");
      }
    } catch {
      setUploadError("Erreur de connexion pendant l'upload");
    } finally {
      setUploadingAudioId(null);
    }
  };

  const handleAudioFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const questionId = audioTargetRef.current;
    if (!file || !questionId) return;
    await uploadAudioBlob(questionId, file, file.name);
  };

  // ── Popup « Joindre un audio » : fichier ou enregistrement micro ──
  const [audioPopupId, setAudioPopupId] = useState<string | null>(null);

  const handlePopupFile = () => {
    if (!audioPopupId) return;
    audioTargetRef.current = audioPopupId;
    setAudioPopupId(null);
    audioInputRef.current?.click();
  };

  const handlePopupRecordToggle = async () => {
    const questionId = audioPopupId;
    if (!questionId) return;
    if (isRecording && recordingId === questionId) {
      const blob = await stopRecording();
      setRecordingId(null);
      if (blob) await uploadAudioBlob(questionId, blob, 'enregistrement.webm');
      setAudioPopupId(null);
    } else if (!isRecording) {
      setRecordingId(questionId);
      await startRecording();
    }
  };

  const closeAudioPopup = async () => {
    // Fermeture pendant un enregistrement : on arrête et on jette la prise
    if (isRecording && recordingId === audioPopupId) {
      await stopRecording();
      setRecordingId(null);
    }
    setAudioPopupId(null);
  };

  const formatDuration = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  /**
   * Fabrique le rappel d'upload passé aux éditeurs de type : ils demandent un
   * média, le constructeur ouvre le sélecteur et pose le résultat où ils
   * l'indiquent (sur un jeton, pas sur la question).
   * Absent si le prof n'est pas authentifié — les boutons ne s'affichent alors
   * pas du tout, plutôt que d'échouer au clic.
   */
  const choisirMediaPour = (questionId: string) => {
    if (!getAuthHeaders) return undefined;
    return (genre: 'image' | 'audio', poser: (media: LectureQuestionImage) => void) => {
      poseMediaRef.current = poser;
      if (genre === 'image') {
        uploadTargetRef.current = questionId;
        fileInputRef.current?.click();
      } else {
        audioTargetRef.current = questionId;
        audioInputRef.current?.click();
      }
    };
  };

  const toggleCompetence = (q: LectureQuestion, comp: string) => {
    const next = q.competences.includes(comp)
      ? q.competences.filter((c) => c !== comp)
      : [...q.competences, comp];
    updateQuestion(q.id, { competences: next });
  };

  // ── Habiletés de lecture : liste dynamique gérée par l'admin (didactique) ──
  const { config: didactique } = useDidactique();

  // Options proposées pour une question : les habiletés de lecture visibles +
  // celles déjà cochées même si masquées ou supprimées depuis (pour les décocher)
  const gesteOptions = (q: LectureQuestion) => {
    const restriction = allowedHabiletes ? new Set(allowedHabiletes) : null;
    const lecture = habiletesOfType(didactique, 'lire').filter(
      (h) => !restriction || restriction.has(h.id) || q.competences.includes(h.id)
    );
    const known = new Set(lecture.map((g) => g.id));
    return [
      ...lecture
        .filter((h) => h.visible || q.competences.includes(h.id))
        .map((h) => ({ id: h.id, label: habileteLabel(h), visible: h.visible })),
      ...q.competences
        .filter((c) => !known.has(c))
        .map((c) => ({
          id: c,
          label: LECTURE_COMPETENCE_LABELS[c as LectureCompetence] ?? c,
          visible: false,
        })),
    ];
  };

  return (
    <div className={styles.builder}>
      {/* Choix worksheet / quiz + total des points */}
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
        <span className={styles.totalPts}>
          Total : {totalPoints} pt{totalPoints > 1 ? 's' : ''}
        </span>
      </div>

      {/* Blocs de questions (accordéon) */}
      <div className={styles.qList}>
        {quiz.questions.map((q, index) => {
          const isOpen = openIds.has(q.id);
          return (
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
            {/* Entête cliquable : replie / déplie le bloc */}
            <div
              className={`${styles.qHead} ${styles.qHeadClickable}`}
              onClick={() => toggleOpen(q.id)}
            >
              <span className={styles.grip} title="Glisser pour réordonner" onClick={(e) => e.stopPropagation()}>⠿</span>
              <span className={styles.chevron}>{isOpen ? '▾' : '▸'}</span>
              {q.type !== 'info' && (
                <span className={styles.qNum}>
                  {`Question ${quiz.questions.slice(0, index).filter((p) => p.type !== 'info').length + 1}`}
                </span>
              )}
              <span className={`${styles.qType} ${styles['type_' + q.type.replace('-', '_')]}`}>
                {TYPE_LABELS[q.type]}
              </span>
              {!isOpen && q.enonce && (
                <span className={styles.qExcerpt}>{excerpt(q.enonce)}</span>
              )}

              <span className={styles.headRight} onClick={(e) => e.stopPropagation()}>
                {/* Gestes de lecture (pas pour les blocs info) */}
                {q.type !== 'info' && (
                  <span className={styles.gestesWrap}>
                    <button
                      type="button"
                      className={`${styles.gestesBtn} ${q.competences.length > 0 ? styles.gestesBtnOn : ''}`}
                      onClick={() => setGestesOpenId(gestesOpenId === q.id ? null : q.id)}
                      disabled={disabled}
                      title="Gestes de lecture exercés — les résultats alimenteront l'onglet Lire du profil de l'élève."
                    >
                      Gestes{q.competences.length > 0 ? ` (${q.competences.length})` : ''} ▾
                    </button>
                    {gestesOpenId === q.id && (
                      <>
                        <span className={styles.gestesBackdrop} onClick={() => setGestesOpenId(null)} />
                        <span className={styles.gestesMenu}>
                          <span className={styles.gestesMenuTitle}>Gestes de lecture</span>
                          {gesteOptions(q).length === 0 && (
                            <span className={styles.gestesEmpty}>
                              Aucun geste défini — à gérer dans Administration du site.
                            </span>
                          )}
                          {gesteOptions(q).map((geste) => (
                            <label key={geste.id} className={styles.gestesItem}>
                              <input
                                type="checkbox"
                                checked={q.competences.includes(geste.id)}
                                onChange={() => toggleCompetence(q, geste.id)}
                                disabled={disabled}
                              />
                              {geste.label}
                            </label>
                          ))}
                        </span>
                      </>
                    )}
                  </span>
                )}

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
                  className={styles.qAction}
                  onClick={() => duplicateQuestion(q.id)}
                  title="Dupliquer ce bloc"
                  disabled={disabled}
                >
                  ⧉
                </button>
                <button
                  type="button"
                  className={styles.qDel}
                  onClick={() => removeQuestion(q.id)}
                  title="Supprimer ce bloc"
                  disabled={disabled}
                >
                  🗑
                </button>
              </span>
            </div>

            {isOpen && (
            <div className={styles.qBody}>
              <div className={styles.qMain}>
                {/* Énoncé + icônes joindre image / audio à sa droite */}
                <div className={styles.enonceRow}>
                  <div className={styles.enonceField}>
                    {q.type === 'info' ? (
                      <InfoEditor
                        content={q.enonce}
                        onChange={(html) => updateQuestion(q.id, { enonce: html })}
                        disabled={disabled}
                        placeholder="Texte d'introduction ou de commentaire, affiché tel quel à l'élève dans le questionnaire..."
                      />
                    ) : (
                      <AutoGrowTextarea
                        className={styles.enonceInput}
                        value={q.enonce}
                        onChange={(e) => updateQuestion(q.id, { enonce: e.target.value })}
                        placeholder="Énoncé de la question..."
                        disabled={disabled}
                      />
                    )}
                  </div>
                  <div className={styles.enonceIcons}>
                    <button
                      type="button"
                      className={`${styles.iconBtn} ${q.image ? styles.iconOn : ''}`}
                      onClick={() => triggerUpload(q.id)}
                      disabled={disabled || uploadingId === q.id}
                      title={
                        q.image
                          ? "Remplacer l'image jointe"
                          : "Joindre une image — vignette + agrandissement, et atelier de tracé pour l'élève."
                      }
                    >
                      {uploadingId === q.id ? '⏳' : '🖼'}
                    </button>
                    <button
                      type="button"
                      className={`${styles.iconBtn} ${q.audio ? styles.iconOn : ''}`}
                      onClick={() => setAudioPopupId(q.id)}
                      disabled={disabled || uploadingAudioId === q.id || isRecording}
                      title={
                        q.audio
                          ? "Remplacer l'audio joint"
                          : "Joindre un audio — fichier MP3, WAV... ou enregistrement au micro (max 700 Ko, ~2-3 min)."
                      }
                    >
                      {uploadingAudioId === q.id ? '⏳' : '🎧'}
                    </button>
                    <button
                      type="button"
                      className={`${styles.iconBtn} ${q.document !== undefined ? styles.iconOn : ''}`}
                      onClick={() =>
                        updateQuestion(q.id, { document: q.document === undefined ? '' : undefined })
                      }
                      disabled={disabled}
                      title={
                        q.document !== undefined
                          ? 'Retirer le texte joint'
                          : "Joindre un texte à la question — un extrait, un document court, une consigne longue."
                      }
                    >
                      📄
                    </button>
                  </div>
                </div>

                {/* Texte joint à la question */}
                {q.document !== undefined && (
                  <div className={styles.docBlock}>
                    <div className={styles.docEntete}>
                      <label className={styles.docLabel}>Texte joint à la question</label>
                      {/* Une œuvre de la bibliothèque tient déjà 67 scènes
                          encodées : les recopier ici, c'est dupliquer un texte
                          qu'on a — et laisser les deux copies diverger. */}
                      <button
                        type="button"
                        className={styles.btnExtrait}
                        onClick={() => setExtraitCible({ id: q.id, champ: 'document' })}
                        disabled={disabled}
                        title="Coller un passage tiré d'une œuvre de votre bibliothèque"
                      >
                        📖 Prendre un extrait dans une œuvre
                      </button>
                    </div>
                    <textarea
                      className={styles.docTextarea}
                      value={q.document}
                      onChange={(e) => updateQuestion(q.id, { document: e.target.value })}
                      placeholder="Texte que l'élève lira sous l'énoncé, avant de répondre…"
                      rows={5}
                      disabled={disabled}
                    />
                  </div>
                )}

                {/* Image jointe : vignette + remplacer / retirer */}
                {q.image && (
                  <div className={styles.mediaRow}>
                    <div className={styles.thumb} onClick={() => setPopupImage(q.image!.url)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={q.image.url} alt="" />
                      <span className={styles.zoomTag}>🔍 agrandir</span>
                    </div>
                    <div className={styles.mediaActions}>
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
                    </div>
                  </div>
                )}

                {/* Audio joint : lecteur + limite d'écoutes + retirer */}
                {q.audio && (
                  <div className={styles.mediaRow}>
                    <audio controls src={q.audio.url} className={styles.audioPlayer} />
                    <label className={styles.audioLimit}>
                      Écoutes autorisées
                      <input
                        type="number"
                        min={1}
                        placeholder="∞"
                        value={q.audio.maxEcoutes ?? ''}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const maxEcoutes =
                            raw === '' ? null : Math.max(1, Math.floor(Number(raw) || 1));
                          updateQuestion(q.id, { audio: { ...q.audio!, maxEcoutes } });
                        }}
                        disabled={disabled}
                      />
                      <span
                        className={styles.info}
                        title="Nombre de fois que l'élève peut lancer l'écoute. Vide = illimité."
                      >
                        i
                      </span>
                    </label>
                    <button
                      type="button"
                      className={styles.imgRemove}
                      onClick={() => updateQuestion(q.id, { audio: null })}
                      disabled={disabled}
                    >
                      ✕ Retirer
                    </button>
                  </div>
                )}

                {/* QCM : choix + bonne(s) réponse(s) */}
                {q.type === 'qcm' && (
                  <div className={styles.choices}>
                    {/* Réponse unique ou multiple — la case change la FORME du
                        contrôle côté élève (ronds → cases à cocher), pas
                        seulement la correction. */}
                    <label className={styles.multipleToggle}>
                      <input
                        type="checkbox"
                        checked={q.multiple === true}
                        onChange={(e) => {
                          const multiple = e.target.checked;
                          updateQuestion(
                            q.id,
                            multiple
                              ? // On reprend la bonne réponse déjà cochée comme
                                // première bonne réponse : le prof ne perd pas
                                // ce qu'il avait saisi en basculant.
                                { multiple: true, correctIndexes: [q.correctIndex ?? 0] }
                              : { multiple: false, correctIndex: q.correctIndexes?.[0] ?? 0 }
                          );
                        }}
                        disabled={disabled}
                      />
                      Plusieurs bonnes réponses
                    </label>

                    {(q.choices ?? []).map((choice, ci) => {
                      const juste = q.multiple
                        ? (q.correctIndexes ?? []).includes(ci)
                        : q.correctIndex === ci;
                      return (
                      <div key={ci} className={`${styles.choice} ${juste ? styles.choiceCorrect : ''}`}>
                        <input
                          type={q.multiple ? 'checkbox' : 'radio'}
                          checked={juste}
                          onChange={() => {
                            if (!q.multiple) return updateQuestion(q.id, { correctIndex: ci });
                            const set = new Set(q.correctIndexes ?? []);
                            if (set.has(ci)) set.delete(ci);
                            else set.add(ci);
                            updateQuestion(q.id, {
                              correctIndexes: [...set].sort((a, b) => a - b),
                            });
                          }}
                          title="Bonne réponse"
                          disabled={disabled}
                        />
                        <input
                          type="text"
                          value={choice}
                          data-champ={`${q.id}-choix-${ci}`}
                          onChange={(e) => {
                            const choices = [...(q.choices ?? [])];
                            choices[ci] = e.target.value;
                            updateQuestion(q.id, { choices });
                          }}
                          // Entrée ajoute le choix suivant et y va : on écrit
                          // ses cinq propositions sans quitter le clavier.
                          onKeyDown={(e) => {
                            if (e.key !== 'Enter') return;
                            e.preventDefault();
                            const suite = insererChoix(q.choices ?? [], ci, {
                              correctIndex: q.correctIndex,
                              correctIndexes: q.correctIndexes,
                            });
                            updateQuestion(q.id, {
                              choices: suite.choix,
                              correctIndex: suite.correctIndex,
                              correctIndexes: suite.correctIndexes,
                            });
                            focaliserChamp(`${q.id}-choix-${ci + 1}`);
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
                              // Supprimer un choix DÉCALE les indices : sans
                              // ce recalcul, le corrigé désignerait la réponse
                              // d'à côté sans que rien ne le signale.
                              if (q.multiple) {
                                const correctIndexes = (q.correctIndexes ?? [])
                                  .filter((i) => i !== ci)
                                  .map((i) => (i > ci ? i - 1 : i));
                                updateQuestion(q.id, {
                                  choices,
                                  correctIndexes: correctIndexes.length ? correctIndexes : [0],
                                });
                                return;
                              }
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
                      );
                    })}
                    <p className={styles.hint}>
                      {q.multiple
                        ? 'Cochez toutes les bonnes réponses. Barème partiel — une coche fausse annule une coche juste, sinon tout cocher rapporterait tout.'
                        : 'Cochez la bonne réponse — elle sera corrigée automatiquement.'}
                    </p>
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

                {/* ── Les types ajoutés le 2026-08-16 ──
                    Leurs éditeurs vivent dans ./TypeEditors.tsx : ce fichier
                    faisait déjà 899 lignes, sept éditeurs de plus l'auraient
                    rendu illisible. Ici on ne fait que les aiguiller. */}
                {q.type === 'matrice' && (
                  <EditeurMatrice
                    q={q}
                    update={(partial) => updateQuestion(q.id, partial)}
                    disabled={disabled}
                  />
                )}
                {q.type === 'appariement' && (
                  <EditeurAppariement
                    q={q}
                    update={(partial) => updateQuestion(q.id, partial)}
                    disabled={disabled}
                    choisirMedia={choisirMediaPour(q.id)}
                  />
                )}
                {q.type === 'ordre' && (
                  <EditeurOrdre
                    q={q}
                    update={(partial) => updateQuestion(q.id, partial)}
                    disabled={disabled}
                    choisirMedia={choisirMediaPour(q.id)}
                  />
                )}
                {q.type === 'image-annotee' && (
                  <EditeurImageAnnotee
                    q={q}
                    update={(partial) => updateQuestion(q.id, partial)}
                    disabled={disabled}
                  />
                )}
                {q.type === 'ensembles' && (
                  <EditeurEnsembles
                    q={q}
                    update={(partial) => updateQuestion(q.id, partial)}
                    disabled={disabled}
                    choisirMedia={choisirMediaPour(q.id)}
                  />
                )}

                {/* Texte long : note éditeur riche */}
                {q.type === 'texte-long' && (
                  <p className={styles.hint}>
                    L&apos;élève répondra dans un éditeur riche (gras, italique, listes...).
                  </p>
                )}

                {/* Souligner du texte : source extrait / ressource */}
                {q.type === 'fluorage' && (
                  <div className={styles.fluoBlock}>
                    <div className={styles.fieldLabel}>
                      Texte à souligner
                      <span
                        className={styles.info}
                        title="Soit un extrait collé dans la question, soit la ressource de l'activité : l'élève souligne alors directement dans l'onglet Ressources, et son soulignage est rattaché à cette question."
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
                      <>
                        <button
                          type="button"
                          className={styles.btnExtrait}
                          onClick={() => setExtraitCible({ id: q.id, champ: 'fluoTexte' })}
                          disabled={disabled}
                          title="Coller un passage tiré d'une œuvre de votre bibliothèque"
                        >
                          📖 Prendre un extrait dans une œuvre
                        </button>
                        <textarea
                          className={styles.fluoTextarea}
                          rows={3}
                          value={q.fluoTexte ?? ''}
                          onChange={(e) =>
                            // Le texte change → les indices de mots bougent :
                            // on remet le soulignage attendu à zéro
                            updateQuestion(q.id, { fluoTexte: e.target.value, fluoAttendu: [] })
                          }
                          placeholder="Collez ici l'extrait que l'élève devra souligner..."
                          disabled={disabled}
                        />
                        {/* Marquage par catégories. Dès qu'il y en a une, il
                            remplace le soulignage à une couleur — et la
                            question devient corrigée automatiquement. */}
                        <EditeurFluoCategories
                          q={q}
                          update={(partial) => updateQuestion(q.id, partial)}
                          disabled={disabled}
                        />

                        {(q.fluoTexte ?? '').trim() && !q.fluoCategories?.length && (
                          <div className={styles.fluoAttenduZone}>
                            <div className={styles.fieldLabel}>
                              Réponse attendue — soulignez les mots
                              <span
                                className={styles.info}
                                title="Cliquez les mots attendus : le soulignage de l'élève sera comparé automatiquement au vôtre (mots justes, manqués, en trop). C'est indicatif — les points restent à votre main. Facultatif."
                              >
                                i
                              </span>
                            </div>
                            <FluoExtrait
                              texte={q.fluoTexte ?? ''}
                              fluoWords={q.fluoAttendu ?? []}
                              onChange={
                                disabled
                                  ? undefined
                                  : (fluoAttendu) => updateQuestion(q.id, { fluoAttendu })
                              }
                            />
                          </div>
                        )}
                      </>
                    ) : (
                      <p className={styles.hint}>
                        L&apos;élève soulignera directement dans le texte de l&apos;onglet Ressources ;
                        son soulignage sera visible dans votre correction.
                      </p>
                    )}
                  </div>
                )}

                {/* Réponse idéale du prof (toutes les questions, pas les blocs
                    info) — repliée, comme « Corrigé & références » dans le
                    constructeur de recherche. Pas de références ici : une
                    question de lecture porte sur un texte fourni, l'élève n'a
                    aucune source à retrouver. */}
                {q.type !== 'info' && (
                  <details className={styles.details}>
                    <summary className={styles.detailsSummary}>Corrigé</summary>
                    <div className={styles.detailsContent}>
                      <label className={styles.detailsLabel}>
                        Votre réponse idéale
                        <span
                          className={styles.info}
                          title="Affichée dans votre page de correction pour comparer avec la réponse de l'élève, puis montrée à l'élève une fois le corrigé disponible."
                        >
                          i
                        </span>
                      </label>
                      <AutoGrowTextarea
                        className={styles.detailsTextarea}
                        value={q.reponseIdeale ?? ''}
                        onChange={(e) => updateQuestion(q.id, { reponseIdeale: e.target.value })}
                        placeholder="Rédigez la réponse attendue (facultatif)..."
                        minRows={2}
                        maxRows={12}
                        disabled={disabled}
                      />

                      {/* ── Réponse courte CORRIGÉE SEULE ──
                          Le prof liste ce qu'il accepte : « le cheval »,
                          « cheval », « chevalin » valent toutes juste. Tant
                          que la liste est vide, la question se corrige à la
                          main — le comportement de tout ce qui a été écrit
                          jusqu'ici ne bouge pas. */}
                      {q.type === 'texte-court' && (
                        <div className={styles.reponsesAcceptees}>
                          <label className={styles.detailsLabel}>
                            Réponses acceptées — correction automatique
                            <span
                              className={styles.info}
                              title="Une réponse par ligne. L'élève est compté juste s'il écrit l'une d'elles. Majuscules, espaces en trop et accents sont ignorés ; l'orthographe et la ponctuation, non. Laissez vide pour corriger vous-même."
                            >
                              i
                            </span>
                          </label>
                          {(q.reponsesAcceptees ?? []).map((r, ri) => (
                            <div key={ri} className={styles.choice}>
                              <span className={styles.choiceLabel}>≡</span>
                              <input
                                type="text"
                                value={r}
                                data-champ={`${q.id}-rep-${ri}`}
                                onChange={(e) => {
                                  const reponsesAcceptees = [...(q.reponsesAcceptees ?? [])];
                                  reponsesAcceptees[ri] = e.target.value;
                                  updateQuestion(q.id, { reponsesAcceptees });
                                }}
                                onKeyDown={(e) => {
                                  if (e.key !== 'Enter') return;
                                  e.preventDefault();
                                  updateQuestion(q.id, {
                                    reponsesAcceptees: insererChoix(q.reponsesAcceptees ?? [], ri)
                                      .choix,
                                  });
                                  focaliserChamp(`${q.id}-rep-${ri + 1}`);
                                }}
                                placeholder="Ex. : le cheval"
                                disabled={disabled}
                              />
                              <button
                                type="button"
                                className={styles.choiceDel}
                                onClick={() =>
                                  updateQuestion(q.id, {
                                    reponsesAcceptees: (q.reponsesAcceptees ?? []).filter(
                                      (_, k) => k !== ri
                                    ),
                                  })
                                }
                                title="Retirer cette formulation"
                                disabled={disabled}
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            className={styles.addChoice}
                            onClick={() => {
                              const liste = [...(q.reponsesAcceptees ?? []), ''];
                              updateQuestion(q.id, { reponsesAcceptees: liste });
                              focaliserChamp(`${q.id}-rep-${liste.length - 1}`);
                            }}
                            disabled={disabled}
                          >
                            + Ajouter une formulation acceptée
                          </button>
                          <p className={styles.hint}>
                            {estAutoCorrigeable(q)
                              ? 'Cette question se corrige toute seule. Vous pourrez toujours reprendre la note à la main.'
                              : 'Aucune formulation : vous corrigerez cette question vous-même.'}
                          </p>
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </div>
            </div>
            )}
          </div>
          );
        })}
      </div>

      {uploadError && <p className={styles.uploadError}>{uploadError}</p>}
      {recorderError && <p className={styles.uploadError}>{recorderError}</p>}

      {/* Ajouter une question */}
      <div className={styles.addRow}>
        <button type="button" className={styles.addQ} onClick={() => addQuestion('qcm')} disabled={disabled}>+ QCM</button>
        <button type="button" className={styles.addQ} onClick={() => addQuestion('texte-court')} disabled={disabled}>+ Texte court</button>
        <button type="button" className={styles.addQ} onClick={() => addQuestion('texte-long')} disabled={disabled}>+ Texte long</button>
        <button type="button" className={styles.addQ} onClick={() => addQuestion('fluorage')} disabled={disabled}>+ Souligner du texte</button>
        <button type="button" className={styles.addQ} onClick={() => addQuestion('matrice')} disabled={disabled}>+ Matrice</button>
        <button type="button" className={styles.addQ} onClick={() => addQuestion('appariement')} disabled={disabled}>+ Appariement</button>
        <button type="button" className={styles.addQ} onClick={() => addQuestion('ordre')} disabled={disabled}>+ Remise en ordre</button>
        <button type="button" className={styles.addQ} onClick={() => addQuestion('image-annotee')} disabled={disabled}>+ Image à annoter</button>
        <button type="button" className={styles.addQ} onClick={() => addQuestion('ensembles')} disabled={disabled}>+ Ensembles</button>
        <button type="button" className={styles.addQ} onClick={() => addQuestion('info')} disabled={disabled}>+ Bloc informatif</button>
      </div>

      {/* Prendre un extrait dans une œuvre de la bibliothèque */}
      {extraitCible && getAuthHeaders && (
        <ExtraitOeuvreModal
          getAuthHeaders={getAuthHeaders}
          onFermer={() => setExtraitCible(null)}
          onInserer={(texte) => {
            const q = quiz.questions.find((x) => x.id === extraitCible.id);
            if (!q) return;
            if (extraitCible.champ === 'document') {
              // On AJOUTE à la suite plutôt que de remplacer : le prof peut
              // vouloir deux tirades de deux scènes, et écraser en silence ce
              // qu'il vient de coller serait une perte.
              const avant = q.document?.trim();
              updateQuestion(q.id, { document: avant ? `${avant}\n\n${texte}` : texte });
            } else {
              // Le soulignage attendu repart de zéro : le texte change, donc
              // les indices de mots ne désignent plus les mêmes mots.
              const avant = q.fluoTexte?.trim();
              updateQuestion(q.id, {
                fluoTexte: avant ? `${avant}\n\n${texte}` : texte,
                fluoAttendu: [],
                fluoAttenduParCategorie: {},
              });
            }
          }}
        />
      )}

      {/* Inputs fichiers cachés (upload image / audio de question) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        style={{ display: 'none' }}
        onChange={handleAudioFileSelected}
      />

      {/* Popup « Joindre un audio » : fichier ou enregistrement micro */}
      {audioPopupId && (
        <div className={styles.popup} onClick={closeAudioPopup}>
          <div
            className={`${styles.popupInner} ${styles.audioPopup}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" className={styles.popupClose} onClick={closeAudioPopup}>
              ✕
            </button>
            <h4 className={styles.audioPopupTitle}>🎧 Audio de la question</h4>
            {isRecording && recordingId === audioPopupId ? (
              <button
                type="button"
                className={`${styles.audioOption} ${styles.recording}`}
                onClick={handlePopupRecordToggle}
              >
                ⏹ Arrêter et joindre ({formatDuration(recordingDuration)})
              </button>
            ) : uploadingAudioId === audioPopupId ? (
              <p className={styles.audioPopupNote}>Envoi en cours...</p>
            ) : (
              <>
                <button type="button" className={styles.audioOption} onClick={handlePopupFile}>
                  📁 Choisir un fichier (MP3, WAV...)
                </button>
                <button
                  type="button"
                  className={styles.audioOption}
                  onClick={handlePopupRecordToggle}
                >
                  🎙 S’enregistrer au micro
                </button>
              </>
            )}
            <p className={styles.audioPopupNote}>
              Max 700 Ko, soit ~2-3 min en qualité voix. Limite d&apos;écoutes réglable ensuite.
            </p>
          </div>
        </div>
      )}

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
