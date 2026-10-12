'use client';

// « Importer un cours » — la popup de l'élève FLE (2026-10-08).
// Trois façons : un lien (Google Docs / Slides / Sheets partagé par lien, ou
// une page web), un PDF de 5 pages au plus, ou du texte collé — plus « Mes
// documents » (2026-10-12) : reprendre un PDF déjà importé, sans le relire. L'extraction
// se fait côté serveur ; la popup ne fait que porter la demande et dire
// clairement pourquoi un import est refusé (partage, pages, longueur).

import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { PDF_PAGES_MAX } from '@/types/lecture-cours';
import type { DocumentCoursResume } from '@/types/lecture-cours';
import styles from './ImportCoursModal.module.css';

type Mode = 'lien' | 'pdf' | 'texte' | 'documents';

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
  // Mes documents : chargés à la première ouverture de l'onglet
  const [documents, setDocuments] = useState<DocumentCoursResume[] | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);

  // Fermer remet la popup à zéro pour la prochaine ouverture
  const fermer = useCallback(() => {
    setErreur(null);
    setEnCours(false);
    // La liste se recharge à la prochaine ouverture (un PDF a pu s'y ajouter)
    setDocuments(null);
    setDocumentId(null);
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

  useEffect(() => {
    if (!isOpen || mode !== 'documents' || documents) return;
    let annule = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const res = await fetch('/api/fle/documents', { headers });
        const json = await res.json();
        if (!annule) setDocuments(json.success ? (json.data as DocumentCoursResume[]) : []);
      } catch {
        if (!annule) setDocuments([]);
      }
    })();
    return () => {
      annule = true;
    };
  }, [isOpen, mode, documents, getAuthHeaders]);

  if (!isOpen) return null;

  const pret =
    (mode === 'lien' && url.trim().length > 0) ||
    (mode === 'texte' && texte.trim().length >= 200) ||
    (mode === 'pdf' && !!fichier) ||
    (mode === 'documents' && !!documentId);

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
      if (mode === 'documents' && documentId) {
        form.set('mode', 'document');
        form.set('documentId', documentId);
      }
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
      setDocuments(null);
      setDocumentId(null);
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
                ['documents', '📚', 'Mes documents'],
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

          {mode === 'documents' && (
            <div className={styles.field}>
              <p className={styles.label}>Choisis un PDF que tu as déjà importé</p>
              {documents === null ? (
                <p className={styles.aide}>Chargement…</p>
              ) : documents.length === 0 ? (
                <p className={styles.aide}>Tu n’as encore importé aucun PDF. Utilise « Un PDF ».</p>
              ) : (
                <ul className={styles.documents} role="listbox" aria-label="Mes documents">
                  {documents.map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={documentId === d.id}
                        className={`${styles.document} ${documentId === d.id ? styles.documentActif : ''}`}
                        onClick={() => setDocumentId(d.id)}
                        disabled={enCours}
                      >
                        <span className={styles.documentTitre}>📄 {d.titre}</span>
                        <span className={styles.documentMeta}>
                          {d.pages} page{d.pages > 1 ? 's' : ''} ·{' '}
                          {new Date(d.createdAt).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long' })}
                          {!d.conserve && ' · sans le PDF'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className={styles.aide}>Une nouvelle lecture commence, prête tout de suite.</p>
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
