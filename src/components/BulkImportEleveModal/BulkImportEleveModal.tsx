'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import styles from './BulkImportEleveModal.module.css';

type Separator = ';' | ',' | '\t' | ' ';

interface ParsedRow {
  nom: string;
  prenom: string;
  email: string;
  autoEmail: boolean;
  error?: string;
}

interface BulkImportEleveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (eleves: { nom: string; prenom: string; email: string }[]) => Promise<void>;
  isSaving: boolean;
  classeName?: string;
}

const SEPARATOR_OPTIONS: { value: Separator; label: string }[] = [
  { value: ';', label: 'Point-virgule ( ; )' },
  { value: ',', label: 'Virgule ( , )' },
  { value: '\t', label: 'Tabulation (Tab)' },
  { value: ' ', label: 'Espace' },
];

function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function BulkImportEleveModal({
  isOpen,
  onClose,
  onImport,
  isSaving,
  classeName,
}: BulkImportEleveModalProps) {
  const [rawText, setRawText] = useState('');
  const [separator, setSeparator] = useState<Separator>(';');
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo((): ParsedRow[] => {
    if (!rawText.trim()) return [];

    const lines = rawText.split('\n').filter((l) => l.trim());
    const seen = new Set<string>();

    return lines.map((line) => {
      const parts = line.split(separator).map((p) => p.trim());
      const nom = parts[0] || '';
      const prenom = parts[1] || '';
      let email = (parts[2] || '').toLowerCase();
      let autoEmail = false;

      if (!nom || !prenom) {
        return { nom, prenom, email, autoEmail: false, error: 'Nom et prénom requis' };
      }

      if (!email) {
        const np = removeAccents(prenom).toLowerCase().replace(/\s+/g, '');
        const nn = removeAccents(nom).toLowerCase().replace(/\s+/g, '');
        email = `${np}.${nn}@cnddinant.be`;
        autoEmail = true;
      } else if (!isValidEmail(email)) {
        return { nom, prenom, email, autoEmail: false, error: 'Email invalide' };
      }

      if (seen.has(email)) {
        return { nom, prenom, email, autoEmail, error: 'Email en doublon' };
      }
      seen.add(email);

      return { nom, prenom, email, autoEmail };
    });
  }, [rawText, separator]);

  const validRows = useMemo(() => parsed.filter((r) => !r.error), [parsed]);
  const errorRows = useMemo(() => parsed.filter((r) => !!r.error), [parsed]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setRawText(text);
    };
    reader.readAsText(file, 'UTF-8');

    // Reset input pour pouvoir re-sélectionner le même fichier
    e.target.value = '';
  }, []);

  const handleImport = async () => {
    const eleves = validRows.map((r) => ({
      nom: r.nom,
      prenom: r.prenom,
      email: r.email,
    }));
    await onImport(eleves);
    // Reset après succès
    setRawText('');
    setFileName(null);
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Import en masse</h2>
          {classeName && <span className={styles.classeBadge}>{classeName}</span>}
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            &times;
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.inputSection}>
            <div className={styles.separatorRow}>
              <label className={styles.separatorLabel}>Séparateur :</label>
              <select
                className={styles.separatorSelect}
                value={separator}
                onChange={(e) => setSeparator(e.target.value as Separator)}
              >
                {SEPARATOR_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <textarea
              className={styles.textarea}
              value={rawText}
              onChange={(e) => {
                setRawText(e.target.value);
                setFileName(null);
              }}
              placeholder={`Collez ici la liste des élèves (une ligne par élève) :\n\nDupont${separator}Marie${separator}marie.dupont@ecole.be\nMartin${separator}Luc`}
            />

            <p className={styles.hint}>
              Format : nom{separator === '\t' ? ' [Tab] ' : ` ${separator} `}prénom{separator === '\t' ? ' [Tab] ' : ` ${separator} `}email (email optionnel)
            </p>

            <div className={styles.orDivider}>ou</div>

            <div className={styles.fileRow}>
              <button
                type="button"
                className={styles.fileBtn}
                onClick={() => fileInputRef.current?.click()}
              >
                📄 Charger un fichier .csv
              </button>
              {fileName && <span className={styles.fileName}>{fileName}</span>}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,.tsv"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </div>
          </div>

          {parsed.length > 0 && (
            <div className={styles.previewSection}>
              <h3 className={styles.previewTitle}>
                Prévisualisation ({parsed.length} ligne{parsed.length > 1 ? 's' : ''})
              </h3>

              <table className={styles.previewTable}>
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Prénom</th>
                    <th>Email</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.map((row, i) => (
                    <tr key={i} className={row.error ? styles.rowError : styles.rowOk}>
                      <td>{row.nom || '—'}</td>
                      <td>{row.prenom || '—'}</td>
                      <td>
                        {row.autoEmail ? (
                          <span className={styles.autoEmail}>{row.email} (auto)</span>
                        ) : (
                          row.email || '—'
                        )}
                      </td>
                      <td>
                        {row.error && (
                          <span className={styles.errorBadge}>{row.error}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className={styles.previewStats}>
                <span className={styles.statOk}>
                  {validRows.length} valide{validRows.length > 1 ? 's' : ''}
                </span>
                {errorRows.length > 0 && (
                  <span className={styles.statError}>
                    {errorRows.length} erreur{errorRows.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onClose}
            disabled={isSaving}
          >
            Annuler
          </button>
          <button
            type="button"
            className={styles.importBtn}
            onClick={handleImport}
            disabled={isSaving || validRows.length === 0}
          >
            {isSaving
              ? 'Import en cours...'
              : `Importer ${validRows.length} élève${validRows.length > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
