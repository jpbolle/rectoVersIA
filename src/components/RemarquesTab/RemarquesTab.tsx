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
}

export default function RemarquesTab({ correction, studentContent }: RemarquesTabProps) {
  // Les annotations du prof sont toujours visibles dès qu'elles existent
  if (!correction?.annotatedContent) {
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
      <div className={styles.content}>
        <AnnotatedContentViewer
          annotatedContent={correction.annotatedContent}
          audioAnnotations={correction.audioAnnotations}
        />
      </div>
    </div>
  );
}
