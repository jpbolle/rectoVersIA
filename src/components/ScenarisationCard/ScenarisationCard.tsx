'use client';

// La carte d'un parcours (une scénarisation = un cours), sur le gabarit de
// GrilleCard et OeuvreCard : les trois onglets de Mes Ressources s'ouvrent du
// même geste, et se lisent de la même manière.
//
// Ce qu'elle annonce est ce qui distingue un parcours d'un autre : les classes
// qui le suivent, son volume, et le nombre de certifications qu'il porte.

import {
  certificationsDe,
  capacitePeriode,
  periodesPlanifiees,
  PERIODES_ANNEE,
} from '@/types/scenarisation';
import type { Scenarisation } from '@/types/scenarisation';
import styles from './ScenarisationCard.module.css';

interface Props {
  scenarisation: Scenarisation;
  onOpen: (scen: Scenarisation) => void;
  onDuplicate: (scen: Scenarisation) => void;
  onDelete: (scen: Scenarisation) => void;
}

export default function ScenarisationCard({
  scenarisation,
  onOpen,
  onDuplicate,
  onDelete,
}: Props) {
  const modules = scenarisation.chapitres.reduce((s, c) => s + c.modules.length, 0);
  const certifs = certificationsDe(scenarisation).length;
  const planifie = PERIODES_ANNEE.reduce((s, p) => s + periodesPlanifiees(scenarisation, p.id), 0);
  const capacite = PERIODES_ANNEE.reduce((s, p) => s + capacitePeriode(scenarisation, p.id), 0);
  const classes = scenarisation.classes ?? [];

  return (
    <article
      className={styles.card}
      onClick={() => onOpen(scenarisation)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(scenarisation)}
      title="Ouvrir ce parcours"
    >
      {classes.length > 0 && (
        <div className={styles.classeTags}>
          {classes.map((c) => (
            <span key={c} className={styles.classeTag}>
              {c}
            </span>
          ))}
        </div>
      )}

      <div className={styles.cardIcon}>🧭</div>
      <h3 className={styles.title}>{scenarisation.nom}</h3>

      {/* « Français — 4e générale » revient chaque année : c'est l'année qui
          distingue deux cartes de même nom. */}
      <p className={styles.annee}>{scenarisation.anneeScolaire}</p>

      <p className={styles.description}>
        {scenarisation.chapitres.length} chapitre
        {scenarisation.chapitres.length > 1 ? 's' : ''} · {modules} module
        {modules > 1 ? 's' : ''}
      </p>

      <div className={styles.metaRow}>
        <span className={styles.metaItem}>
          <span className={styles.metaIcon}>⏱</span>
          <span>
            {planifie}/{capacite} pér.
          </span>
        </span>
        <span className={styles.metaItem}>
          <span className={styles.metaIcon}>⭐</span>
          <span>
            {certifs} certification{certifs > 1 ? 's' : ''}
          </span>
        </span>
      </div>

      {/* Même icône, même place que sur GrilleCard et OeuvreCard : dupliquer
          se cherche au même endroit dans les trois onglets. */}
      <button
        className={styles.duplicateButton}
        onClick={(e) => {
          e.stopPropagation();
          onDuplicate(scenarisation);
        }}
        title="Dupliquer le parcours (préparer l’année suivante)"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="4" y="1" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <rect x="1" y="4" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" fill="white" />
        </svg>
      </button>

      {/* Le crayon OUVRE le parcours — comme sur GrilleCard, où il ouvre le
          constructeur. Le nom se change ensuite sur place, dans le bandeau du
          parcours : aucune popup ne s'interpose. */}
      <button
        className={styles.editButton}
        onClick={(e) => {
          e.stopPropagation();
          onOpen(scenarisation);
        }}
        title="Ouvrir et modifier le parcours"
      >
        ✏️
      </button>

      <button
        className={styles.deleteButton}
        onClick={(e) => {
          e.stopPropagation();
          onDelete(scenarisation);
        }}
        title="Supprimer le parcours"
      >
        🗑️
      </button>
    </article>
  );
}
