'use client';

// Accordéon partagé (2026-10-08) — né pour les six sections de la lecture de
// cours FLE. Chaque volet porte un état : à faire, en préparation, prêt ou
// en erreur ; seul un volet prêt s'ouvre. Les volets sont indépendants (on
// peut en ouvrir plusieurs) — c'est une page de lecture, pas un menu.

import { useState } from 'react';
import type { ReactNode } from 'react';
import styles from './Accordeon.module.css';

export type EtatVolet = 'a-faire' | 'en-cours' | 'prete' | 'erreur';

export interface Volet {
  cle: string;
  picto: string;
  titre: string;
  sousTitre?: string;
  etat: EtatVolet;
  erreur?: string | null;
  contenu: ReactNode;
  // Verrouillé : prêt, mais pas encore accessible (la section précédente
  // n'est pas faite). Le message dit pourquoi.
  verrouille?: boolean;
  verrouMessage?: string;
  // Fait : un ✓ dans l'en-tête
  fait?: boolean;
}

interface Props {
  volets: Volet[];
  // Volets ouverts au départ (les autres se déplient au clic)
  ouvertsInitiaux?: string[];
  onReessayer?: (cle: string) => void;
}

export default function Accordeon({ volets, ouvertsInitiaux = [], onReessayer }: Props) {
  const [ouverts, setOuverts] = useState<Set<string>>(() => new Set(ouvertsInitiaux));

  const basculer = (cle: string) => {
    setOuverts((prev) => {
      const next = new Set(prev);
      if (next.has(cle)) next.delete(cle);
      else next.add(cle);
      return next;
    });
  };

  return (
    <div className={styles.accordeon}>
      {volets.map((v) => {
        const pret = v.etat === 'prete' && !v.verrouille;
        const ouvert = pret && ouverts.has(v.cle);
        return (
          <section key={v.cle} className={`${styles.volet} ${ouvert ? styles.voletOuvert : ''} ${styles[`etat_${v.etat.replace('-', '_')}`] ?? ''}`}>
            <button
              type="button"
              className={styles.entete}
              onClick={() => pret && basculer(v.cle)}
              aria-expanded={ouvert}
              disabled={!pret && v.etat !== 'erreur'}
              title={v.verrouille ? v.verrouMessage : undefined}
            >
              <span className={styles.picto} aria-hidden="true">{v.picto}</span>
              <span className={styles.titres}>
                <span className={styles.titre}>{v.titre}</span>
                {v.sousTitre && <span className={styles.sousTitre}>{v.sousTitre}</span>}
              </span>
              <span className={styles.etat}>
                {v.etat === 'a-faire' && <span className={styles.badgeAttente}>en attente</span>}
                {v.etat === 'en-cours' && (
                  <span className={styles.badgeEnCours}>
                    <span className={styles.spinner} aria-hidden="true" /> en préparation…
                  </span>
                )}
                {v.etat === 'erreur' && <span className={styles.badgeErreur}>erreur</span>}
                {v.etat === 'prete' && v.verrouille && (
                  <span className={styles.badgeVerrou}>🔒 {v.verrouMessage ?? 'termine la section précédente'}</span>
                )}
                {v.fait && <span className={styles.badgeFait}>✓ fait</span>}
                {pret && <span className={styles.chevron} aria-hidden="true">{ouvert ? '▾' : '▸'}</span>}
              </span>
            </button>
            {v.etat === 'erreur' && (
              <div className={styles.erreur}>
                <span>{v.erreur || 'La préparation a échoué.'}</span>
                {onReessayer && (
                  <button type="button" className={styles.reessayer} onClick={() => onReessayer(v.cle)}>
                    Réessayer
                  </button>
                )}
              </div>
            )}
            {ouvert && <div className={styles.corps}>{v.contenu}</div>}
          </section>
        );
      })}
    </div>
  );
}
