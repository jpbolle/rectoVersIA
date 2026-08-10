'use client';

import dynamic from 'next/dynamic';
import type { Correction } from '@/types/correction';
import styles from './RemarquesTab.module.css';

const AnnotatedContentViewer = dynamic(
  () => import('@/components/AnnotatedContentViewer'),
  { ssr: false }
);

interface RemarquesTabProps {
  correction: Correction | null;
  studentContent: string;
  // Production de référence du prof (corrigeReference.production du devoir) —
  // affichée après les remarques quand la correction est disponible
  profProduction?: string;
}

export default function RemarquesTab({ correction, studentContent, profProduction }: RemarquesTabProps) {
  void studentContent;
  const hasAnnotations = !!correction?.annotatedContent;
  // La production du prof n'apparaît qu'avec une correction visible
  const production = correction ? profProduction?.trim() : undefined;

  // Les annotations du prof sont toujours visibles dès qu'elles existent
  if (!hasAnnotations && !production) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon}>📝</span>
        <p className={styles.emptyText}>
          Le professeur n&apos;a pas encore annoté votre travail.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {hasAnnotations && (
        <>
          <div className={styles.header}>
            <div className={styles.legendRow}>
              <p className={styles.subtitle}>Légende</p>
              <div className={styles.legendItems}>
                <div className={styles.legendItem}>
                  <span className={styles.legendBtnSpelling}>Orth</span>
                  <span className={styles.legendText}>Orthographe</span>
                </div>
                <div className={styles.legendItem}>
                  <span className={styles.legendBtnSyntax}>Synt</span>
                  <span className={styles.legendText}>Syntaxe</span>
                </div>
                <div className={styles.legendItem}>
                  <span className={styles.legendBtnPonctu}>Ponct</span>
                  <span className={styles.legendText}>Ponctuation</span>
                </div>
                <div className={styles.legendItem}>
                  <span className={styles.legendBtnLexical}>Lex</span>
                  <span className={styles.legendText}>Lexique</span>
                </div>
                <div className={styles.legendItem}>
                  <span className={styles.legendBtnVoice}>💬</span>
                  <span className={styles.legendText}>Commentaire vocal</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <div className={styles.content}>
        {hasAnnotations && (
          <AnnotatedContentViewer
            annotatedContent={correction!.annotatedContent!}
            audioAnnotations={correction!.audioAnnotations}
          />
        )}
        {production && (
          <div className={styles.profProduction}>
            <h4 className={styles.profProductionTitle}>✒️ La proposition du professeur</h4>
            <p className={styles.profProductionText}>{production}</p>
          </div>
        )}
      </div>
    </div>
  );
}
