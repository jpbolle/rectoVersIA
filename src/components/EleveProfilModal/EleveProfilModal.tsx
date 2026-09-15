'use client';

// Grande popup « Fiche de l'élève » (pages Mes Classes, rôle prof) :
// le profil d'écrilecteur complet de l'élève (5 onglets), équivalent de la
// page « Mon Profil » côté élève — données servies par /api/profil/*?eleveId=.

import { useEffect } from 'react';
import ProfilPanel from '@/components/ProfilPanel/ProfilPanel';
import NiveauFlePanel from '@/components/NiveauFlePanel/NiveauFlePanel';
import type { ClasseType } from '@/types/classe';
import styles from './EleveProfilModal.module.css';

interface EleveProfilModalProps {
  eleveId: string;
  eleveName: string;      // « Prénom Nom »
  classeName?: string;
  // Classe FLE : le positionnement CECR (radar + curseurs) précède le profil
  classeType?: ClasseType;
  onClose: () => void;
}

export default function EleveProfilModal({
  eleveId,
  eleveName,
  classeName,
  classeType,
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
              Fiche de l&apos;élève{classeName ? ` — ${classeName}` : ''} ·{' '}
              {classeType === 'fle' ? 'niveaux CECR et profil d’écrilecteur' : 'profil d’écrilecteur'}
            </p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} title="Fermer">
            ✕
          </button>
        </div>
        <div className={styles.body}>
          {classeType === 'fle' && (
            <section className={styles.fle}>
              <h3 className={styles.fleTitre}>Niveaux CECR</h3>
              <p className={styles.fleSub}>
                Règle les curseurs : l’élève voit le radar sur sa page « Mon cours ». Les
                objectifs du mois s’y affichent aussi.
              </p>
              <NiveauFlePanel key={`fle-${eleveId}`} eleveId={eleveId} />
            </section>
          )}
          {/* key : remonte le panneau (et son état d'onglets) quand on change d'élève */}
          <ProfilPanel key={eleveId} eleveId={eleveId} />
        </div>
      </div>
    </div>
  );
}
