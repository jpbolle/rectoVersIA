'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import DictionaryPanel from '@/components/DictionaryPanel';
import { DrawToolbar, DrawCanvas } from '@/components/DrawTools/DrawTools';
import type { DrawTool, DrawShape } from '@/types/draw';
import type { Devoir } from '@/types/devoir';
import styles from './RessourcesTab.module.css';

const RessourceEditor = dynamic(
  () => import('@/components/RessourceEditor/RessourceEditor'),
  { ssr: false }
);

interface RessourcesTabProps {
  devoir: Devoir;
  ressourceAnnotations?: string;
  onRessourceAnnotationsChange?: (html: string) => void;
  ressourceNotes?: Record<string, string>;
  onRessourceNotesChange?: (notes: Record<string, string>) => void;
  /** Tracés de l'élève sur les images de ressources (clé = fileId) */
  ressourceImageShapes?: Record<string, DrawShape[]>;
  onRessourceImageShapesChange?: (shapes: Record<string, DrawShape[]>) => void;
  /** Annotations de l'élève (lecture seule pour le prof) */
  studentRessourceAnnotations?: string;
  studentRessourceNotes?: Record<string, string>;
  studentRessourceImageShapes?: Record<string, DrawShape[]>;
  /** Aide dictionnaire permanente (élève) — bloc affiché si le callback est fourni */
  dictionaryEnabled?: boolean;
  onDictionaryEnabledChange?: (value: boolean) => void;
}

// ── Image de ressource : atelier de tracé (élève) ou tracés en lecture seule (prof) ──
function RessourceImageWorkspace({
  url,
  name,
  shapes,
  onShapesChange,
}: {
  url: string;
  name: string;
  shapes: DrawShape[];
  onShapesChange?: (updater: (prev: DrawShape[]) => DrawShape[]) => void;
}) {
  const [tool, setTool] = useState<DrawTool>('select');
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const readOnly = !onShapesChange;

  return (
    <figure className={styles.imageFigure}>
      {!readOnly && (
        <DrawToolbar
          tool={tool}
          setTool={setTool}
          hasSelection={selectedShapeId !== null}
          direction="horizontal"
        />
      )}
      <DrawCanvas
        imageUrl={url}
        alt={name}
        shapes={shapes}
        onShapesChange={onShapesChange}
        tool={tool}
        selectedShapeId={selectedShapeId}
        setSelectedShapeId={setSelectedShapeId}
        readOnly={readOnly}
      />
      <figcaption className={styles.imageCaption}>
        <button type="button" className={styles.imageZoomBtn} onClick={() => setZoomed(true)}>
          🔍
        </button>
        {name}
        {readOnly && shapes.length > 0 && (
          <span className={styles.imageShapesTag}>
            ✏️ {shapes.length} tracé{shapes.length > 1 ? 's' : ''} de l&apos;élève
          </span>
        )}
      </figcaption>
      {zoomed && (
        <div className={styles.imagePopup} onClick={() => setZoomed(false)}>
          <div className={styles.imagePopupInner} onClick={(e) => e.stopPropagation()}>
            <button type="button" className={styles.imagePopupClose} onClick={() => setZoomed(false)}>✕</button>
            <DrawCanvas
              imageUrl={url}
              alt={name}
              shapes={shapes}
              tool="select"
              selectedShapeId={null}
              setSelectedShapeId={() => {}}
              readOnly
            />
          </div>
        </div>
      )}
    </figure>
  );
}

// Fonction pour transformer les URLs en liens cliquables
function linkifyText(text: string): React.ReactNode[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      // Reset lastIndex car le regex est global
      urlRegex.lastIndex = 0;
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.link}
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

// Convertit le texte brut en paragraphes HTML pour Tiptap
function textToHtml(text: string): string {
  return text
    .split('\n')
    .map(line => `<p>${line || '<br>'}</p>`)
    .join('');
}

// ── Sous-composant : vue lecture seule des annotations avec notes alignées ──
function AnnotatedReadOnly({
  html,
  notes,
}: {
  html: string;
  notes: Record<string, string>;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const [paraPositions, setParaPositions] = useState<Array<{ top: number; height: number }>>([]);

  const measure = useCallback(() => {
    const contentEl = contentRef.current;
    const gutterEl = gutterRef.current;
    if (!contentEl || !gutterEl) return;

    const paras = contentEl.querySelectorAll(':scope > p');
    const gutterRect = gutterEl.getBoundingClientRect();

    const positions = Array.from(paras).map(p => {
      const rect = p.getBoundingClientRect();
      return {
        top: rect.top - gutterRect.top,
        height: rect.height,
      };
    });

    setParaPositions(positions);
  }, []);

  useEffect(() => {
    // Mesurer après le premier rendu
    requestAnimationFrame(() => requestAnimationFrame(measure));

    // Re-mesurer si la fenêtre change
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  const hasNotes = Object.keys(notes).length > 0;

  return (
    <div className={styles.annotatedLayout}>
      {hasNotes && (
        <div className={styles.notesColumn} ref={gutterRef}>
          {paraPositions.map((pos, index) => {
            const noteText = notes[String(index)];
            if (!noteText) return null;
            return (
              <div
                key={index}
                className={styles.noteSlot}
                style={{ top: pos.top, minHeight: pos.height }}
              >
                <div className={styles.noteDisplay}>
                  <span className={styles.noteDisplayText}>{noteText}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div
        ref={contentRef}
        className={styles.annotatedContent}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

export default function RessourcesTab({
  devoir,
  ressourceAnnotations,
  onRessourceAnnotationsChange,
  ressourceNotes,
  onRessourceNotesChange,
  ressourceImageShapes,
  onRessourceImageShapesChange,
  studentRessourceAnnotations,
  studentRessourceNotes,
  studentRessourceImageShapes,
  dictionaryEnabled = false,
  onDictionaryEnabledChange,
}: RessourcesTabProps) {
  // Aide permanente : bloc dictionnaire au-dessus des ressources du prof
  const dictionaryBlock = onDictionaryEnabledChange ? (
    <DictionaryPanel enabled={dictionaryEnabled} onEnabledChange={onDictionaryEnabledChange} />
  ) : null;

  if (!devoir.ressources) {
    return (
      <div className={styles.container}>
        {dictionaryBlock}
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>📚</span>
          <p className={styles.emptyText}>Aucune ressource fournie pour ce devoir.</p>
        </div>
      </div>
    );
  }

  // Determine content from new or legacy structure
  const outilsContent = devoir.ressources.outils ?? '';
  const documentContent = devoir.ressources.document ?? '';
  const legacyContent = devoir.ressources.content ?? '';
  const ressourceFiles = devoir.ressources.files ?? [];
  const hasOutils = outilsContent.trim().length > 0;
  const hasDocument = documentContent.trim().length > 0 && documentContent !== '<p></p>';
  const hasLegacy = !hasOutils && !hasDocument && legacyContent.trim().length > 0;
  const hasFiles = ressourceFiles.length > 0;

  // Images déposées par le prof — atelier de tracé pour l'élève (comme le
  // fluorage/annotation pour un texte) ; le prof voit les tracés en lecture seule
  const shapesSource = onRessourceImageShapesChange
    ? ressourceImageShapes
    : studentRessourceImageShapes;
  const filesBlock = hasFiles ? (
    <div className={styles.filesSection}>
      <h4 className={styles.filesTitle}>🖼️ Images</h4>
      {onRessourceImageShapesChange && (
        <p className={styles.filesHint}>
          Utilise les outils pour analyser l&apos;image — tes tracés sont enregistrés
          et visibles par ton professeur.
        </p>
      )}
      <div className={styles.filesList}>
        {ressourceFiles.map((file, index) => {
          const key = file.fileId || String(index);
          return (
            <RessourceImageWorkspace
              key={key}
              url={file.url}
              name={file.name}
              shapes={shapesSource?.[key] ?? []}
              onShapesChange={
                onRessourceImageShapesChange
                  ? (updater) =>
                      onRessourceImageShapesChange({
                        ...(ressourceImageShapes ?? {}),
                        [key]: updater(ressourceImageShapes?.[key] ?? []),
                      })
                  : undefined
              }
            />
          );
        })}
      </div>
    </div>
  ) : null;

  if (!hasOutils && !hasDocument && !hasLegacy && !hasFiles) {
    return (
      <div className={styles.container}>
        {dictionaryBlock}
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>📚</span>
          <p className={styles.emptyText}>Aucune ressource fournie pour ce devoir.</p>
        </div>
      </div>
    );
  }

  // Mode eleve interactif with annotation editor: use legacy or document content
  if (onRessourceAnnotationsChange) {
    const textForEditor = hasDocument ? documentContent : legacyContent;
    const initialContent = ressourceAnnotations || (hasDocument ? textForEditor : textToHtml(textForEditor));

    return (
      <div className={styles.container}>
        {dictionaryBlock}
        {filesBlock}
        {/* Outils section (read-only links) above editor */}
        {hasOutils && (
          <div className={styles.outilsSection}>
            <h4 className={styles.outilsTitle}>🔧 Outils</h4>
            <div className={styles.outilsText} dangerouslySetInnerHTML={{ __html: outilsContent }} />
          </div>
        )}
        {(hasDocument || hasLegacy) && (
          <RessourceEditor
            initialContent={initialContent}
            onChange={onRessourceAnnotationsChange}
            initialNotes={ressourceNotes || {}}
            onNotesChange={onRessourceNotesChange!}
          />
        )}
      </div>
    );
  }

  // Mode lecture seule (prof preview)
  // Si le prof a les annotations de l'eleve, les afficher
  const hasStudentAnnotations = studentRessourceAnnotations && studentRessourceAnnotations.trim().length > 0;
  const hasStudentNotes = studentRessourceNotes && Object.keys(studentRessourceNotes).length > 0;

  return (
    <div className={styles.container}>
      {dictionaryBlock}
      {filesBlock}
      {hasOutils && (
        <div className={styles.outilsSection}>
          <h4 className={styles.outilsTitle}>🔧 Outils</h4>
          <div className={styles.outilsText} dangerouslySetInnerHTML={{ __html: outilsContent }} />
        </div>
      )}
      {(hasStudentAnnotations || hasStudentNotes) ? (
        <div className={styles.annotatedSection}>
          <h4 className={styles.annotatedTitle}>📄 Document — annotations de l&apos;élève</h4>
          <AnnotatedReadOnly
            html={studentRessourceAnnotations || documentContent}
            notes={studentRessourceNotes || {}}
          />
        </div>
      ) : (
        <>
          {hasDocument && (
            <div className={styles.documentSection}>
              <h4 className={styles.documentTitle}>📄 Document</h4>
              <div
                className={styles.documentContent}
                dangerouslySetInnerHTML={{ __html: documentContent }}
              />
            </div>
          )}
        </>
      )}
      {hasLegacy && !hasStudentAnnotations && (
        <div className={styles.textContent}>
          <p className={styles.text}>{linkifyText(legacyContent)}</p>
        </div>
      )}
    </div>
  );
}
