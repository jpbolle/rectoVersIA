'use client';

// Choix du TYPE D'ACTIVITÉ avant le formulaire de création.
//
// Le menu déroulant du formulaire ne disait rien de ce que chaque atelier fait,
// et la liste s'allonge. Désormais (demande JP du 2026-10-04) : « Créer une
// activité » ouvre d'abord une grande popup qui présente chaque atelier avec
// un pictogramme, son titre et une ligne d'explication ; le formulaire
// recto/verso ne s'ouvre qu'une fois le type choisi (prop `atelierInitial`
// de CreationForm). Le menu déroulant reste dans le formulaire pour changer
// d'avis sans tout fermer.
//
// Deux formes : `AtelierChoiceGrid` (la grille seule, à poser dans une popup
// déjà ouverte — cf. ModuleActivitesModal) et `AtelierChoiceModal` (la grille
// dans sa propre popup centrée, fond assombri).

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ATELIERS } from '@/types/didactique';
import AtelierPicto from './AtelierPicto';
import styles from './AtelierChoiceModal.module.css';

interface AtelierChoiceGridProps {
  onChoose: (atelierId: string) => void;
  // Conservé pour les appelants ; la séquence FLE n'est plus proposée NULLE
  // PART ici depuis le 2026-10-08 : elle se crée depuis « Mes parcours FLE »
  // (une séquence ne s'emboîte pas dans une autre, et elle n'est pas une
  // activité classique).
  modeFle?: boolean;
}

export function AtelierChoiceGrid({ onChoose }: AtelierChoiceGridProps) {
  const ateliers = ATELIERS.filter((a) => a.dispositif !== 'sequence');
  return (
    <div className={styles.grid}>
      {ateliers.map((a) => (
        <button
          key={a.id}
          type="button"
          className={styles.carte}
          onClick={() => onChoose(a.id)}
          data-atelier={a.id}
        >
          <span className={styles.picto}>
            <AtelierPicto atelierId={a.id} />
          </span>
          <span className={styles.titre}>{a.label}</span>
          <span className={styles.desc}>{a.description}</span>
        </button>
      ))}
    </div>
  );
}

interface AtelierChoiceModalProps extends AtelierChoiceGridProps {
  onClose: () => void;
  titre?: string;
}

export default function AtelierChoiceModal({
  onChoose,
  onClose,
  modeFle = false,
  titre = 'Quel type d’activité ?',
}: AtelierChoiceModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={titre}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.head}>
          <h3 className={styles.headTitre}>{titre}</h3>
          <span className={styles.headSous}>
            Choisis l’atelier : le formulaire s’ouvrira déjà réglé sur ce type.
          </span>
          <button type="button" className={styles.fermer} onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className={styles.corps}>
          <AtelierChoiceGrid onChoose={onChoose} modeFle={modeFle} />
        </div>
      </div>
    </div>,
    document.body
  );
}
