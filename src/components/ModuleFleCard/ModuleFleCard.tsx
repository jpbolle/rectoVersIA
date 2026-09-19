'use client';

// Carte d'un module FLE — même gabarit que GrilleCard, VocabCard et OeuvreCard
// (page Mes Ressources) : les styles sont ceux d'OeuvreCard, seul le contenu
// change. Pastilles niveau + compétences en haut à droite, icône du type,
// compteurs, rangée d'actions en icônes.

import { compterRessources, iconeTypeModule, introductionVide } from '@/types/module-fle';
import type { ModuleFle } from '@/types/module-fle';
import { useDidactiqueFle } from '@/hooks/useDidactiqueFle';
import { competenceLabel, niveauLabel, typeModuleLabel } from '@/types/didactique-fle';
import styles from '@/components/OeuvreCard/OeuvreCard.module.css';

interface Props {
  module: ModuleFle;
  mienne: boolean;
  isAdmin?: boolean;
  onEditer?: (m: ModuleFle) => void;
  onVoir?: (m: ModuleFle) => void;
  onDupliquer: (m: ModuleFle) => void;
  onArchiver?: (m: ModuleFle) => void;
  onTogglePartage?: (m: ModuleFle) => void;
}

export default function ModuleFleCard({
  module,
  mienne,
  isAdmin,
  onEditer,
  onVoir,
  onDupliquer,
  onArchiver,
  onTogglePartage,
}: Props) {
  const { config } = useDidactiqueFle();
  const editable = mienne && !module.archive;
  const nbRessources = compterRessources(module.ressources);

  return (
    <article className={`${styles.card} ${module.archive ? styles.cardArchivee : ''}`}>
      <div className={styles.tags}>
        {module.archive && <span className={`${styles.tag} ${styles.tagArchive}`}>Archivé</span>}
        {module.niveau && <span className={`${styles.tag} ${styles.tagEdition}`}>{niveauLabel(config, module.niveau)}</span>}
        {module.competences.slice(0, 2).map((c) => (
          <span key={c} className={styles.tag}>
            {competenceLabel(config, c)}
          </span>
        ))}
        {module.competences.length > 2 && (
          <span className={styles.tag} title={module.competences.map((c) => competenceLabel(config, c)).join(', ')}>
            +{module.competences.length - 2}
          </span>
        )}
      </div>

      <div className={styles.cardIcon}>{iconeTypeModule(module.type)}</div>
      <h3 className={styles.title}>{module.titre}</h3>
      {module.type && <p className={styles.auteur}>{typeModuleLabel(config, module.type)}</p>}
      {module.description && <p className={styles.description}>{module.description}</p>}
      {!mienne && module.profName && <p className={styles.profName}>de {module.profName}</p>}

      <div className={styles.metaRow}>
        <span className={styles.metaItem}>
          <span className={styles.metaIcon}>✍️</span>
          <span>{introductionVide(module.introduction) ? 'sans introduction' : 'introduction'}</span>
        </span>
        <span className={styles.metaItem}>
          <span className={styles.metaIcon}>📎</span>
          <span>
            {nbRessources} ressource{nbRessources > 1 ? 's' : ''}
          </span>
        </span>
      </div>

      <div className={styles.actions}>
        {!editable && onVoir && (
          <button type="button" className={styles.actionBtn} onClick={() => onVoir(module)} title="Voir" aria-label="Voir">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>
        )}

        {editable && onEditer && (
          <button type="button" className={styles.actionBtn} onClick={() => onEditer(module)} title="Modifier" aria-label="Modifier">
            ✏️
          </button>
        )}

        {mienne && isAdmin && onTogglePartage && (
          <button
            type="button"
            className={`${styles.actionBtn} ${module.shared ? styles.actionActive : ''}`}
            onClick={() => onTogglePartage(module)}
            title={module.shared ? 'Retirer des exemples partagés' : 'Proposer comme exemple à tous'}
            aria-label="Partager comme exemple"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}

        <button type="button" className={styles.actionBtn} onClick={() => onDupliquer(module)} title={mienne ? 'Dupliquer' : 'Dupliquer dans mes points de théorie'} aria-label="Dupliquer">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="4" y="1" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <rect x="1" y="4" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" fill="var(--c-bg-card)" />
          </svg>
        </button>

        {editable && onArchiver && (
          <button type="button" className={`${styles.actionBtn} ${styles.actionDanger}`} onClick={() => onArchiver(module)} title="Archiver" aria-label="Archiver">
            🗑️
          </button>
        )}
      </div>
    </article>
  );
}
