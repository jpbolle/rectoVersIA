'use client';

// Carte d'une ACTIVITÉ ou d'une SÉQUENCE dans Mes Ressources › Modules FLE —
// au gabarit des cartes de Mes Ressources (styles d'OeuvreCard, comme
// ModuleFleCard), et non à celui du tableau de bord (demande JP, 2026-09-19 :
// « les cards dans les ressources doivent être similaires »).
//
// Pas d'interrupteurs : l'ouverture d'une séquence aux élèves se règle dans
// Mes Activités (ou par ✏️). Le corrigé d'une activité FLE, lui, n'a pas
// d'autre endroit : il reste un bouton bascule 👁.

import type { Devoir } from '@/types/devoir';
import { atelierLabel } from '@/types/didactique';
import { iconeAtelier } from '@/types/sequence-fle';
import styles from '@/components/OeuvreCard/OeuvreCard.module.css';

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
}

export default function ActiviteRessourceCard({
  devoir,
  onOuvrir,
  onEditer,
  onDupliquer,
  onToggleArchive,
  onToggleCorrigeDisponible,
}: Props) {
  const sequence = devoir.typeTravail === 'sequence';
  const nbEtapes = devoir.sequenceFle?.etapes.length ?? 0;
  // Les boutons ont leur propre geste : ne pas ouvrir la carte en plus
  const action = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  return (
    <article
      className={`${styles.card} ${styles.cardCliquable} ${devoir.archive ? styles.cardArchivee : ''}`}
      onClick={() => onOuvrir(devoir)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && onOuvrir(devoir)}
    >
      <div className={styles.tags}>
        {devoir.archive && <span className={`${styles.tag} ${styles.tagArchive}`}>Archivé</span>}
        {sequence ? (
          <span className={`${styles.tag} ${devoir.disponible ? styles.tagEdition : ''}`}>
            {devoir.disponible ? 'Ouverte' : 'Fermée'}
          </span>
        ) : (
          devoir.corrigeDisponible && <span className={`${styles.tag} ${styles.tagEdition}`}>Corrigé visible</span>
        )}
        <span className={styles.tag}>{devoir.evaluation === 'certificatif' ? 'Certificatif' : 'Formatif'}</span>
      </div>

      <div className={styles.cardIcon}>{iconeAtelier(devoir.atelier)}</div>
      <h3 className={styles.title}>{devoir.intitule}</h3>
      <p className={styles.auteur}>{sequence ? 'Séquence de cours' : atelierLabel(devoir.atelier ?? '')}</p>

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
        <button
          type="button"
          className={styles.actionBtn}
          onClick={action(() => onOuvrir(devoir))}
          title={sequence ? 'Ouvrir la ligne du temps' : 'Voir les copies'}
          aria-label={sequence ? 'Ouvrir la ligne du temps' : 'Voir les copies'}
        >
          {sequence ? '🧭' : '📋'}
        </button>
        <button
          type="button"
          className={styles.actionBtn}
          onClick={action(() => onEditer(devoir))}
          title={sequence ? 'Réglages de la séquence' : 'Modifier'}
          aria-label="Modifier"
        >
          ✏️
        </button>
        {!sequence && onToggleCorrigeDisponible && (
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
          {/* Le même pictogramme que les cartes voisines (ModuleFleCard, OeuvreCard) */}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="4" y="1" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <rect x="1" y="4" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" fill="var(--c-bg-card)" />
          </svg>
        </button>
        <button
          type="button"
          className={`${styles.actionBtn} ${devoir.archive ? '' : styles.actionDanger}`}
          onClick={action(() => onToggleArchive(devoir.id, !devoir.archive))}
          title={devoir.archive ? 'Désarchiver' : 'Archiver'}
          aria-label={devoir.archive ? 'Désarchiver' : 'Archiver'}
        >
          {devoir.archive ? '📤' : '🗑️'}
        </button>
      </div>
    </article>
  );
}
