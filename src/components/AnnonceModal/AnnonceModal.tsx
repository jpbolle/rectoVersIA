'use client';

// Popup d'envoi d'une annonce (page /admin, onglet Vue d'ensemble).
// Trois décisions : à qui, quoi, et vers quelle page de l'app renvoyer.
// Le lien se choisit dans une liste de pages filtrée par la cible — un élève
// ne doit jamais recevoir un lien vers une page prof ; le champ libre reste
// disponible pour pointer une activité précise (/activites/DEV-…).

import { useState } from 'react';
import { CIBLE_LABELS, pagesPourCible } from '@/types/annonce';
import type { AnnonceCible } from '@/types/annonce';
import styles from './AnnonceModal.module.css';

const CIBLES: AnnonceCible[] = ['profs', 'eleves', 'tous'];

interface Props {
  onClose: () => void;
  onSend: (data: { message: string; cible: AnnonceCible; lien: string | null }) => Promise<boolean>;
}

export default function AnnonceModal({ onClose, onSend }: Props) {
  const [cible, setCible] = useState<AnnonceCible>('tous');
  const [message, setMessage] = useState('');
  const [lienMode, setLienMode] = useState<'aucun' | 'page' | 'libre'>('aucun');
  const [page, setPage] = useState('');
  const [lienLibre, setLienLibre] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pages = pagesPourCible(cible);

  // Changer de cible peut rendre la page choisie inaccessible au destinataire
  const changeCible = (next: AnnonceCible) => {
    setCible(next);
    if (page && !pagesPourCible(next).some((p) => p.path === page)) setPage('');
  };

  const lien =
    lienMode === 'page' ? page || null : lienMode === 'libre' ? lienLibre.trim() || null : null;

  const lienInvalide =
    lienMode === 'libre' && !!lienLibre.trim() && !lienLibre.trim().startsWith('/');

  const submit = async () => {
    if (!message.trim() || lienInvalide) return;
    setIsSending(true);
    setError(null);
    const ok = await onSend({ message: message.trim(), cible, lien });
    setIsSending(false);
    if (ok) onClose();
    else setError("L'annonce n'a pas pu être envoyée.");
  };

  return (
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.modal}>
        <div className={styles.head}>
          <h3>Envoyer une notification</h3>
          <p>Elle apparaîtra dans la cloche des destinataires pendant 14 jours.</p>
        </div>

        <div className={styles.body}>
          <div className={styles.field}>
            <label>Destinataires</label>
            <div className={styles.cibles}>
              {CIBLES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`${styles.cibleBtn} ${cible === c ? styles.cibleActive : ''}`}
                  onClick={() => changeCible(c)}
                >
                  {CIBLE_LABELS[c]}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="annonce-message">Message</label>
            <textarea
              id="annonce-message"
              value={message}
              maxLength={500}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Les questionnaires de lecture sont disponibles depuis ce matin…"
            />
            <p className={styles.help}>{message.length}/500 caractères</p>
          </div>

          <div className={styles.field}>
            <label>Lien vers une page de l&apos;app</label>
            <div className={styles.lienModes}>
              <label className={styles.radio}>
                <input
                  type="radio"
                  checked={lienMode === 'aucun'}
                  onChange={() => setLienMode('aucun')}
                />
                Aucun
              </label>
              <label className={styles.radio}>
                <input
                  type="radio"
                  checked={lienMode === 'page'}
                  onChange={() => setLienMode('page')}
                />
                Une page de l&apos;app
              </label>
              <label className={styles.radio}>
                <input
                  type="radio"
                  checked={lienMode === 'libre'}
                  onChange={() => setLienMode('libre')}
                />
                Chemin précis
              </label>
            </div>

            {lienMode === 'page' && (
              <select
                className={styles.select}
                value={page}
                onChange={(e) => setPage(e.target.value)}
              >
                <option value="">Choisir une page…</option>
                {pages.map((p) => (
                  <option key={p.path} value={p.path}>
                    {p.label}
                  </option>
                ))}
              </select>
            )}

            {lienMode === 'libre' && (
              <>
                <input
                  className={styles.input}
                  value={lienLibre}
                  onChange={(e) => setLienLibre(e.target.value)}
                  placeholder="/activites/DEV-20260815-1234"
                />
                <p className={`${styles.help} ${lienInvalide ? styles.helpError : ''}`}>
                  {lienInvalide
                    ? 'Un chemin commence par « / » — les adresses externes sont refusées.'
                    : 'Chemin interne uniquement, commençant par « / ». Vérifiez que le destinataire y a accès.'}
                </p>
              </>
            )}
          </div>

          {error && <p className={styles.error}>{error}</p>}
        </div>

        <div className={styles.foot}>
          <button type="button" className={styles.btnGhost} onClick={onClose} disabled={isSending}>
            Annuler
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={submit}
            disabled={isSending || !message.trim() || lienInvalide}
          >
            {isSending ? 'Envoi…' : 'Envoyer'}
          </button>
        </div>
      </div>
    </div>
  );
}
