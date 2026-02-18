'use client';

import { useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { DevoirRessource } from '@/types/devoir';
import styles from './RessourcesInput.module.css';

interface EditorProps {
  content: string;
  onChange: (html: string) => void;
  disabled?: boolean;
}

const OutilsEditor = dynamic<EditorProps>(
  () => import('./OutilsEditor'),
  { ssr: false, loading: () => <div className={styles.editorLoading}>Chargement...</div> }
);

const DocumentEditor = dynamic<EditorProps>(
  () => import('./DocumentEditor'),
  { ssr: false, loading: () => <div className={styles.editorLoading}>Chargement...</div> }
);

interface RessourcesInputProps {
  ressources: DevoirRessource | null;
  onRessourcesChange: (ressources: DevoirRessource | null) => void;
  disabled?: boolean;
}

function isEmptyHtml(html: string): boolean {
  return !html || html === '<p></p>' || html === '<p><br></p>';
}

export default function RessourcesInput({
  ressources,
  onRessourcesChange,
  disabled = false,
}: RessourcesInputProps) {
  const outilsValue = ressources?.outils ?? ressources?.content ?? '';
  const documentValue = ressources?.document ?? '';

  const handleOutilsChange = useCallback(
    (html: string) => {
      const doc = ressources?.document ?? '';
      const outilsEmpty = isEmptyHtml(html);

      if (outilsEmpty && isEmptyHtml(doc)) {
        onRessourcesChange(null);
      } else {
        onRessourcesChange({
          type: 'text',
          content: outilsEmpty ? '' : html,
          outils: outilsEmpty ? '' : html,
          document: doc,
        });
      }
    },
    [onRessourcesChange, ressources?.document]
  );

  const handleDocumentChange = useCallback(
    (html: string) => {
      const outils = ressources?.outils ?? ressources?.content ?? '';
      const docEmpty = isEmptyHtml(html);

      if (isEmptyHtml(outils) && docEmpty) {
        onRessourcesChange(null);
      } else {
        onRessourcesChange({
          type: 'text',
          content: outils,
          outils,
          document: docEmpty ? '' : html,
        });
      }
    },
    [onRessourcesChange, ressources?.outils, ressources?.content]
  );

  return (
    <div className={styles.container}>
      {/* ── Encadré Outils ── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionIcon}>🔧</span>
          <h4 className={styles.sectionTitle}>Outils</h4>
        </div>
        <OutilsEditor
          content={outilsValue}
          onChange={handleOutilsChange}
          disabled={disabled}
        />
      </div>

      {/* ── Encadré Document ── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionIcon}>📄</span>
          <h4 className={styles.sectionTitle}>Document</h4>
        </div>
        <p className={styles.sectionHint}>
          Rédigez un document mis en forme à destination des élèves.
        </p>
        <DocumentEditor
          content={documentValue}
          onChange={handleDocumentChange}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
