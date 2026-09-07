'use client';

// ═══ Écran PROF du mode Compétition ═══
//
// Deux colonnes au gabarit de l'écran de correction (`ResizableSplit`, deux
// cartes blanches à en-tête bleu-gris) :
//  - à GAUCHE l'espace de jeu — la question, le chrono, la barre d'actions.
//    C'est cette colonne qui est projetée au tableau ;
//  - à DROITE le pilotage — les questions qu'on peut lancer, et les
//    statistiques de la partie.
//
// Trois moments dans une question, et pas deux :
//   la question court → elle est close (on regarde CE QUE LA CLASSE A RÉPONDU)
//   → le prof RÉVÈLE la bonne réponse.
// Livrer la bonne réponse au coup de sifflet fermerait la seule minute où la
// classe se demande encore qui a raison (demande de JP, 2026-09-07).

import { useState } from 'react';
import ResizableSplit from '@/components/ResizableSplit/ResizableSplit';
import CompetitionQcm from './CompetitionQcm';
import Repartition from './Repartition';
import { QuestionCard } from '@/components/LectureQuizActivity/LectureQuizActivity';
import { useDirect } from '@/hooks/useDirect';
import { LECTURE_TYPE_LABELS } from '@/types/lecture';
import type { LectureQuestionType } from '@/types/lecture';
import styles from './CompetitionPilote.module.css';

type Onglet = 'questions' | 'stats';

export default function CompetitionPilote({ sessionId }: { sessionId: string }) {
  const { vue, motif, sommaire, demarree, reste, avantDepart, isLoading, piloter } = useDirect({
    sessionId,
  });
  const [onglet, setOnglet] = useState<Onglet>('questions');

  // Une carte seule, au même gabarit : rien ne doit flotter nu dans la page.
  const carteSeule = (contenu: React.ReactNode) => (
    <div className={styles.contentSection}>
      <div className={styles.sectionHeader}>
        <h2>Espace de jeu</h2>
      </div>
      <div className={styles.jeu}>{contenu}</div>
    </div>
  );

  if (isLoading) return carteSeule(<p className={styles.vide}>Chargement…</p>);

  if (!vue) {
    // « refuse » : la partie existe mais appartient à quelqu'un d'autre. Le
    // dire évite de chercher une panne qui n'existe pas.
    if (motif === 'refuse') {
      return carteSeule(
        <p className={styles.vide}>Cette partie appartient à un autre professeur.</p>
      );
    }
    return carteSeule(
      <>
        <p className={styles.vide}>Aucune partie ouverte pour cette classe.</p>
        <div className={styles.bottomActions}>
          <span className={styles.bottomActionsLine} />
          <div className={styles.bottomActionsRow}>
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
              onClick={() => piloter('ouvrir')}
            >
              Ouvrir la partie
            </button>
          </div>
          <span className={styles.bottomActionsLine} />
        </div>
      </>
    );
  }

  const q = vue.question;
  const enQuestion = vue.phase === 'question';
  const close = vue.phase === 'resultat';
  const revele = vue.phase === 'revele';
  // Un élément sans chrono (bloc informatif) n'immobilise pas le prof : il le
  // lit, puis il passe.
  const chronometre = enQuestion && vue.chronoSec > 0;
  const libelle: Record<string, string> = LECTURE_TYPE_LABELS;

  // ── Colonne de gauche : l'espace de jeu ──
  const jeu = (
    <div className={styles.contentSection}>
      <div className={styles.sectionHeader}>
        <h2>Espace de jeu</h2>
        {/* Le compteur vit dans l'en-tête : le prof le surveille sans quitter
            la question des yeux. */}
        {vue.compteur && (
          <span className={styles.headerCompteur}>
            {vue.compteur.repondu} / {vue.compteur.attendus}
          </span>
        )}
      </div>

      <div className={styles.jeu}>
        <div className={styles.bandeau}>
          <span className={styles.phase}>
            {vue.phase === 'salle'
              ? 'Salle d’attente'
              : enQuestion
              ? 'En jeu'
              : close
              ? 'Réponses de la classe'
              : revele
              ? 'Corrigé'
              : 'Terminée'}
          </span>
          {vue.numero > 0 && (
            <span>
              Question {vue.numero} / {vue.total}
            </span>
          )}
        </div>

        {avantDepart > 0 && <div className={styles.rebours}>{avantDepart}</div>}

        {chronometre && demarree && (
          <div className={styles.chrono}>
            <span className={`${styles.chronoValeur} ${reste <= 10 ? styles.chronoUrgent : ''}`}>
              {reste}
            </span>
            <div className={styles.chronoBarre}>
              <i style={{ width: `${(reste / vue.chronoSec) * 100}%` }} />
            </div>
          </div>
        )}

        {q && (demarree || close || revele) && (
          <>
            <div className={styles.enonce} dangerouslySetInnerHTML={{ __html: q.enonce }} />

            {/* Le QCM garde SES cases en toutes circonstances : une fois la
                question close, ce sont les pastilles qui s'y posent. C'est la
                règle de JP — la question ne se remplace pas par un graphique. */}
            {q.type === 'qcm' ? (
              <CompetitionQcm
                question={q}
                choisis={[]}
                onChoisir={() => {}}
                ouverte={false}
                revele={revele}
                parChoix={
                  vue.repartition?.forme === 'choix' ? vue.repartition.parChoix : undefined
                }
              />
            ) : close ? (
              <Repartition question={q} data={vue.repartition} />
            ) : (
              q.type !== 'info' && (
                <QuestionCard
                  question={q}
                  number={vue.numero}
                  answer={{}}
                  onAnswerChange={() => {}}
                  disabled
                  onZoomImage={() => {}}
                  showCorrection={revele}
                  autoEvaluation={false}
                  graine={null}
                />
              )
            )}
          </>
        )}

        {vue.phase === 'salle' && (
          <p className={styles.vide}>
            La salle est ouverte. Choisis ta première question dans l’onglet « Questions ».
          </p>
        )}
        {vue.phase === 'finie' && <p className={styles.vide}>Partie terminée.</p>}

        {/* Barre d'actions — forme imposée du projet (`bottomActions`) : un
            trait, les boutons, un trait, sur la MÊME ligne. Verts (agir sur le
            jeu) groupés d'abord, ambres (afficher) ensuite. */}
        <div className={styles.bottomActions}>
          <span className={styles.bottomActionsLine} />
          <div className={styles.bottomActionsRow}>
            {/* « Révéler » EN PREMIER : c'est le geste qu'on cherche quand la
                question vient de se fermer et que la classe attend (JP). */}
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
              onClick={() => piloter('reveler')}
              disabled={!close}
            >
              Révéler les réponses
            </button>
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
              onClick={() => piloter('lancer')}
              disabled={chronometre || vue.phase === 'finie'}
            >
              {vue.numero === 0 ? 'Lancer la première question' : 'Question suivante'}
            </button>
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
              onClick={() => piloter('stopper')}
              disabled={!chronometre}
            >
              Arrêter la question
            </button>
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.actionBtnAmber}`}
              onClick={() => piloter('terminer')}
              disabled={vue.phase === 'finie'}
            >
              Arrêter la partie
            </button>
          </div>
          <span className={styles.bottomActionsLine} />
        </div>
      </div>
    </div>
  );

  // ── Colonne de droite : le pilotage ──
  const panneau = (
    <div className={styles.evaluationSection}>
      <div className={styles.sectionHeader}>
        <h2>Pilotage de la partie</h2>
      </div>

      <div className={styles.assistanceWrapper}>
        <div className={styles.onglets}>
          <button
            type="button"
            className={`${styles.onglet} ${onglet === 'questions' ? styles.ongletActif : ''}`}
            onClick={() => setOnglet('questions')}
          >
            Questions
          </button>
          <button
            type="button"
            className={`${styles.onglet} ${onglet === 'stats' ? styles.ongletActif : ''}`}
            onClick={() => setOnglet('stats')}
          >
            Statistiques
          </button>
        </div>

        <div className={styles.ongletContenu}>
          {onglet === 'questions' ? (
            <ul className={styles.sommaire}>
              {sommaire.map((item) => {
                const posee = (vue.posees ?? []).includes(item.index);
                const encours = vue.questionIndex === item.index && vue.phase !== 'finie';
                return (
                  <li key={item.index}>
                    <button
                      type="button"
                      className={`${styles.ligne} ${posee ? styles.posee : ''} ${
                        encours ? styles.encours : ''
                      }`}
                      onClick={() => piloter('lancer', { index: item.index })}
                      disabled={encours && enQuestion}
                      title={
                        posee ? 'Déjà posée — cliquez pour la reposer' : 'Poser cette question'
                      }
                    >
                      <span className={styles.rang}>{item.numero ?? 'ℹ'}</span>
                      <span className={styles.apercu}>{item.apercu}</span>
                      <span className={styles.typeTag}>
                        {libelle[item.type as LectureQuestionType] ?? item.type}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className={styles.stats}>
              <div className={styles.statLigne}>
                <span>Questions posées</span>
                <span className={styles.statValeur}>
                  {(vue.posees ?? []).length} / {vue.total}
                </span>
              </div>
              <div className={styles.statLigne}>
                <span>Réponses à la question en cours</span>
                <span className={styles.statValeur}>
                  {vue.compteur ? `${vue.compteur.repondu} / ${vue.compteur.attendus}` : '—'}
                </span>
              </div>
              {/* Le détail — qui répond vite et faux, le podium, le classement —
                  est le sujet des étapes 4 et 5. On ne met pas ici un chiffre
                  qu'on ne sait pas encore calculer. */}
              <p className={styles.vide}>
                Le score, le podium et le détail par élève arrivent à l’étape suivante.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return <ResizableSplit storageKey="competition-split" left={jeu} right={panneau} />;
}
