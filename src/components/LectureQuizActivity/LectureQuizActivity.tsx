'use client';

// Vue élève du questionnaire de lecture (activités « lire ») :
// mode worksheet (toutes les questions) ou quiz (une à la fois, progression).
// Les réponses sont remontées au parent (auto-save dans travail.content).

import { useState, useCallback, useRef, useEffect, Fragment } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { DrawToolbar, DrawCanvas } from '@/components/DrawTools/DrawTools';
import type { DrawTool, DrawShape } from '@/types/draw';
import type {
  LectureQuiz,
  LectureQuestion,
  LectureQuestionAudio,
  LectureAnswer,
  LectureAnswersState,
} from '@/types/lecture';
import { LECTURE_TYPE_LABELS, partReussite } from '@/types/lecture';
import ChampManipule, { estTypeManipule } from '@/components/QuestionInteractions';
import ConfiancePicker from '@/components/ConfiancePicker';
import styles from './LectureQuizActivity.module.css';

// Libellés : liste unique dans src/types/lecture.ts. Ce fichier, le
// constructeur et la relecture en tenaient chacun une copie — et elles avaient
// déjà divergé (« QCM » ici, « Choix multiple » ailleurs).
const TYPE_LABELS = LECTURE_TYPE_LABELS;

// Numérotation : les blocs informatifs ne comptent pas comme questions
export function questionNumber(quiz: LectureQuiz, q: LectureQuestion): number {
  const index = quiz.questions.indexOf(q);
  return quiz.questions.slice(0, index).filter((p) => p.type !== 'info').length + 1;
}

interface LectureQuizActivityProps {
  quiz: LectureQuiz;
  savedState?: LectureAnswersState | null;
  onStateChange?: (state: LectureAnswersState) => void;
  disabled?: boolean;
  // Soulignage « ressource » : ouvre l'onglet Ressources de la colonne de droite
  onOpenRessources?: () => void;
  // Corrigé disponible : montre les bonnes réponses QCM, la réponse idéale du
  // prof et la comparaison du soulignage (le quiz reçu du serveur est complet)
  showCorrection?: boolean;
  /** Auto-évaluation désactivée sur l'activité : pas de smileys d'assurance */
  autoEvaluation?: boolean;
  // Remise : elle vit au BAS du questionnaire, pas dans la barre du haut. En
  // mode quiz, l'élève ne revient pas en arrière — le bouton n'apparaît donc
  // qu'une fois la dernière question atteinte.
  onSubmit?: () => void;
  isSubmitting?: boolean;
}

export default function LectureQuizActivity({
  quiz,
  savedState,
  onStateChange,
  disabled = false,
  onOpenRessources,
  showCorrection = false,
  autoEvaluation = true,
  onSubmit,
  isSubmitting = false,
}: LectureQuizActivityProps) {
  const [answers, setAnswers] = useState<Record<string, LectureAnswer>>(
    savedState?.answers || {}
  );
  // Réhydratation quand le travail arrive après le premier rendu
  const hydratedRef = useRef(!!savedState);
  useEffect(() => {
    if (!hydratedRef.current && savedState) {
      hydratedRef.current = true;
      setAnswers(savedState.answers || {});
    }
  }, [savedState]);

  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;

  // La fonction passée à setAnswers doit rester PURE : React la rejoue pendant
  // le rendu, et prévenir le parent depuis l'intérieur revenait à le faire
  // changer d'état en plein rendu (« Cannot update a component while rendering
  // a different component »). On tient donc l'état courant dans un ref, et on
  // prévient le parent depuis le gestionnaire d'événement lui-même.
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const updateAnswer = useCallback((questionId: string, partial: Partial<LectureAnswer>) => {
    const prev = answersRef.current;
    const next = { ...prev, [questionId]: { ...prev[questionId], ...partial } };
    answersRef.current = next;
    setAnswers(next);
    onStateChangeRef.current?.({ type: 'lecture', answers: next });
  }, []);

  // Mode quiz : question courante — mais dès que le corrigé est affiché,
  // toutes les questions redeviennent visibles (relecture libre)
  const [quizIndex, setQuizIndex] = useState(0);
  const isQuizMode = quiz.mode === 'quiz' && !showCorrection;
  const visibleQuestions = isQuizMode
    ? quiz.questions.slice(quizIndex, quizIndex + 1)
    : quiz.questions;

  const [popupImage, setPopupImage] = useState<string | null>(null);

  return (
    <div className={styles.activity}>
      {isQuizMode && (
        <div className={styles.progress}>
          <span className={styles.progressCount}>
            {quizIndex + 1} / {quiz.questions.length}
          </span>
          <div className={styles.progressBar}>
            <i style={{ width: `${((quizIndex + 1) / quiz.questions.length) * 100}%` }} />
          </div>
        </div>
      )}

      {visibleQuestions.map((q, i) => (
        <Fragment key={q.id}>
          {/* Worksheet : une astérisque entre deux questions. En mode quiz il
              n'y en a qu'une à l'écran, elle n'aurait rien à séparer. */}
          {!isQuizMode && i > 0 && (
            <div className={styles.separateur} aria-hidden="true">✳</div>
          )}
        <QuestionCard
          question={q}
          number={questionNumber(quiz, q)}
          answer={answers[q.id] || {}}
          onAnswerChange={(partial) => updateAnswer(q.id, partial)}
          disabled={disabled}
          onOpenRessources={onOpenRessources}
          onZoomImage={setPopupImage}
          showCorrection={showCorrection}
          autoEvaluation={autoEvaluation}
        />
        </Fragment>
      ))}

      {/* Mode quiz : avancer seulement, pas de retour en arrière */}
      {isQuizMode && quizIndex < quiz.questions.length - 1 && (
        <div className={styles.quizNav}>
          <button
            type="button"
            className={`${styles.navBtn} ${styles.navBtnPrimary}`}
            onClick={() => setQuizIndex((i) => Math.min(quiz.questions.length - 1, i + 1))}
          >
            Suivant ›
          </button>
        </div>
      )}

      {/* Remise : ligne d'action encadrée de deux traits (forme imposée du
          projet — cf. `bottomActions` de VocabulaireActivity). En mode quiz,
          seulement une fois la dernière question atteinte. */}
      {onSubmit && !disabled && !showCorrection &&
        (!isQuizMode || quizIndex === quiz.questions.length - 1) && (
        <div className={styles.bottomActions}>
          <span className={styles.bottomActionsLine} />
          <div className={styles.bottomActionsRow}>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={onSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Envoi…' : 'Envoyer le questionnaire'}
            </button>
          </div>
          <span className={styles.bottomActionsLine} />
        </div>
      )}

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

// ── Carte d'une question ──

function QuestionCard({
  question,
  number,
  answer,
  onAnswerChange,
  disabled,
  onOpenRessources,
  onZoomImage,
  showCorrection,
  autoEvaluation,
}: {
  question: LectureQuestion;
  number: number;
  answer: LectureAnswer;
  onAnswerChange: (partial: Partial<LectureAnswer>) => void;
  disabled: boolean;
  onOpenRessources?: () => void;
  onZoomImage: (url: string) => void;
  showCorrection: boolean;
  autoEvaluation: boolean;
}) {
  // Bloc informatif : texte du prof, pas de réponse attendue
  if (question.type === 'info') {
    return (
      <div className={`${styles.card} ${styles.cardInfo}`}>
        <div className={styles.cardHead}>
          <span className={styles.infoIcon}>ℹ️</span>
          <span className={styles.typeLabel}>{TYPE_LABELS.info}</span>
        </div>
        {/* Contenu riche (Tiptap) du bloc informatif — HTML rédigé par le prof */}
        <div
          className={`${styles.enonce} ${styles.enonceInfo}`}
          dangerouslySetInnerHTML={{ __html: question.enonce }}
        />
        {question.audio && (
          <QuestionAudio
            audio={question.audio}
            playsUsed={answer.audioPlays ?? 0}
            onConsumePlay={
              disabled
                ? undefined
                : () => onAnswerChange({ audioPlays: (answer.audioPlays ?? 0) + 1 })
            }
          />
        )}
        {question.image && (
          <ImageWorkspace
            imageUrl={question.image.url}
            shapes={[]}
            onZoom={() => onZoomImage(question.image!.url)}
          />
        )}
      </div>
    );
  }

  // Points obtenus : les questions auto-corrigeables se comptent seules, mais
  // SEULEMENT quand le corrigé est là (sinon il a été retiré côté serveur).
  // Tout le reste attend la note du professeur.
  // BARÈME PARTIEL : `partReussite` renvoie une part entre 0 et 1 — 6 items
  // justes sur 8 valent 75 % des points, pas zéro.
  const part = showCorrection ? partReussite(question, answer) : null;
  const ptsObtenus = part === null ? null : Math.round(part * question.points * 10) / 10;
  const ptsInfobulle =
    ptsObtenus !== null
      ? `${ptsObtenus} point${ptsObtenus > 1 ? 's' : ''} sur ${question.points}`
      : 'Corrigé par ton professeur — la note apparaîtra ici';

  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <span className={styles.num}>{number}</span>
        <span className={styles.typeLabel}>{TYPE_LABELS[question.type]}</span>
        {/* Barème en pastille : « … / 3 » — la place de la note est visible
            avant même qu'elle existe.
            Le « … » n'est pas un oubli : tant que le professeur n'a pas ouvert
            le corrigé, le navigateur de l'élève ne reçoit PAS les bonnes
            réponses (`lectureQuizForEleve`). Il ne peut donc rien remplir — et
            c'est voulu : le récapitulatif de l'onglet Évaluation annonce un
            total, jamais quelle question est juste, sinon il livrerait le
            corrigé avant l'heure. Une fois le corrigé rendu, le QCM se remplit. */}
        {question.points > 0 && (
          <span className={styles.pts} title={ptsInfobulle}>
            {ptsObtenus === null ? (
              <span className={styles.ptsVide}>…</span>
            ) : (
              <span>{ptsObtenus}</span>
            )}
            <span>/ {question.points}</span>
            <span className={styles.ptsUnite}>pt{question.points > 1 ? 's' : ''}</span>
          </span>
        )}
      </div>

      <p className={styles.enonce}>{question.enonce}</p>

      {/* Texte joint à la question par le prof (extrait, document court) */}
      {question.document && <div className={styles.questionDoc}>{question.document}</div>}

      {/* Audio de la question (dictée, compréhension orale), écoutes limitées ou non */}
      {question.audio && (
        <QuestionAudio
          audio={question.audio}
          playsUsed={answer.audioPlays ?? 0}
          onConsumePlay={
            disabled
              ? undefined
              : () => onAnswerChange({ audioPlays: (answer.audioPlays ?? 0) + 1 })
          }
        />
      )}

      {/* Image de la question : atelier de tracé complet */}
      {question.image && (
        <ImageWorkspace
          imageUrl={question.image.url}
          shapes={answer.shapes || []}
          onShapesChange={
            disabled
              ? undefined
              : (updater) => onAnswerChange({ shapes: updater(answer.shapes || []) })
          }
          onZoom={() => onZoomImage(question.image!.url)}
        />
      )}

      {question.type === 'qcm' && (
        <div className={`${styles.choices} ${styles.reponseZone}`}>
          {/* Un QCM à réponses multiples le DIT, et le montre : cases à cocher
              au lieu de boutons ronds. La forme du contrôle porte la consigne
              — un élève qui voit des ronds n'essaiera pas d'en cocher deux. */}
          {question.multiple && (
            <p className={styles.hintMultiple}>Plusieurs réponses possibles.</p>
          )}
          {(question.choices ?? []).map((choice, ci) => {
            // Vue corrigée : la bonne réponse en vert, le mauvais choix de
            // l'élève en rouge (le corrigé n'est envoyé qu'avec la correction)
            const revealed =
              showCorrection &&
              (question.multiple ? !!question.correctIndexes : question.correctIndex !== undefined);
            const isStudent = question.multiple
              ? (answer.choiceIndexes ?? []).includes(ci)
              : answer.choiceIndex === ci;
            const isCorrect = question.multiple
              ? (question.correctIndexes ?? []).includes(ci)
              : question.correctIndex === ci;
            const cls = [
              styles.choice,
              revealed && isCorrect ? styles.choiceRight : '',
              revealed && isStudent && !isCorrect ? styles.choiceWrong : '',
            ].join(' ');

            const basculer = () => {
              if (!question.multiple) return onAnswerChange({ choiceIndex: ci });
              const set = new Set(answer.choiceIndexes ?? []);
              if (set.has(ci)) set.delete(ci);
              else set.add(ci);
              onAnswerChange({ choiceIndexes: [...set].sort((a, b) => a - b) });
            };

            return (
              <label key={ci} className={cls}>
                <input
                  type={question.multiple ? 'checkbox' : 'radio'}
                  checked={isStudent}
                  onChange={basculer}
                  disabled={disabled}
                />
                {choice}
                {revealed && isStudent && (
                  <span className={styles.choiceVerdict}>{isCorrect ? '✅' : '❌'}</span>
                )}
                {revealed && !isStudent && isCorrect && (
                  <span className={styles.choiceVerdict}>✔ bonne réponse</span>
                )}
              </label>
            );
          })}
        </div>
      )}

      {/* Les types manipulés (matrice, appariement, remise en ordre, image
          annotée, ensembles) passent tous par le socle partagé : deux moteurs,
          une seule règle d'affichage pour l'élève, la liseuse et le prof. */}
      {estTypeManipule(question.type) && (
        <div className={styles.reponseZone}>
          <ChampManipule
            question={question}
            answer={answer}
            onAnswerChange={onAnswerChange}
            disabled={disabled}
            showCorrection={showCorrection}
          />
        </div>
      )}

      {question.type === 'texte-court' && (
        <textarea
          className={`${styles.shortAnswer} ${styles.reponseZone}`}
          rows={2}
          value={answer.text ?? ''}
          onChange={(e) => onAnswerChange({ text: e.target.value })}
          placeholder="Ta réponse..."
          disabled={disabled}
        />
      )}

      {question.type === 'texte-long' && (
        <div className={styles.reponseZone}>
          <RichAnswerEditor
            value={answer.text ?? ''}
            onChange={(html) => onAnswerChange({ text: html })}
            disabled={disabled}
          />
        </div>
      )}

      {/* Fluorage PAR CATÉGORIES — « le sujet en rouge, les verbes en vert ».
          Il prend la place du soulignage à une couleur dès que le prof a
          défini des catégories ; sans catégorie, le bloc suivant garde le
          comportement historique, et les questionnaires déjà écrits avec lui. */}
      {question.type === 'fluorage' &&
        (question.fluoSource ?? 'extrait') === 'extrait' &&
        !!question.fluoCategories?.length && (
          <div className={styles.reponseZone}>
            <ChampManipule
              question={question}
              answer={answer}
              onAnswerChange={onAnswerChange}
              disabled={disabled}
              showCorrection={showCorrection}
            />
          </div>
        )}

      {question.type === 'fluorage' &&
        (question.fluoSource ?? 'extrait') === 'extrait' &&
        !question.fluoCategories?.length && (
        showCorrection && (question.fluoAttendu?.length ?? 0) > 0 ? (
          // Vue corrigée : comparaison entre le soulignage de l'élève et celui
          // attendu par le prof
          <FluoCompare
            texte={question.fluoTexte ?? ''}
            attendu={question.fluoAttendu ?? []}
            eleve={answer.fluoWords ?? []}
          />
        ) : (
          <>
            <FluoExtrait
              texte={question.fluoTexte ?? ''}
              fluoWords={answer.fluoWords ?? []}
              onChange={(fluoWords) => onAnswerChange({ fluoWords })}
              disabled={disabled}
            />
            {!disabled && (
              <p className={styles.savedNote}>
                🖍 Clique les mots pour les souligner — ta sélection est enregistrée.
              </p>
            )}
          </>
        )
      )}

      {question.type === 'fluorage' && question.fluoSource === 'ressource' && (
        <div className={styles.ressourceFluo}>
          <p>
            Réponds en soulignant directement dans le texte de l&apos;onglet
            «&nbsp;Ressources&nbsp;» (colonne de droite). Ton soulignage sera transmis
            avec ta remise.
          </p>
          {onOpenRessources && (
            <button type="button" className={styles.openRessourcesBtn} onClick={onOpenRessources}>
              📚 Ouvrir la ressource
            </button>
          )}
        </div>
      )}

      {/* Commentaire du soulignage (les deux sources) */}
      {question.type === 'fluorage' && (
        <textarea
          className={`${styles.shortAnswer} ${styles.fluoComment}`}
          rows={2}
          value={answer.text ?? ''}
          onChange={(e) => onAnswerChange({ text: e.target.value })}
          placeholder="Commente ce que tu as souligné (facultatif, selon la question)..."
          disabled={disabled}
        />
      )}

      {/* Degré d'assurance — après la réponse, avant de connaître la note.
          Il disparaît en mode corrigé : se prononcer en voyant le résultat
          n'aurait aucun sens, et le choix déjà posé reste enregistré. */}
      {!showCorrection && autoEvaluation && (
        <ConfiancePicker
          value={answer.confiance}
          onChange={(confiance) => onAnswerChange({ confiance })}
          disabled={disabled}
        />
      )}

      {/* Corrigé disponible : réponse idéale du prof */}
      {showCorrection && question.reponseIdeale && (
        <div className={styles.ideale}>
          <span className={styles.idealeLabel}>🎓 Réponse attendue</span>
          <p className={styles.idealeText}>{question.reponseIdeale}</p>
        </div>
      )}
    </div>
  );
}

// ── Audio de question : lecteur libre ou à écoutes limitées ──
// Sans limite : lecteur natif. Avec limite : lecteur maison sans barre de
// navigation — une écoute est décomptée à chaque démarrage depuis le début
// (pause/reprise = même écoute). Compteur enregistré avec la réponse.

function QuestionAudio({
  audio,
  playsUsed,
  onConsumePlay,
}: {
  audio: LectureQuestionAudio;
  playsUsed: number;
  onConsumePlay?: () => void; // absent = lecture désactivée (travail remis)
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1

  const max = audio.maxEcoutes ?? null;

  // Pas de limite : lecteur natif classique
  if (max === null) {
    return (
      <div className={styles.audioBlock}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio controls src={audio.url} className={styles.audioNative} />
      </div>
    );
  }

  const remaining = Math.max(0, max - playsUsed);

  const handleToggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      return;
    }
    // Démarrage depuis le début = nouvelle écoute décomptée
    const freshStart = el.currentTime === 0;
    if (freshStart) {
      if (!onConsumePlay || remaining <= 0) return;
      onConsumePlay();
    }
    el.play();
  };

  const exhausted = remaining <= 0 && !playing;

  return (
    <div className={styles.audioBlock}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audioRef}
        src={audio.url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          setProgress(el.duration ? el.currentTime / el.duration : 0);
        }}
        onEnded={(e) => {
          e.currentTarget.currentTime = 0;
          setPlaying(false);
          setProgress(0);
        }}
      />
      <button
        type="button"
        className={styles.audioBtn}
        onClick={handleToggle}
        disabled={!playing && (exhausted || !onConsumePlay)}
        title={playing ? 'Pause' : 'Écouter'}
      >
        {playing ? '⏸' : '▶'}
      </button>
      <div className={styles.audioTrack}>
        <i style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <span className={`${styles.audioCount} ${exhausted ? styles.audioCountOff : ''}`}>
        🔊 {remaining} écoute{remaining > 1 ? 's' : ''} restante{remaining > 1 ? 's' : ''} / {max}
      </span>
    </div>
  );
}

// ── Atelier image : toolbar + canvas + zoom ──

function ImageWorkspace({
  imageUrl,
  shapes,
  onShapesChange,
  onZoom,
}: {
  imageUrl: string;
  shapes: DrawShape[];
  onShapesChange?: (updater: (prev: DrawShape[]) => DrawShape[]) => void;
  onZoom: () => void;
}) {
  const [tool, setTool] = useState<DrawTool>('select');
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const readOnly = !onShapesChange;

  return (
    <div className={styles.imgWork}>
      {!readOnly && (
        <DrawToolbar tool={tool} setTool={setTool} hasSelection={selectedShapeId !== null} />
      )}
      <div className={styles.canvasCol}>
        <DrawCanvas
          imageUrl={imageUrl}
          shapes={shapes}
          onShapesChange={onShapesChange}
          tool={tool}
          selectedShapeId={selectedShapeId}
          setSelectedShapeId={setSelectedShapeId}
          readOnly={readOnly}
        />
        <div className={styles.canvasFooter}>
          <button type="button" className={styles.zoomBtn} onClick={onZoom}>🔍 Agrandir</button>
          {!readOnly && (
            <span className={styles.savedNote}>💾 Tracés enregistrés avec ta réponse</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Éditeur riche (Tiptap) pour les réponses longues ──

function RichAnswerEditor({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (html: string) => void;
  disabled: boolean;
}) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: false, link: false })],
    content: value,
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  if (!editor) return null;

  return (
    <div className={styles.tiptap}>
      {!disabled && (
        <div className={styles.tiptapBar}>
          <button
            type="button"
            className={`${styles.ttBtn} ${editor.isActive('bold') ? styles.ttBtnOn : ''}`}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Gras"
          >
            <b>B</b>
          </button>
          <button
            type="button"
            className={`${styles.ttBtn} ${editor.isActive('italic') ? styles.ttBtnOn : ''}`}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italique"
          >
            <i>I</i>
          </button>
          <button
            type="button"
            className={`${styles.ttBtn} ${editor.isActive('bulletList') ? styles.ttBtnOn : ''}`}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Liste à puces"
          >
            •≡
          </button>
          <button
            type="button"
            className={`${styles.ttBtn} ${editor.isActive('orderedList') ? styles.ttBtnOn : ''}`}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Liste numérotée"
          >
            1≡
          </button>
          <button
            type="button"
            className={`${styles.ttBtn} ${editor.isActive('blockquote') ? styles.ttBtnOn : ''}`}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            title="Citation"
          >
            ❝
          </button>
        </div>
      )}
      <EditorContent editor={editor} className={styles.tiptapBody} />
    </div>
  );
}

// ── Comparaison soulignage élève / soulignage attendu du prof ──
// Affichée à l'élève quand le corrigé est disponible, et au prof dans sa page
// de correction. Vert = juste, rouge barré = en trop, pointillé = manqué.

export function FluoCompare({
  texte,
  attendu,
  eleve,
}: {
  texte: string;
  attendu: number[];
  eleve: number[];
}) {
  const words = texte.split(/\s+/).filter(Boolean);
  const attenduSet = new Set(attendu);
  const eleveSet = new Set(eleve);

  const hits = attendu.filter((i) => eleveSet.has(i)).length;
  const extra = eleve.filter((i) => !attenduSet.has(i)).length;

  return (
    <div>
      <p className={styles.fluoText}>
        {words.map((word, i) => {
          const isAttendu = attenduSet.has(i);
          const isEleve = eleveSet.has(i);
          const cls = [
            styles.fluoWord,
            styles.fluoWordStatic,
            isAttendu && isEleve ? styles.fluoHit : '',
            !isAttendu && isEleve ? styles.fluoExtra : '',
            isAttendu && !isEleve ? styles.fluoMiss : '',
          ].join(' ');
          return (
            <span key={i}>
              <span className={cls}>{word}</span>{' '}
            </span>
          );
        })}
      </p>
      <p className={styles.fluoLegend}>
        <span className={styles.fluoHit}>juste</span> · <span className={styles.fluoExtra}>en trop</span> ·{' '}
        <span className={styles.fluoMiss}>manqué</span> — {hits}/{attendu.length} mot
        {attendu.length > 1 ? 's' : ''} attendu{attendu.length > 1 ? 's' : ''} trouvé
        {hits > 1 ? 's' : ''}
        {extra > 0 ? `, ${extra} en trop` : ''}
      </p>
    </div>
  );
}

// ── Soulignage d'un extrait : clic sur les mots ──

export function FluoExtrait({
  texte,
  fluoWords,
  onChange,
  disabled,
}: {
  texte: string;
  fluoWords: number[];
  onChange?: (fluoWords: number[]) => void;
  disabled?: boolean;
}) {
  const words = texte.split(/\s+/).filter(Boolean);
  const set = new Set(fluoWords);

  const toggle = (index: number) => {
    if (disabled || !onChange) return;
    const next = new Set(set);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    onChange([...next].sort((a, b) => a - b));
  };

  return (
    <p className={styles.fluoText}>
      {words.map((word, i) => (
        <span key={i}>
          <span
            className={`${styles.fluoWord} ${set.has(i) ? styles.fluoWordOn : ''} ${disabled || !onChange ? styles.fluoWordStatic : ''}`}
            onClick={() => toggle(i)}
          >
            {word}
          </span>{' '}
        </span>
      ))}
    </p>
  );
}
