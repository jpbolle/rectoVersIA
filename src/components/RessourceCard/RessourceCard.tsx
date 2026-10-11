'use client';

// LA card de Mes Ressources (plan 2026-10-11 « uniformisation des cards ») :
// un seul gabarit pour tous les onglets — celui du Portfolio (emoji dans le
// titre, étiquettes, description, pied à filet avec icônes puis action
// principale, card qui s'ouvre au clic) sur le fond vert « papyrus » des
// cards de grilles (JP).
//
// Icônes lucide, mêmes dessins partout ; ordre fixe des actions : Voir ·
// Partager · Dupliquer · Archiver · Supprimer, puis l'action principale.

import type { ReactNode, MouseEvent, KeyboardEvent } from 'react';
import { Archive, ArchiveRestore, Copy, Eye, Share2, Trash2 } from 'lucide-react';
import styles from './RessourceCard.module.css';

export interface RessourceCardProps {
  /** Emoji ou petit pictogramme, devant le titre */
  icone: ReactNode;
  titre: string;
  /** Petites étiquettes (compteurs, UAA, « Partagée ×2 »…) */
  etiquettes?: ReactNode[];
  /** Une ligne sous les étiquettes (auteur, prof d'origine) */
  sousTitre?: ReactNode;
  description?: ReactNode;
  /** Image en tête (couverture d'œuvre, vignette de schéma) */
  visuel?: ReactNode;
  archivee?: boolean;
  /** Clic sur la card (ouvrir / éditer) ; absent = card inerte */
  onOuvrir?: () => void;
  titreOuvrir?: string;

  onVoir?: () => void;
  onPartager?: () => void;
  partagee?: boolean;
  titrePartager?: string;
  onDupliquer?: () => void;
  onArchiver?: () => void;
  onSupprimer?: () => void;
  /** Bouton texte, en dernier (« Utiliser pour une classe ») */
  principale?: { libelle: string; onClick: () => void };
  /** Card d'un collègue : seule action, « Dupliquer » en texte */
  lectureSeule?: boolean;
  /**
   * Actions propres à un onglet, hors du jeu commun (ex. « Voir les copies »,
   * « Corrigé visible » des activités FLE) : rendues en tête du pied, avant les
   * icônes communes, pour garder l'alignement. Boutons à styler avec
   * `btnIcone` de RessourceCard.module.css et à faire stopper la propagation
   * du clic (sinon la card s'ouvre en plus).
   */
  actionsEnPlus?: ReactNode;
  /** Ce que la card enveloppe en plus (ex. popup propre à l'onglet) */
  children?: ReactNode;
}

export default function RessourceCard({
  icone,
  titre,
  etiquettes,
  sousTitre,
  description,
  visuel,
  archivee,
  onOuvrir,
  titreOuvrir,
  onVoir,
  onPartager,
  partagee,
  titrePartager,
  onDupliquer,
  onArchiver,
  onSupprimer,
  principale,
  lectureSeule,
  actionsEnPlus,
  children,
}: RessourceCardProps) {
  const arreter = (fn: () => void) => (e: MouseEvent) => {
    e.stopPropagation();
    fn();
  };
  const onKey = (e: KeyboardEvent) => {
    if (onOuvrir && e.key === 'Enter' && e.target === e.currentTarget) onOuvrir();
  };
  const icon = (titreBtn: string, fn: () => void, contenu: ReactNode, extra = '') => (
    <button type="button" className={`${styles.btnIcone} ${extra}`} onClick={arreter(fn)} title={titreBtn} aria-label={titreBtn}>
      {contenu}
    </button>
  );

  return (
    <article
      className={`${styles.carte} ${archivee ? styles.carteArchivee : ''} ${onOuvrir ? styles.carteCliquable : ''}`}
      onClick={onOuvrir}
      role={onOuvrir ? 'button' : undefined}
      tabIndex={onOuvrir ? 0 : undefined}
      onKeyDown={onKey}
      title={onOuvrir ? titreOuvrir : undefined}
    >
      {visuel && <div className={styles.visuel}>{visuel}</div>}
      <h3 className={styles.titre}>
        <span className={styles.icone} aria-hidden="true">
          {icone}
        </span>
        <span className={styles.titreTexte}>{titre}</span>
      </h3>
      {sousTitre && <p className={styles.sousTitre}>{sousTitre}</p>}
      {etiquettes && etiquettes.length > 0 && (
        <div className={styles.etiquettes}>
          {etiquettes.map((e, i) => (
            <span key={i}>{e}</span>
          ))}
        </div>
      )}
      <div className={styles.description}>{description}</div>

      <div className={styles.actions}>
        {actionsEnPlus}
        {lectureSeule ? (
          <>
            {onVoir && icon('Voir', onVoir, <Eye size={16} aria-hidden="true" />)}
            {onDupliquer && (
              <button type="button" className={styles.btn} onClick={arreter(onDupliquer)}>
                Dupliquer
              </button>
            )}
          </>
        ) : (
          <>
            {onVoir && icon('Voir', onVoir, <Eye size={16} aria-hidden="true" />)}
            {onPartager &&
              icon(titrePartager ?? 'Partager', onPartager, <Share2 size={16} aria-hidden="true" />, partagee ? styles.btnActif : '')}
            {onDupliquer && icon('Dupliquer', onDupliquer, <Copy size={16} aria-hidden="true" />)}
            {onArchiver &&
              icon(
                archivee ? 'Restaurer' : 'Archiver',
                onArchiver,
                archivee ? <ArchiveRestore size={16} aria-hidden="true" /> : <Archive size={16} aria-hidden="true" />
              )}
            {onSupprimer && icon('Supprimer', onSupprimer, <Trash2 size={16} aria-hidden="true" />, styles.btnDanger)}
            {principale && !archivee && (
              <button type="button" className={styles.btn} onClick={arreter(principale.onClick)}>
                {principale.libelle}
              </button>
            )}
          </>
        )}
      </div>
      {children}
    </article>
  );
}
