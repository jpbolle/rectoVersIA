'use client';

// Les mises en œuvre d'une activité, avant d'entrer dans les copies.
//
// Une activité peut resservir d'année en année et viser plusieurs classes à la
// fois. Ouvrir la page sur la liste des élèves mélangeait donc tout le monde —
// la 4C de cette année avec la 4B de l'an dernier. On passe d'abord par les
// sessions, rangées en trois blocs :
//
//   1. l'année en cours, en tête — c'est là qu'on travaille ;
//   2. ce qui est terminé ou archivé, encore à portée mais rangé ;
//   3. les années antérieures, repliées : on va les chercher, elles ne
//      s'imposent pas.
//
// Une seule session ? On ne l'affiche pas : ce serait un clic pour rien. La
// page va droit aux copies (voir la page appelante).

import { useState } from 'react';
import type { Session } from '@/types/session';
import styles from './SessionsListe.module.css';

interface Props {
  sessions: Session[];
  /** Année scolaire en cours, pour trier « cette année » du reste */
  anneeCourante: string;
  /** Copies remises par session, pour l'annoncer sans ouvrir */
  compte: (sessionId: string) => { remises: number; total: number };
  onOuvrir: (session: Session) => void;
  /** Copies qu'aucune classe ne réclame — 0 = on n'en parle pas */
  orphelines?: number;
  onOuvrirOrphelines?: () => void;
}

function Ligne({
  session,
  compte,
  onOuvrir,
}: {
  session: Session;
  compte: Props['compte'];
  onOuvrir: Props['onOuvrir'];
}) {
  const { remises, total } = compte(session.id);
  return (
    <button type="button" className={styles.ligne} onClick={() => onOuvrir(session)}>
      <span className={styles.classe}>🎓 {session.classeNom}</span>
      <span className={styles.compte}>
        {total === 0
          ? 'aucun élève'
          : `${remises}/${total} copie${total > 1 ? 's' : ''} remise${remises > 1 ? 's' : ''}`}
      </span>
      <span className={styles.etats}>
        {session.disponible ? (
          <span className={`${styles.pastille} ${styles.ouverte}`}>Ouverte</span>
        ) : (
          <span className={styles.pastille}>Fermée</span>
        )}
        {session.corrigeDisponible && (
          <span className={`${styles.pastille} ${styles.corrige}`}>Corrigé rendu</span>
        )}
        {session.archive && <span className={styles.pastille}>Archivée</span>}
      </span>
      <span className={styles.chevron} aria-hidden="true">›</span>
    </button>
  );
}

export default function SessionsListe({
  sessions,
  anneeCourante,
  compte,
  onOuvrir,
  orphelines = 0,
  onOuvrirOrphelines,
}: Props) {
  // Les années antérieures sont repliées : elles ne doivent pas occuper
  // l'écran de quelqu'un qui vient corriger la classe d'aujourd'hui.
  const [anterieuresOuvertes, setAnterieuresOuvertes] = useState(false);

  const cetteAnnee = sessions.filter((s) => s.anneeScolaire === anneeCourante && !s.archive);
  const rangees = sessions.filter((s) => s.anneeScolaire === anneeCourante && s.archive);
  const anterieures = sessions.filter((s) => s.anneeScolaire !== anneeCourante);

  return (
    <div className={styles.liste}>
      <section className={styles.bloc}>
        <h3 className={styles.blocTitre}>Sessions de l’année {anneeCourante}</h3>
        {cetteAnnee.length === 0 ? (
          <p className={styles.vide}>Aucune classe ouverte cette année sur cette activité.</p>
        ) : (
          cetteAnnee.map((s) => (
            <Ligne key={s.id} session={s} compte={compte} onOuvrir={onOuvrir} />
          ))
        )}
      </section>

      {rangees.length > 0 && (
        <section className={styles.bloc}>
          <h3 className={styles.blocTitre}>Sessions terminées ou archivées</h3>
          {rangees.map((s) => (
            <Ligne key={s.id} session={s} compte={compte} onOuvrir={onOuvrir} />
          ))}
        </section>
      )}

      {/* Élève supprimé, classe effacée, copie antérieure aux sessions : ces
          travaux existent et doivent rester atteignables. Les taire reviendrait
          à les perdre. */}
      {orphelines > 0 && onOuvrirOrphelines && (
        <section className={styles.bloc}>
          <h3 className={styles.blocTitre}>Copies sans classe</h3>
          <button type="button" className={styles.ligne} onClick={onOuvrirOrphelines}>
            <span className={styles.classe}>📄 Rattachées à aucune classe</span>
            <span className={styles.compte}>
              {orphelines} copie{orphelines > 1 ? 's' : ''}
            </span>
            <span className={styles.chevron} aria-hidden="true">›</span>
          </button>
        </section>
      )}

      {anterieures.length > 0 && (
        <section className={styles.bloc}>
          <button
            type="button"
            className={styles.replie}
            onClick={() => setAnterieuresOuvertes((v) => !v)}
          >
            <span>{anterieuresOuvertes ? '▾' : '▸'}</span>
            Années scolaires antérieures ({anterieures.length})
          </button>
          {anterieuresOuvertes &&
            anterieures.map((s) => (
              <Ligne key={s.id} session={s} compte={compte} onOuvrir={onOuvrir} />
            ))}
        </section>
      )}
    </div>
  );
}
