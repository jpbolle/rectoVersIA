'use client';

// Grande popup « Fiche de l'élève » (pages Mes Classes, rôle prof) :
// le profil d'écrilecteur complet de l'élève (5 onglets), équivalent de la
// page « Mon Profil » côté élève — données servies par /api/profil/*?eleveId=.

import { useEffect } from 'react';
import ProfilPanel from '@/components/ProfilPanel/ProfilPanel';
import styles from './EleveProfilModal.module.css';

interface EleveProfilModalProps {
  eleveId: string;
  eleveName: string;      // « Prénom Nom »
  classeName?: string;
  onClose: () => void;
}

export default function EleveProfilModal({
  eleveId,
  eleveName,
  classeName,
  onClose,
}: EleveProfilModalProps) {
  // Fermeture avec Échap + blocage du scroll de la page derrière
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.head}>
          <div>
            <h2 className={styles.title}>
              <span className={styles.avatar}>
                {eleveName.split(' ').map((p) => p.charAt(0)).slice(0, 2).join('')}
              </span>
              {eleveName}
            </h2>
            <p className={styles.subtitle}>
              Fiche de l&apos;élève{classeName ? ` — ${classeName}` : ''} · profil d&apos;écrilecteur
            </p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} title="Fermer">
            ✕
          </button>
        </div>
        <div className={styles.body}>
          {/* key : remonte le panneau (et son état d'onglets) quand on change d'élève */}
          <ProfilPanel key={eleveId} eleveId={eleveId} />
        </div>
      </div>
    </div>
  );
}
