'use client';

// Carte d'une ACTIVITÉ FLE (Mes ressources FLE) ou d'une SÉQUENCE (tableau de
// bord, espace FLE) — au GABARIT de la carte d'activité du tableau de bord
// (DevoirCard) : titre et étiquettes à gauche, boutons en bas à droite.
// Remplace le gabarit « Ressources » (OeuvreCard) du 2026-09-19 : JP veut
// partout le design des cartes d'activités classiques (2026-10-09).
//
// Pas d'interrupteurs : l'ouverture d'une séquence aux élèves se règle dans
// Mes Activités (ou par ✏️). Le corrigé d'une activité FLE, lui, n'a pas
// d'autre endroit : il reste un bouton bascule 👁.

import type { Devoir } from '@/types/devoir';
import { atelierLabel } from '@/types/didactique';
import { iconeAtelier } from '@/types/sequence-fle';
import styles from './ActiviteRessourceCard.module.css';

interface Props {
  devoir: Devoir;
  // Clic sur la carte et bouton principal : les copies d'une activité,
  // l'atelier d'une séquence
  onOuvrir: (d: Devoir) => void;
  onEditer: (d: Devoir) => void;
  onDupliquer: (d: Devoir) => void;
  onToggleArchive: (id: string, archive: boolean) => void;
  // Activité FLE seulement
  onToggleCorrigeDisponible?: (id: string, corrigeDisponible: boolean) => void;
  // Activité d'un COLLÈGUE (bloc « des professeurs ») : on la lit, on la duplique, rien d'autre
  lectureSeule?: boolean;
}

export default function ActiviteRessourceCard({
  devoir,
  onOuvrir,
  onEditer,
  onDupliquer,
  onToggleArchive,
  onToggleCorrigeDisponible,
  lectureSeule = false,
}: Props) {
  const sequence = devoir.typeTravail === 'sequence';
  const nbEtapes = devoir.sequenceFle?.etapes.length ?? 0;
  const certificatif = devoir.evaluation === 'certificatif';
  // Les boutons ont leur propre geste : ne pas ouvrir la carte en plus
  const action = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  return (
    <article
      className={`${styles.card} ${lectureSeule ? '' : styles.cardCliquable} ${devoir.archive ? styles.cardArchivee : ''}`}
      onClick={() => !lectureSeule && onOuvrir(devoir)}
      role={lectureSeule ? undefined : 'button'}
      tabIndex={lectureSeule ? undefined : 0}
      onKeyDown={(e) => !lectureSeule && e.key === 'Enter' && e.target === e.currentTarget && onOuvrir(devoir)}
    >
      {/* Titre, type et étiquettes sur une ligne — comme la carte d'activité */}
      <div className={styles.titreLigne}>
        <h3 className={styles.title}>
          <span className={styles.picto} aria-hidden="true">{iconeAtelier(devoir.atelier)}</span>
          {devoir.intitule}
        </h3>
        <span className={styles.tagType}>{sequence ? 'Séquence' : atelierLabel(devoir.atelier ?? '', true)}</span>
        <span className={`${styles.tag} ${certificatif ? styles.tagCertificatif : ''}`}>
          {certificatif ? 'Certificatif' : 'Formatif'}
        </span>
        {sequence ? (
          <span className={devoir.disponible ? styles.tagEdition : styles.tag}>
            {devoir.disponible ? 'Ouverte' : 'Fermée'}
          </span>
        ) : (
          devoir.corrigeDisponible && <span className={styles.tagEdition}>Corrigé visible</span>
        )}
        {devoir.archive && <span className={styles.tagArchive}>Archivé</span>}
      </div>

      <div className={styles.metaRow}>
        {sequence ? (
          <>
            <span className={styles.metaItem}>
              <span className={styles.metaIcon}>🎓</span>
              <span>{devoir.classes.length ? devoir.classes.join(', ') : 'aucune classe'}</span>
            </span>
            <span className={styles.metaItem}>
              <span className={styles.metaIcon}>🪜</span>
              <span>
                {nbEtapes} étape{nbEtapes > 1 ? 's' : ''}
              </span>
            </span>
          </>
        ) : (
          <span className={styles.metaItem}>
            <span className={styles.metaIcon}>📥</span>
            <span>
              {devoir.submittedCount ?? 0} copie{(devoir.submittedCount ?? 0) > 1 ? 's remises' : ' remise'}
            </span>
          </span>
        )}
      </div>

      <div className={styles.actions}>
        {!lectureSeule && (
        <button
          type="button"
          className={styles.actionBtn}
          onClick={action(() => onOuvrir(devoir))}
          title={sequence ? 'Ouvrir la ligne du temps' : 'Voir les copies'}
          aria-label={sequence ? 'Ouvrir la ligne du temps' : 'Voir les copies'}
        >
          {sequence ? '🧭' : '📋'}
        </button>
        )}
        {!lectureSeule && (
        <button
          type="button"
          className={styles.actionBtn}
          onClick={action(() => onEditer(devoir))}
          title={sequence ? 'Réglages de la séquence' : 'Modifier'}
          aria-label="Modifier"
        >
          ✏️
        </button>
        )}
        {!lectureSeule && !sequence && onToggleCorrigeDisponible && (
          <button
            type="button"
            className={`${styles.actionBtn} ${devoir.corrigeDisponible ? styles.actionActive : ''}`}
            onClick={action(() => onToggleCorrigeDisponible(devoir.id, !devoir.corrigeDisponible))}
            title={devoir.corrigeDisponible ? 'Corrigé visible des élèves — cliquer pour le masquer' : 'Corrigé masqué — cliquer pour le rendre visible'}
            aria-label="Corrigé visible"
            aria-pressed={devoir.corrigeDisponible}
          >
            👁
          </button>
        )}
        <button
          type="button"
          className={styles.actionBtn}
          onClick={action(() => onDupliquer(devoir))}
          title="Dupliquer"
          aria-label="Dupliquer"
        >
          {/* Le même pictogramme que la carte d'activité */}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="4" y="1" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <rect x="1" y="4" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" fill="var(--c-bg-card)" />
          </svg>
        </button>
        {!lectureSeule && (
        <button
          type="button"
          className={`${styles.actionBtn} ${devoir.archive ? '' : styles.actionDanger}`}
          onClick={action(() => onToggleArchive(devoir.id, !devoir.archive))}
          title={devoir.archive ? 'Désarchiver' : 'Archiver'}
          aria-label={devoir.archive ? 'Désarchiver' : 'Archiver'}
        >
          {devoir.archive ? '📤' : '🗑️'}
        </button>
        )}
      </div>
    </article>
  );
}
