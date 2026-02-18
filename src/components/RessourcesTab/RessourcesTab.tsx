'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
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
  /** Annotations de l'élève (lecture seule pour le prof) */
  studentRessourceAnnotations?: string;
  studentRessourceNotes?: Record<string, string>;
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
  studentRessourceAnnotations,
  studentRessourceNotes,
}: RessourcesTabProps) {
  if (!devoir.ressources) {
    return (
      <div className={styles.container}>
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
  const hasOutils = outilsContent.trim().length > 0;
  const hasDocument = documentContent.trim().length > 0 && documentContent !== '<p></p>';
  const hasLegacy = !hasOutils && !hasDocument && legacyContent.trim().length > 0;

  if (!hasOutils && !hasDocument && !hasLegacy) {
    return (
      <div className={styles.container}>
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
        {/* Outils section (read-only links) above editor */}
        {hasOutils && (
          <div className={styles.outilsSection}>
            <h4 className={styles.outilsTitle}>🔧 Outils</h4>
            <div className={styles.outilsText} dangerouslySetInnerHTML={{ __html: outilsContent }} />
          </div>
        )}
        <RessourceEditor
          initialContent={initialContent}
          onChange={onRessourceAnnotationsChange}
          initialNotes={ressourceNotes || {}}
          onNotesChange={onRessourceNotesChange!}
        />
      </div>
    );
  }

  // Mode lecture seule (prof preview)
  // Si le prof a les annotations de l'eleve, les afficher
  const hasStudentAnnotations = studentRessourceAnnotations && studentRessourceAnnotations.trim().length > 0;
  const hasStudentNotes = studentRessourceNotes && Object.keys(studentRessourceNotes).length > 0;

  return (
    <div className={styles.container}>
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
