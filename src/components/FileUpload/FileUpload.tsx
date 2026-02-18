'use client';

import { useRef, useState, useCallback } from 'react';
import { getFileIcon } from '@/lib/firebase/storage';
import styles from './FileUpload.module.css';

interface UploadedFile {
  file: File;
  preview?: string;
}

interface FileUploadProps {
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  maxFiles?: number;
  accept?: string;
  disabled?: boolean;
}

const DEFAULT_ACCEPT = '.pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx';

export default function FileUpload({
  files,
  onFilesChange,
  maxFiles = 5,
  accept = DEFAULT_ACCEPT,
  disabled = false,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback(
    (newFiles: FileList | null) => {
      if (!newFiles || disabled) return;

      const fileArray = Array.from(newFiles);
      const remainingSlots = maxFiles - files.length;
      const filesToAdd = fileArray.slice(0, remainingSlots);

      const uploadedFiles: UploadedFile[] = filesToAdd.map((file) => ({
        file,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      }));

      onFilesChange([...files, ...uploadedFiles]);
    },
    [files, maxFiles, onFilesChange, disabled]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    },
    [handleFiles]
  );

  const handleRemoveFile = useCallback(
    (index: number) => {
      const file = files[index];
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
      const newFiles = files.filter((_, i) => i !== index);
      onFilesChange(newFiles);
    },
    [files, onFilesChange]
  );

  const handleClick = useCallback(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.click();
    }
  }, [disabled]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={styles.container}>
      <div
        className={`${styles.dropzone} ${isDragging ? styles.dragging : ''} ${
          disabled ? styles.disabled : ''
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          onChange={handleInputChange}
          disabled={disabled}
          className={styles.input}
        />
        <div className={styles.dropzoneContent}>
          <span className={styles.icon}>📁</span>
          <p className={styles.text}>
            Glissez-deposez vos fichiers ici ou cliquez pour selectionner
          </p>
          <p className={styles.hint}>
            PDF, images, Word • Max {maxFiles} fichiers • 10MB par fichier
          </p>
        </div>
      </div>

      {files.length > 0 && (
        <div className={styles.fileList}>
          {files.map((uploadedFile, index) => (
            <div key={index} className={styles.fileItem}>
              {uploadedFile.preview ? (
                <img
                  src={uploadedFile.preview}
                  alt={uploadedFile.file.name}
                  className={styles.preview}
                />
              ) : (
                <span className={styles.fileIcon}>
                  {getFileIcon(uploadedFile.file.type)}
                </span>
              )}
              <div className={styles.fileInfo}>
                <span className={styles.fileName}>{uploadedFile.file.name}</span>
                <span className={styles.fileSize}>
                  {formatFileSize(uploadedFile.file.size)}
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveFile(index);
                }}
                className={styles.removeBtn}
                aria-label="Supprimer"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {files.length >= maxFiles && (
        <p className={styles.maxReached}>Nombre maximum de fichiers atteint</p>
      )}
    </div>
  );
}
