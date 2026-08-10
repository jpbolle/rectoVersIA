'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/hooks/useAuth';
import { compressImage } from '@/lib/image-compress';
import type { DevoirRessource, RessourceFile } from '@/types/devoir';
import styles from './RessourcesInput.module.css';

interface EditorProps {
  content: string;
  onChange: (html: string) => void;
  disabled?: boolean;
}

const DocumentEditor = dynamic<EditorProps>(
  () => import('./DocumentEditor'),
  { ssr: false, loading: () => <div className={styles.editorLoading}>Chargement...</div> }
);

type RessourceTab = 'fichier' | 'lien' | 'texte';

const ACCEPTED_EXTENSIONS = '.jpg,.jpeg,.png,.gif,.webp';

interface RessourcesInputProps {
  ressources: DevoirRessource | null;
  onRessourcesChange: (ressources: DevoirRessource | null) => void;
  disabled?: boolean;
}

// Vide si aucun texte réel (une liste à puces vide ou un paragraphe vide comptent comme vides)
function isEmptyHtml(html: string): boolean {
  if (!html) return true;
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim() === '';
}

// ── Conversion du champ Lien (une URL par ligne) ↔ HTML stocké ──

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// HTML stocké (liste ou paragraphes) → une ligne par entrée pour le textarea
function htmlToLines(html: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(li|p)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');
}

// Lignes du textarea → liste à puces HTML, chaque URL devient un lien cliquable
function linesToHtml(text: string): string {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return '';
  const items = lines.map((line) => {
    const isUrl = /^https?:\/\//i.test(line) || /^www\./i.test(line);
    if (isUrl) {
      const href = /^https?:\/\//i.test(line) ? line : `https://${line}`;
      return `<li><a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" class="editor-link">${escapeHtml(line)}</a></li>`;
    }
    return `<li>${escapeHtml(line)}</li>`;
  });
  return `<ul>${items.join('')}</ul>`;
}

// Reconstruit l'objet ressources — null si les trois onglets sont vides
function buildRessource(
  outils: string,
  document: string,
  files: RessourceFile[],
): DevoirRessource | null {
  const outilsEmpty = isEmptyHtml(outils);
  const docEmpty = isEmptyHtml(document);
  if (outilsEmpty && docEmpty && files.length === 0) return null;
  return {
    type: 'text',
    content: outilsEmpty ? '' : outils,
    outils: outilsEmpty ? '' : outils,
    document: docEmpty ? '' : document,
    files,
  };
}

export default function RessourcesInput({
  ressources,
  onRessourcesChange,
  disabled = false,
}: RessourcesInputProps) {
  const { getAuthHeaders } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<RessourceTab>('fichier');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  // Image affichée en grand dans la popup (null = fermée)
  const [previewFile, setPreviewFile] = useState<RessourceFile | null>(null);

  const outilsValue = ressources?.outils ?? ressources?.content ?? '';
  const documentValue = ressources?.document ?? '';
  const filesValue = ressources?.files ?? [];

  const hasFichier = filesValue.length > 0;
  const hasLien = !isEmptyHtml(outilsValue);
  const hasTexte = !isEmptyHtml(documentValue);

  // Champ Lien : texte brut du textarea (une URL par ligne), resynchronisé
  // quand la valeur externe change (réinitialisation, ouverture du modal)
  const [lienText, setLienText] = useState(() => htmlToLines(outilsValue));
  const lienTextRef = useRef(lienText);
  lienTextRef.current = lienText;

  useEffect(() => {
    const external = htmlToLines(outilsValue);
    const localNormalized = htmlToLines(linesToHtml(lienTextRef.current));
    if (external !== localNormalized) {
      setLienText(external);
    }
  }, [outilsValue]);

  const handleLienChange = useCallback(
    (text: string) => {
      setLienText(text);
      onRessourcesChange(buildRessource(linesToHtml(text), documentValue, filesValue));
    },
    [onRessourcesChange, documentValue, filesValue]
  );

  const handleDocumentChange = useCallback(
    (html: string) => {
      onRessourcesChange(buildRessource(outilsValue, html, filesValue));
    },
    [onRessourcesChange, outilsValue, filesValue]
  );

  // ── Upload d'images (compressées dans le navigateur, stockées en Firestore) ──

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0 || disabled || isUploading) return;

      const files = Array.from(fileList);
      const notImage = files.find((f) => !f.type.startsWith('image/'));
      if (notImage) {
        setUploadError(
          `Format non accepté : ${notImage.name} — images uniquement. Pour un PDF ou un document long, utilisez l'onglet Lien.`
        );
        return;
      }

      const headers = await getAuthHeaders();
      if (!headers) return;

      setIsUploading(true);
      setUploadError(null);

      try {
        // Compression avant envoi (limite Firestore : ~700 Ko par image)
        const formData = new FormData();
        for (const f of files) {
          const compressed = await compressImage(f);
          if (!compressed) {
            setUploadError(`Impossible de réduire ${f.name} sous 700 Ko — réduisez l'image ou utilisez l'onglet Lien.`);
            setIsUploading(false);
            if (inputRef.current) inputRef.current.value = '';
            return;
          }
          formData.append('files', compressed.blob, compressed.name);
        }

        // Ne garder que l'Authorization : le navigateur fixe lui-même le
        // Content-Type multipart (avec sa boundary)
        const res = await fetch('/api/ressources/upload', {
          method: 'POST',
          headers: { Authorization: headers.Authorization },
          body: formData,
        });
        const json = await res.json();

        if (json.success && json.data?.files) {
          onRessourcesChange(
            buildRessource(outilsValue, documentValue, [...filesValue, ...json.data.files])
          );
        } else {
          setUploadError(json.message || "Erreur lors de l'upload");
        }
      } catch (err) {
        console.error('Erreur upload ressource:', err);
        setUploadError('Erreur de connexion pendant l’upload');
      } finally {
        setIsUploading(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [disabled, isUploading, getAuthHeaders, onRessourcesChange, outilsValue, documentValue, filesValue]
  );

  const handleRemoveFile = useCallback(
    async (file: RessourceFile) => {
      onRessourcesChange(
        buildRessource(outilsValue, documentValue, filesValue.filter((f) => f !== file))
      );

      // Suppression de l'image stockée (silencieuse en cas d'échec)
      if (file.fileId) {
        const headers = await getAuthHeaders();
        if (!headers) return;
        fetch(`/api/ressources/upload?id=${encodeURIComponent(file.fileId)}`, {
          method: 'DELETE',
          headers: { Authorization: headers.Authorization },
        }).catch((err) => console.error('Erreur suppression Drive:', err));
      }
    },
    [onRessourcesChange, outilsValue, documentValue, filesValue, getAuthHeaders]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  return (
    <div className={styles.container}>
      {/* ── Onglets Fichier / Lien / Texte (contenus cumulables) ── */}
      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${activeTab === 'fichier' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('fichier')}
        >
          Image {hasFichier && <span className={styles.tabDot} />}
        </button>
        <button
          type="button"
          className={`${styles.tab} ${activeTab === 'lien' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('lien')}
        >
          Lien {hasLien && <span className={styles.tabDot} />}
        </button>
        <button
          type="button"
          className={`${styles.tab} ${activeTab === 'texte' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('texte')}
        >
          Texte {hasTexte && <span className={styles.tabDot} />}
        </button>
      </div>

      {/* ── Onglet Image : dépôt d'images (compressées, stockées en Firestore) ── */}
      {activeTab === 'fichier' && (
        <div className={styles.tabPanel}>
          <p className={styles.tabHint}>
            Images uniquement, compressées automatiquement. Pour un PDF ou un document long,
            collez son lien dans l&apos;onglet Lien.
          </p>
          <div
            className={`${styles.dropzone} ${isDragging ? styles.dropzoneActive : ''}`}
            onClick={() => !disabled && !isUploading && inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            {isUploading
              ? 'Envoi en cours...'
              : 'Glissez une image ici, ou cliquez pour parcourir (JPG, PNG, GIF, WebP)'}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            multiple
            hidden
            onChange={(e) => handleFiles(e.target.files)}
            disabled={disabled || isUploading}
          />
          {uploadError && <p className={styles.uploadError}>{uploadError}</p>}
          {filesValue.length > 0 && (
            <div className={styles.thumbGrid}>
              {filesValue.map((file, index) => (
                <figure key={file.fileId || index} className={styles.thumbItem}>
                  <button
                    type="button"
                    className={styles.thumbButton}
                    onClick={() => setPreviewFile(file)}
                    title="Voir en grand"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={file.url} alt={file.name} className={styles.thumbImage} />
                  </button>
                  {!disabled && (
                    <button
                      type="button"
                      className={styles.thumbRemove}
                      onClick={() => handleRemoveFile(file)}
                      title="Retirer cette image"
                    >
                      ✕
                    </button>
                  )}
                  <figcaption className={styles.thumbCaption}>{file.name}</figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Popup de visualisation en grand (clic hors de l'image pour fermer) */}
      {previewFile && (
        <div
          className={styles.lightbox}
          onClick={() => setPreviewFile(null)}
          role="dialog"
          aria-label={previewFile.name}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewFile.url}
            alt={previewFile.name}
            className={styles.lightboxImage}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            className={styles.lightboxClose}
            onClick={() => setPreviewFile(null)}
            title="Fermer"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Onglet Lien : une URL par ligne, converties en liens cliquables ── */}
      {activeTab === 'lien' && (
        <div className={styles.tabPanel}>
          <p className={styles.tabHint}>
            Une URL par ligne — chaque ligne devient une puce cliquable pour les élèves.
          </p>
          <textarea
            className={styles.lienTextarea}
            value={lienText}
            onChange={(e) => handleLienChange(e.target.value)}
            placeholder={'https://exemple.com\nhttps://autre-site.be'}
            rows={5}
            disabled={disabled}
            spellCheck={false}
          />
        </div>
      )}

      {/* ── Onglet Texte : document mis en forme ── */}
      {activeTab === 'texte' && (
        <div className={styles.tabPanel}>
          <p className={styles.tabHint}>
            Rédigez un document mis en forme à destination des élèves.
          </p>
          <DocumentEditor
            content={documentValue}
            onChange={handleDocumentChange}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}
