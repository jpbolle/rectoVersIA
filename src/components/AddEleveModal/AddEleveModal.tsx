'use client';

import { useState, useEffect } from 'react';
import type { Eleve } from '@/types/classe';
import styles from './AddEleveModal.module.css';

interface AddEleveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { nom: string; prenom: string; email: string }) => Promise<void>;
  editingEleve?: Eleve | null;
  isSaving: boolean;
  classeName?: string;
}

export default function AddEleveModal({
  isOpen,
  onClose,
  onSubmit,
  editingEleve,
  isSaving,
  classeName,
}: AddEleveModalProps) {
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (editingEleve) {
      setNom(editingEleve.nom);
      setPrenom(editingEleve.prenom);
      setEmail(editingEleve.email);
    } else {
      setNom('');
      setPrenom('');
      setEmail('');
    }
  }, [editingEleve, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom.trim() || !prenom.trim() || !email.trim()) return;

    await onSubmit({
      nom: nom.trim(),
      prenom: prenom.trim(),
      email: email.trim(),
    });
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            {editingEleve ? 'Modifier l\'élève' : 'Nouvel élève'}
          </h2>
          {classeName && !editingEleve && (
            <span className={styles.classeBadge}>{classeName}</span>
          )}
          <button className={styles.closeBtn} onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="nom">
                Nom *
              </label>
              <input
                id="nom"
                type="text"
                className={styles.input}
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Dupont"
                required
                autoFocus
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="prenom">
                Prénom *
              </label>
              <input
                id="prenom"
                type="text"
                className={styles.input}
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
                placeholder="Marie"
                required
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">
              Email *
            </label>
            <input
              id="email"
              type="email"
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="marie.dupont@ecole.fr"
              required
            />
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onClose}
              disabled={isSaving}
            >
              Annuler
            </button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={isSaving || !nom.trim() || !prenom.trim() || !email.trim()}
            >
              {isSaving ? 'Enregistrement...' : editingEleve ? 'Modifier' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
