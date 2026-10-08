'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { ClasseType, Eleve } from '@/types/classe';
import { LANGUES_MATERNELLES, langueLabel } from '@/types/niveaux-fle';
import styles from './AddEleveModal.module.css';

export interface EleveFormData {
  nom: string;
  prenom: string;
  email: string;
  // Classe FLE seulement : la langue maternelle (code), '' = non posée.
  // Enregistrée par le parent dans `niveauxFle` (PUT /api/niveaux-fle), pas
  // dans la fiche `eleves` — voir le plan du 2026-10-08.
  langueMaternelle?: string;
}

interface AddEleveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: EleveFormData) => Promise<void>;
  editingEleve?: Eleve | null;
  isSaving: boolean;
  classeName?: string;
  // Classe FLE : deux champs de plus — langue maternelle (menu) et niveau
  // global (déduit du radar, en lecture)
  classeType?: ClasseType;
  // La passerelle vers la grande fiche (radar, objectifs du mois) — même donnée
  onOuvrirFiche?: () => void;
}

export default function AddEleveModal({
  isOpen,
  onClose,
  onSubmit,
  editingEleve,
  isSaving,
  classeName,
  classeType,
  onOuvrirFiche,
}: AddEleveModalProps) {
  const { getAuthHeaders } = useAuth();
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  // Classe FLE : langue posée, suggestion d'après ses mots Daspalecte, niveau déduit
  const [langue, setLangue] = useState('');
  const [langueSuggeree, setLangueSuggeree] = useState('');
  const [niveauGlobal, setNiveauGlobal] = useState<string | null>(null);
  const fle = classeType === 'fle';

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
    setLangue('');
    setLangueSuggeree('');
    setNiveauGlobal(null);
  }, [editingEleve, isOpen]);

  // Classe FLE, élève existant : sa langue et son niveau, servis par /api/niveaux-fle
  useEffect(() => {
    if (!isOpen || !fle || !editingEleve) return;
    let annule = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const res = await fetch(`/api/niveaux-fle?eleveId=${encodeURIComponent(editingEleve.id)}`, { headers });
        const json = await res.json();
        if (annule || !json.success) return;
        setLangue(json.data.niveaux?.langueMaternelle || '');
        setLangueSuggeree(json.data.langueSuggeree || '');
        setNiveauGlobal(json.data.niveauGlobal?.label || null);
      } catch {
        // Les champs restent vides
      }
    })();
    return () => {
      annule = true;
    };
  }, [isOpen, fle, editingEleve, getAuthHeaders]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom.trim() || !prenom.trim() || !email.trim()) return;

    await onSubmit({
      nom: nom.trim(),
      prenom: prenom.trim(),
      email: email.trim(),
      ...(fle ? { langueMaternelle: langue } : {}),
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

          {/* Classe FLE : la langue (posée par le prof) et le niveau global (déduit
              des curseurs du radar, dans la grande fiche) */}
          {fle && (
            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="langue">
                  Langue maternelle
                </label>
                <select id="langue" className={styles.input} value={langue} onChange={(e) => setLangue(e.target.value)}>
                  <option value="">— à préciser —</option>
                  {LANGUES_MATERNELLES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
                {!langue && langueSuggeree && (
                  <button type="button" className={styles.suggestion} onClick={() => setLangue(langueSuggeree)}>
                    D’après ses mots Daspalecte : {langueLabel(langueSuggeree)} — appliquer
                  </button>
                )}
              </div>
              <div className={styles.field}>
                <span className={styles.label}>Niveau global</span>
                <div className={styles.niveau}>
                  <b>{niveauGlobal ?? '—'}</b>
                  <span className={styles.niveauNote}>
                    {editingEleve ? 'déduit du radar CECR' : 'après création : radar dans sa fiche'}
                  </span>
                  {editingEleve && onOuvrirFiche && (
                    <button type="button" className={styles.suggestion} onClick={onOuvrirFiche} disabled={isSaving}>
                      Régler le radar dans sa fiche →
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

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
