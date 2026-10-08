'use client';

// « Importer un cours » — la popup de l'élève FLE (2026-10-08).
// Trois façons : un lien (Google Docs / Slides / Sheets partagé par lien, ou
// une page web), un PDF de 5 pages au plus, ou du texte collé. L'extraction
// se fait côté serveur ; la popup ne fait que porter la demande et dire
// clairement pourquoi un import est refusé (partage, pages, longueur).

import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { PDF_PAGES_MAX } from '@/types/lecture-cours';
import styles from './ImportCoursModal.module.css';

type Mode = 'lien' | 'pdf' | 'texte';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  // Appelé avec l'id de la lecture créée
  onImported: (id: string) => void;
}

export default function ImportCoursModal({ isOpen, onClose, onImported }: Props) {
  const { getAuthHeaders } = useAuth();
  const [mode, setMode] = useState<Mode>('lien');
  const [titre, setTitre] = useState('');
  const [url, setUrl] = useState('');
  const [texte, setTexte] = useState('');
  const [fichier, setFichier] = useState<File | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Fermer remet la popup à zéro pour la prochaine ouverture
  const fermer = useCallback(() => {
    setErreur(null);
    setEnCours(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !enCours) fermer();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, enCours, fermer]);

  if (!isOpen) return null;

  const pret =
    (mode === 'lien' && url.trim().length > 0) ||
    (mode === 'texte' && texte.trim().length >= 200) ||
    (mode === 'pdf' && !!fichier);

  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    if (!pret || enCours) return;
    setEnCours(true);
    setErreur(null);
    try {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error('Connexion perdue : reconnecte-toi.');
      const form = new FormData();
      form.set('mode', mode);
      form.set('titre', titre);
      if (mode === 'lien') form.set('url', url.trim());
      if (mode === 'texte') form.set('texte', texte);
      if (mode === 'pdf' && fichier) form.set('fichier', fichier, fichier.name);
      // Pas de Content-Type : le navigateur pose lui-même la frontière du multipart.
      // `getAuthHeaders` impose « application/json » — on l'enlève, sinon le
      // serveur refuse le formulaire (« Content-Type was not one of multipart… »).
      const entetes: Record<string, string> = { ...headers };
      Object.keys(entetes).forEach((k) => {
        if (k.toLowerCase() === 'content-type') delete entetes[k];
      });
      const res = await fetch('/api/fle/lectures', { method: 'POST', headers: entetes, body: form });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Import impossible.');
      onImported(json.data.id as string);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Import impossible.');
      setEnCours(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={() => !enCours && fermer()}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Importer un cours" onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.headerPicto} aria-hidden="true">📥</span>
          <h2 className={styles.title}>Importer un cours</h2>
          <button type="button" className={styles.closeBtn} onClick={fermer} disabled={enCours} aria-label="Fermer">
            ×
          </button>
        </div>

        <form className={styles.form} onSubmit={envoyer}>
          <div className={styles.modes} role="tablist">
            {(
              [
                ['lien', '🔗', 'Un lien'],
                ['pdf', '📄', 'Un PDF'],
                ['texte', '✂️', 'Du texte'],
              ] as [Mode, string, string][]
            ).map(([m, picto, label]) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                className={`${styles.modeBtn} ${mode === m ? styles.modeActive : ''}`}
                onClick={() => setMode(m)}
                disabled={enCours}
              >
                <span aria-hidden="true">{picto}</span> {label}
              </button>
            ))}
          </div>

          {mode === 'lien' && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="import-url">
                Colle le lien du cours
              </label>
              <input
                id="import-url"
                type="url"
                className={styles.input}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://docs.google.com/document/d/…"
                disabled={enCours}
                autoFocus
              />
              <p className={styles.aide}>
                Google Docs, Slides ou Sheets : le document doit être partagé en « Tous les utilisateurs
                disposant du lien ». Une page web marche aussi.
              </p>
            </div>
          )}

          {mode === 'pdf' && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="import-pdf">
                Choisis un PDF ({PDF_PAGES_MAX} pages maximum)
              </label>
              <input
                id="import-pdf"
                type="file"
                accept="application/pdf,.pdf"
                className={styles.inputFile}
                onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
                disabled={enCours}
              />
              <p className={styles.aide}>
                Un cours entier est trop long : choisis la partie que tu dois lire. Un PDF scanné (photo du
                cours) marche aussi.
              </p>
            </div>
          )}

          {mode === 'texte' && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="import-texte">
                Colle le texte du cours
              </label>
              <textarea
                id="import-texte"
                className={styles.textarea}
                value={texte}
                onChange={(e) => setTexte(e.target.value)}
                rows={8}
                placeholder="Sélectionne le texte dans ton cours, copie-le, colle-le ici…"
                disabled={enCours}
                autoFocus
              />
              <p className={styles.aide}>{texte.trim().length < 200 ? 'Au moins 200 caractères.' : `${texte.trim().length} caractères.`}</p>
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.label} htmlFor="import-titre">
              Un titre <span className={styles.optionnel}>— si tu veux</span>
            </label>
            <input
              id="import-titre"
              type="text"
              className={styles.input}
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Sciences — la photosynthèse"
              maxLength={120}
              disabled={enCours}
            />
          </div>

          {erreur && <p className={styles.erreur}>{erreur}</p>}

          <div className={styles.actions}>
            <button type="button" className={styles.btnSecondaire} onClick={fermer} disabled={enCours}>
              Annuler
            </button>
            <button type="submit" className={styles.btnPrimaire} disabled={!pret || enCours}>
              {enCours ? (mode === 'pdf' ? 'Lecture du PDF…' : 'Lecture du cours…') : 'Importer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
