'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Toggle from '@/components/Toggle/Toggle';
import SessionsModal from '@/components/SessionsModal/SessionsModal';
import { formatDateShort } from '@/lib/devoir-utils';
import { atelierLabel, atelierParDispositif, estSondage } from '@/types/didactique';
import type { Dispositif } from '@/types/didactique';
import type { Devoir } from '@/types/devoir';
import styles from './DevoirCard.module.css';

interface DevoirCardProps {
  devoir: Devoir;
  variant: 'prof' | 'student';
  onEdit?: (devoir: Devoir) => void;
  onDelete?: (devoir: Devoir) => void;
  onDuplicate?: (devoir: Devoir) => void;
  onToggleDisponible?: (id: string, disponible: boolean) => void;
  onToggleArchive?: (id: string, archive: boolean) => void;
  onToggleCorrige?: (id: string, corrige: boolean) => void;
  onToggleCorrigeDisponible?: (id: string, corrigeDisponible: boolean) => void;
}

export default function DevoirCard({
  devoir,
  variant,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleDisponible,
  onToggleArchive,
  onToggleCorrige,
  onToggleCorrigeDisponible,
}: DevoirCardProps) {
  const router = useRouter();
  const [sessionsOuvertes, setSessionsOuvertes] = useState(false);
  const estCompetition = devoir.lectureQuiz?.mode === 'competition';
  // Le SONDAGE se joue en direct comme la compétition : mêmes gestes sur la
  // carte (pas d'échéance, pas de copies, l'ouverture passe par la partie).
  const sondage = estSondage(devoir);
  const enDirect = estCompetition || sondage;
  // Activité FLE : sans classe et toujours fermée — seule une séquence FLE
  // l'ouvre. « Disponible » n'a donc pas de sens sur sa carte.
  const fle = devoir.referentiel === 'fle';

  // Le type d'activité, en un mot. Un sondage et une compétition sont deux
  // usages d'un même atelier : ils se nomment eux-mêmes, sinon ils passeraient
  // tous deux pour une simple « Lecture ».
  const libelleAtelier = sondage
    ? 'Sondage'
    : estCompetition
      ? 'Compétition'
      : atelierLabel(
          devoir.atelier || atelierParDispositif(devoir.typeTravail as Dispositif).id,
          true
        );

  const handleToggleDisponible = (value: boolean) => {
    onToggleDisponible?.(devoir.id, value);
  };

  const handleToggleArchive = (value: boolean) => {
    onToggleArchive?.(devoir.id, value);
  };

  const handleToggleCorrige = (value: boolean) => {
    onToggleCorrige?.(devoir.id, value);
  };

  const handleToggleCorrigeDisponible = (value: boolean) => {
    onToggleCorrigeDisponible?.(devoir.id, value);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(devoir);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(devoir);
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDuplicate?.(devoir);
  };

  const handleCardClick = () => {
    if (variant === 'student') {
      router.push(`/activites/${devoir.id}`);
    } else if (variant === 'prof') {
      router.push(`/dashboard/travaux/${devoir.id}`);
    }
  };

  return (
    <article
      className={`${styles.card} ${styles.cardClickable}`}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleCardClick()}
    >
      {/* ── Le titre et ses étiquettes, sur la même ligne ──
          Ce qui NOMME l'activité se lit d'un bloc : son intitulé, son type
          (écriture, lecture, œuvre…) et sa nature (formatif / certificatif).
          Le reste — grille, échéance, classes — vient juste en dessous.
          ⚠ Plus d'étiquette « Voc » : le type le dit déjà, elle faisait
          doublon (signalé par JP le 2026-09-20). */}
      <div className={styles.titreLigne}>
        <h3 className={styles.title}>{devoir.intitule}</h3>
        <span className={styles.atelierTag}>{libelleAtelier}</span>
        {devoir.evaluation && (
          <span
            className={
              devoir.evaluation === 'certificatif'
                ? styles.evalTagCertificatif
                : styles.evalTagFormatif
            }
          >
            {devoir.evaluation === 'certificatif' ? 'Certificatif' : 'Formatif'}
          </span>
        )}
      </div>

      {devoir.uaa && devoir.uaa.length > 0 && devoir.typeTravail !== 'vocabulaire' && (
        <div className={styles.uaaTags}>
          {devoir.uaa.map((n) => (
            <span key={n} className={styles.uaaTag}>UAA {n}</span>
          ))}
        </div>
      )}

      {/* Passerelle en retour : l'activité fait partie d'une scénarisation */}
      {devoir.scenarisationRef && (
        <div className={styles.scenarisationRow} title="Cette activité est rattachée à un module">
          🧭 {devoir.scenarisationRef.nom}
        </div>
      )}

      <div className={styles.metaRow}>
        {/* La grille d'évaluation. Une activité qui n'en a pas (vocabulaire,
            recherche…) n'affiche pas une icône suivie de rien. */}
        {devoir.grille && (
          <span className={styles.metaItem}>
            <span className={styles.metaIcon}>📚</span>
            <span>{devoir.grille}</span>
          </span>
        )}
        {/* Une partie n'a pas d'échéance : elle a une heure de cours. */}
        {!enDirect && (
          <span className={styles.metaItem}>
            <span className={styles.metaIcon}>📅</span>
            <span>{formatDateShort(devoir.dateRemise)}</span>
          </span>
        )}
        <span className={styles.metaItem}>
          <span className={styles.metaIcon}>🎓</span>
          <span>
            {fle
              ? 'ouverte par les séquences FLE'
              : devoir.classes.length
                ? devoir.classes.join(', ')
                : 'aucune classe'}
          </span>
        </span>
        {/* Rien ne se « remet » en compétition : les réponses vivent dans la
            manche, et le compteur afficherait 0 pour toujours. Ce qu'on veut
            voir — qui a joué, qui a répondu — est le sujet de l'onglet
            Statistiques (étape 5). */}
        {variant === 'prof' && !enDirect && devoir.submittedCount !== undefined && (
          <span className={styles.metaItem}>
            <span className={styles.metaIcon}>📥</span>
            <span>
              {devoir.submittedCount} {devoir.submittedCount > 1 ? 'copies remises' : 'copie remise'}
            </span>
          </span>
        )}
      </div>

      {variant === 'prof' && (
        <div className={styles.togglesSection} onClick={(e) => e.stopPropagation()}>
          <div className={styles.toggleRow}>
            {/* En COMPÉTITION, « Travail disponible » disparaît : c'est
                « Ouvrir la partie » qui donne l'accès à la classe. Deux gestes
                pour une seule intention, c'était le piège assuré — une partie
                lancée sur une activité fermée tourne dans le vide, et ça se
                découvre en classe devant vingt-quatre élèves. */}
            {!enDirect && !fle && (
              <Toggle
                checked={devoir.disponible}
                onChange={handleToggleDisponible}
                labelOn="Travail disponible"
                labelOff="Travail non disponible"
              />
            )}
            {/* ⚠ Le corrigé ne se règle PLUS depuis la carte pour une activité
                ordinaire : il s'ouvre classe par classe, depuis la page des
                copies, là où l'on vient justement de corriger (demande JP,
                2026-09-20). Un drapeau qui livrait le corrigé à toutes les
                classes d'un coup était plus dangereux que commode.
                La COMPÉTITION garde le sien : il n'y dit pas la même chose —
                après la partie, l'élève rouvre son activité et revoit les
                questions avec les réponses. */}
            {estCompetition && (
              <Toggle
                checked={devoir.corrigeDisponible}
                onChange={handleToggleCorrigeDisponible}
                labelOn="Relecture ouverte"
                labelOff="Relecture fermée"
              />
            )}
          </div>
          {/* Les bascules ci-dessus valent pour TOUTES les classes — c'est le
              geste courant, et il reste à un clic. Ce lien n'apparaît que
              lorsqu'il y a plusieurs classes à dissocier : ouvrir le corrigé
              de celle qui a fini sans le livrer à celle qui passe demain. */}
          {/* En COMPÉTITION, ce lien est le chemin vers la partie : il s'affiche
              même avec une seule classe, puisqu'on joue toujours AVEC une
              classe donnée. Ailleurs il ne sert qu'à dissocier, donc à partir
              de deux. */}
          {(devoir.classes.length > 1 || enDirect) && (
            <div className={styles.toggleRow}>
              <button
                type="button"
                className={styles.sessionsLink}
                onClick={() => setSessionsOuvertes(true)}
              >
                {sondage
                  ? '📊 Lancer le sondage'
                  : estCompetition
                  ? '🏁 Lancer une partie'
                  : '🎓 Régler classe par classe'}
              </button>
            </div>
          )}
          <div className={styles.toggleRow}>
            <Toggle
              checked={devoir.corrige}
              onChange={handleToggleCorrige}
              labelOn="Travail classé"
              labelOff="Classer le travail corrigé"
            />
            <Toggle
              checked={devoir.archive}
              onChange={handleToggleArchive}
              labelOn="Archivé"
              labelOff="Archiver le travail"
            />
          </div>
        </div>
      )}

      {variant === 'student' && (
        <div className={styles.statusWrapper}>
          {devoir.corrigeDisponible ? (
            <span className={`${styles.statusBadge} ${styles.statusBadgeCorrige}`}>Corrigé disponible</span>
          ) : (
            <span className={styles.statusBadge}>À réaliser</span>
          )}
        </div>
      )}

      {variant === 'prof' && devoir.accesIA && (
        <div className={styles.iaBadge}>
          <span>🤖</span>
          <span>IA active</span>
        </div>
      )}

      {sessionsOuvertes && (
        <SessionsModal
          devoirId={devoir.id}
          intitule={devoir.intitule}
          // Une partie se joue avec UNE classe : le bouton « Jouer » vit donc
          // sur la session, jamais sur la carte.
          competition={estCompetition}
          sondage={sondage}
          onClose={() => setSessionsOuvertes(false)}
        />
      )}

      {variant === 'prof' && (
        <button
          className={styles.editButton}
          onClick={handleEdit}
          title="Modifier le devoir"
        >
          ✏️
        </button>
      )}

      {variant === 'prof' && (
        <button
          className={styles.duplicateButton}
          onClick={handleDuplicate}
          title="Dupliquer le devoir"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="1" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            <rect x="1" y="4" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" fill="white"/>
          </svg>
        </button>
      )}

      {variant === 'prof' && (
        <button
          className={styles.deleteButton}
          onClick={handleDelete}
          title="Supprimer le devoir"
        >
          🗑️
        </button>
      )}
    </article>
  );
}
