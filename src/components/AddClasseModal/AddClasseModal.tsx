'use client';

import { useState, useEffect } from 'react';
import type { Classe } from '@/types/classe';
import styles from './AddClasseModal.module.css';

interface AddClasseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { nom: string; description?: string }) => Promise<void>;
  editingClasse?: Classe | null;
  isSaving: boolean;
}

export default function AddClasseModal({
  isOpen,
  onClose,
  onSubmit,
  editingClasse,
  isSaving,
}: AddClasseModalProps) {
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (editingClasse) {
      setNom(editingClasse.nom);
      setDescription(editingClasse.description || '');
    } else {
      setNom('');
      setDescription('');
    }
  }, [editingClasse, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom.trim()) return;

    await onSubmit({
      nom: nom.trim(),
      description: description.trim() || undefined,
    });
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            {editingClasse ? 'Modifier la classe' : 'Nouvelle classe'}
          </h2>
          <button className={styles.closeBtn} onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="nom">
              Nom de la classe *
            </label>
            <input
              id="nom"
              type="text"
              className={styles.input}
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Ex: 4A, 3B, Terminale S1..."
              required
              autoFocus
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="description">
              Description (optionnel)
            </label>
            <input
              id="description"
              type="text"
              className={styles.input}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Classe à projet, Option latin..."
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
              disabled={isSaving || !nom.trim()}
            >
              {isSaving ? 'Enregistrement...' : editingClasse ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
