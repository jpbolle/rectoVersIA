'use client';

// Carte d'une œuvre — même forme que GrilleCard et VocabCard (page Mes
// Ressources). Trois familles de cartes voisines qui se ressembleraient « à
// peu près » donneraient trois pages différentes dans une même page : le
// gabarit est donc repris tel quel, seul le contenu change.
//
// Boutons ICÔNES en bas à droite, avec infobulle au survol — comme ses sœurs.
// Le texte des boutons faisait porter à la carte une ligne d'actions qu'aucune
// autre n'a.

import type { Oeuvre } from '@/types/oeuvre';
import styles from './OeuvreCard.module.css';

interface OeuvreCardProps {
  oeuvre: Oeuvre;
  /** Œuvre de l'utilisateur : il l'édite, la partage, l'archive */
  mienne: boolean;
  /** Œuvre d'un collègue partagée EN CO-ÉDITION : éditable sans être à moi */
  coEditable?: boolean;
  /** Mode de partage dont je bénéficie, pour l'afficher */
  partageRecu?: 'lecture' | 'edition' | null;
  onVoir: (o: Oeuvre) => void;
  onEditer?: (o: Oeuvre) => void;
  onPartager?: (o: Oeuvre) => void;
  onDupliquer: (o: Oeuvre) => void;
  onArchiver?: (o: Oeuvre) => void;
}

function compterSections(o: Oeuvre): number {
  return o.chapitres.reduce((n, c) => n + c.sections.length, 0);
}

export default function OeuvreCard({
  oeuvre,
  mienne,
  coEditable = false,
  partageRecu = null,
  onVoir,
  onEditer,
  onPartager,
  onDupliquer,
  onArchiver,
}: OeuvreCardProps) {
  const sections = compterSections(oeuvre);
  const nbPartages = oeuvre.partages?.length ?? 0;
  const editable = (mienne || coEditable) && !oeuvre.archive;

  return (
    <article className={`${styles.card} ${oeuvre.archive ? styles.cardArchivee : ''}`}>
      {/* Pastilles d'état, en haut à droite — comme les tags UAA des grilles */}
      <div className={styles.tags}>
        {oeuvre.archive && <span className={`${styles.tag} ${styles.tagArchive}`}>Archivée</span>}
        {mienne && nbPartages > 0 && (
          <span className={styles.tag} title={oeuvre.partages!.map((p) => p.nom || p.email).join(', ')}>
            Partagée ×{nbPartages}
          </span>
        )}
        {partageRecu && (
          <span className={`${styles.tag} ${partageRecu === 'edition' ? styles.tagEdition : ''}`}>
            {partageRecu === 'edition' ? 'Co-édition' : 'Lecture seule'}
          </span>
        )}
      </div>

      {/* La couverture remplace l'icône générique quand elle existe : douze
          cartes « 📖 » identiques ne se départagent qu'en lisant les titres,
          alors qu'une gravure se reconnaît d'un coup d'œil. */}
      {oeuvre.couverture ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={oeuvre.couverture.url}
          alt=""
          className={styles.couverture}
        />
      ) : (
        <div className={styles.cardIcon}>📖</div>
      )}
      <h3 className={styles.title}>{oeuvre.titre}</h3>

      {/* L'auteur ne se répète pas s'il est déjà dans le titre
          (« Molière — Anthologie comique ») */}
      {oeuvre.auteur && !oeuvre.titre.toLowerCase().includes(oeuvre.auteur.toLowerCase()) && (
        <p className={styles.auteur}>{oeuvre.auteur}</p>
      )}

      {oeuvre.description && <p className={styles.description}>{oeuvre.description}</p>}

      {!mienne && oeuvre.profName && <p className={styles.profName}>de {oeuvre.profName}</p>}

      <div className={styles.metaRow}>
        <span className={styles.metaItem}>
          <span className={styles.metaIcon}>📚</span>
          <span>{oeuvre.chapitres.length} chapitre{oeuvre.chapitres.length > 1 ? 's' : ''}</span>
        </span>
        <span className={styles.metaItem}>
          <span className={styles.metaIcon}>📄</span>
          <span>{sections} section{sections > 1 ? 's' : ''}</span>
        </span>
      </div>

      <div className={styles.actions}>
        {/* L'œil n'apparaît que sur une œuvre qu'on ne peut PAS éditer : le
            sommaire est la seule façon d'y jeter un coup d'œil avant de la
            dupliquer. Sur les siennes, il faisait double emploi avec ✏️, qui
            ouvre le même sommaire — en modifiable. */}
        {!editable && (
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => onVoir(oeuvre)}
            title="Voir le sommaire"
            aria-label="Voir le sommaire"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>
        )}

        {editable && onEditer && (
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => onEditer(oeuvre)}
            title={coEditable ? 'Éditer (co-édition)' : 'Éditer le contenu'}
            aria-label="Éditer"
          >
            ✏️
          </button>
        )}

        {mienne && !oeuvre.archive && onPartager && (
          <button
            type="button"
            className={`${styles.actionBtn} ${nbPartages > 0 ? styles.actionActive : ''}`}
            onClick={() => onPartager(oeuvre)}
            title={
              nbPartages > 0
                ? `Partagée avec ${nbPartages} collègue${nbPartages > 1 ? 's' : ''} — modifier`
                : 'Partager avec un collègue'
            }
            aria-label="Partager"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}

        <button
          type="button"
          className={styles.actionBtn}
          onClick={() => onDupliquer(oeuvre)}
          title={mienne ? 'Dupliquer l’œuvre' : 'Dupliquer dans mes œuvres'}
          aria-label="Dupliquer"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="4" y="1" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <rect x="1" y="4" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" fill="var(--c-bg-card)" />
          </svg>
        </button>

        {mienne && !oeuvre.archive && onArchiver && (
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionDanger}`}
            onClick={() => onArchiver(oeuvre)}
            title="Archiver l’œuvre"
            aria-label="Archiver"
          >
            🗑️
          </button>
        )}
      </div>
    </article>
  );
}
