'use client';

// Vue élève du questionnaire de lecture (activités « lire ») :
// mode worksheet (toutes les questions) ou quiz (une à la fois, progression).
// Les réponses sont remontées au parent (auto-save dans travail.content).

import { useState, useCallback, useRef, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { DrawToolbar, DrawCanvas } from '@/components/DrawTools/DrawTools';
import type { DrawTool, DrawShape } from '@/types/draw';
import type { LectureQuiz, LectureQuestion, LectureAnswer, LectureAnswersState } from '@/types/lecture';
import styles from './LectureQuizActivity.module.css';

const TYPE_LABELS: Record<LectureQuestion['type'], string> = {
  qcm: 'QCM',
  'texte-court': 'Réponse courte',
  'texte-long': 'Réponse longue',
  fluorage: 'Fluorage de texte',
  info: 'Information',
};

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
  // Fluorage « ressource » : ouvre l'onglet Ressources de la colonne de droite
  onOpenRessources?: () => void;
}

export default function LectureQuizActivity({
  quiz,
  savedState,
  onStateChange,
  disabled = false,
  onOpenRessources,
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

  const updateAnswer = useCallback((questionId: string, partial: Partial<LectureAnswer>) => {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: { ...prev[questionId], ...partial } };
      onStateChangeRef.current?.({ type: 'lecture', answers: next });
      return next;
    });
  }, []);

  const totalPoints = quiz.questions.reduce((sum, q) => sum + (q.points || 0), 0);
  const questionCount = quiz.questions.filter((q) => q.type !== 'info').length;

  // Mode quiz : question courante
  const [quizIndex, setQuizIndex] = useState(0);
  const isQuizMode = quiz.mode === 'quiz';
  const visibleQuestions = isQuizMode
    ? quiz.questions.slice(quizIndex, quizIndex + 1)
    : quiz.questions;

  const [popupImage, setPopupImage] = useState<string | null>(null);

  return (
    <div className={styles.activity}>
      <p className={styles.meta}>
        {questionCount} question{questionCount > 1 ? 's' : ''}
        {totalPoints > 0 && <> · {totalPoints} point{totalPoints > 1 ? 's' : ''}</>}
      </p>

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

      {visibleQuestions.map((q) => (
        <QuestionCard
          key={q.id}
          question={q}
          number={questionNumber(quiz, q)}
          answer={answers[q.id] || {}}
          onAnswerChange={(partial) => updateAnswer(q.id, partial)}
          disabled={disabled}
          onOpenRessources={onOpenRessources}
          onZoomImage={setPopupImage}
        />
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
}: {
  question: LectureQuestion;
  number: number;
  answer: LectureAnswer;
  onAnswerChange: (partial: Partial<LectureAnswer>) => void;
  disabled: boolean;
  onOpenRessources?: () => void;
  onZoomImage: (url: string) => void;
}) {
  // Bloc informatif : texte du prof, pas de réponse attendue
  if (question.type === 'info') {
    return (
      <div className={`${styles.card} ${styles.cardInfo}`}>
        <div className={styles.cardHead}>
          <span className={styles.infoIcon}>ℹ️</span>
          <span className={styles.typeLabel}>{TYPE_LABELS.info}</span>
        </div>
        <p className={`${styles.enonce} ${styles.enonceInfo}`}>{question.enonce}</p>
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

  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <span className={styles.num}>{number}</span>
        <span className={styles.typeLabel}>{TYPE_LABELS[question.type]}</span>
        {question.points > 0 && (
          <span className={styles.pts}>{question.points} pt{question.points > 1 ? 's' : ''}</span>
        )}
      </div>

      <p className={styles.enonce}>{question.enonce}</p>

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
        <div className={styles.choices}>
          {(question.choices ?? []).map((choice, ci) => (
            <label key={ci} className={styles.choice}>
              <input
                type="radio"
                checked={answer.choiceIndex === ci}
                onChange={() => onAnswerChange({ choiceIndex: ci })}
                disabled={disabled}
              />
              {choice}
            </label>
          ))}
        </div>
      )}

      {question.type === 'texte-court' && (
        <textarea
          className={styles.shortAnswer}
          rows={2}
          value={answer.text ?? ''}
          onChange={(e) => onAnswerChange({ text: e.target.value })}
          placeholder="Ta réponse..."
          disabled={disabled}
        />
      )}

      {question.type === 'texte-long' && (
        <RichAnswerEditor
          value={answer.text ?? ''}
          onChange={(html) => onAnswerChange({ text: html })}
          disabled={disabled}
        />
      )}

      {question.type === 'fluorage' && (question.fluoSource ?? 'extrait') === 'extrait' && (
        <>
          <FluoExtrait
            texte={question.fluoTexte ?? ''}
            fluoWords={answer.fluoWords ?? []}
            onChange={(fluoWords) => onAnswerChange({ fluoWords })}
            disabled={disabled}
          />
          <p className={styles.savedNote}>🖍 Clique les mots pour les fluorer — ton fluorage est enregistré.</p>
        </>
      )}

      {question.type === 'fluorage' && question.fluoSource === 'ressource' && (
        <div className={styles.ressourceFluo}>
          <p>
            Réponds en fluorant directement dans le texte de l&apos;onglet
            «&nbsp;Ressources&nbsp;» (colonne de droite). Ton surlignage sera transmis
            avec ta remise.
          </p>
          {onOpenRessources && (
            <button type="button" className={styles.openRessourcesBtn} onClick={onOpenRessources}>
              📚 Ouvrir la ressource
            </button>
          )}
        </div>
      )}

      {/* Commentaire du fluorage (les deux sources) */}
      {question.type === 'fluorage' && (
        <textarea
          className={`${styles.shortAnswer} ${styles.fluoComment}`}
          rows={2}
          value={answer.text ?? ''}
          onChange={(e) => onAnswerChange({ text: e.target.value })}
          placeholder="Commente ce que tu as fluoré (facultatif, selon la question)..."
          disabled={disabled}
        />
      )}
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

// ── Fluorage d'un extrait : clic sur les mots ──

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
