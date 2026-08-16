'use client';

// Saisie du contenu AU MOMENT où l'on insère un bloc.
//
// Avant : l'outil d'édition posait un bloc vide, on quittait l'outil, on
// cherchait le bloc dans la liste, on collait, on revenait. Quatre gestes pour
// un collage. Le prof colle son texte là où il vient de décider de le poser
// (demande de JP, 2026-08-16).
//
// L'IMAGE ne passe pas par ici : son « champ », c'est le sélecteur de fichier
// du système. Le constructeur l'ouvre directement.

import { useEffect, useRef, useState } from 'react';
import type { OeuvreBloc } from '@/types/oeuvre';
import styles from './OeuvreBuilder.module.css';

const TITRES: Partial<Record<OeuvreBloc['type'], { titre: string; aide: string; placeholder: string }>> = {
  texte: {
    titre: 'Bloc informatif',
    aide: 'Une présentation, une analyse, une consigne. Le texte pourra être mis en forme ensuite.',
    placeholder: 'Colle ou écris ton texte…',
  },
  vers: {
    titre: 'Extrait',
    aide: 'Une ligne = un vers. Si la première ligne est un nom de personnage en capitales, elle deviendra le locuteur.',
    placeholder: 'DORINE\nIl faut souffrir tout de quelqu’un qui vous aime…',
  },
  video: {
    titre: 'Vidéo',
    aide: 'Lien YouTube ou Google Drive.',
    placeholder: 'https://youtu.be/…',
  },
};

export default function SaisieBlocModal({
  type,
  onValider,
  onAnnuler,
}: {
  type: OeuvreBloc['type'];
  onValider: (contenu: string) => void;
  onAnnuler: () => void;
}) {
  const [valeur, setValeur] = useState('');
  const champRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const info = TITRES[type];

  // Le curseur dans le champ à l'ouverture : on vient pour coller, pas pour
  // chercher où cliquer.
  useEffect(() => {
    champRef.current?.focus();
  }, []);

  useEffect(() => {
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onAnnuler();
    };
    window.addEventListener('keydown', auClavier);
    return () => window.removeEventListener('keydown', auClavier);
  }, [onAnnuler]);

  if (!info) return null;

  const valider = () => {
    // Un bloc vide reste permis : le prof veut parfois poser l'emplacement
    // d'abord et le remplir après. On l'insère alors tel quel.
    onValider(valeur);
  };

  return (
    <div
      className={styles.apercuOverlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onAnnuler();
      }}
    >
      <div className={styles.saisieFenetre} role="dialog" aria-modal="true">
        <div className={styles.apercuEntete}>
          <div>
            <h3>{info.titre}</h3>
            <p className={styles.apercuSous}>{info.aide}</p>
          </div>
          <button type="button" className={styles.apercuFermer} onClick={onAnnuler} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className={styles.saisieCorps}>
          {type === 'video' ? (
            <input
              ref={(el) => {
                champRef.current = el;
              }}
              type="text"
              className={styles.saisieChamp}
              value={valeur}
              onChange={(e) => setValeur(e.target.value)}
              placeholder={info.placeholder}
              // Entrée valide : sur un lien, c'est le geste attendu
              onKeyDown={(e) => {
                if (e.key === 'Enter') valider();
              }}
            />
          ) : (
            <textarea
              ref={(el) => {
                champRef.current = el;
              }}
              className={`${styles.saisieChamp} ${styles.saisieZone}`}
              value={valeur}
              onChange={(e) => setValeur(e.target.value)}
              placeholder={info.placeholder}
              rows={type === 'vers' ? 10 : 8}
            />
          )}
        </div>

        <div className={styles.saisiePied}>
          <button type="button" className={styles.btnGhost} onClick={onAnnuler}>
            Annuler
          </button>
          <button type="button" className={styles.btnPrimary} onClick={valider}>
            Insérer
          </button>
        </div>
      </div>
    </div>
  );
}
