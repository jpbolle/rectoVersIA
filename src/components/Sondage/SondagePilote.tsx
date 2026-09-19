'use client';

// ═══ Écran PROF du SONDAGE en direct ═══
//
// Même gabarit que la compétition (`CompetitionPilote`) : deux colonnes, la
// question projetée à gauche, le pilotage à droite (Questions / Statistiques).
// Il en reprend les styles tels quels — un second gabarit divergerait.
//
// Ce qui change : deux moments par question et non trois (la question court,
// puis on regarde ce que la classe a répondu — il n'y a rien à révéler), pas
// de score, pas de podium, et AUCUN NOM nulle part : l'onglet Statistiques
// montre des répartitions, jamais qui a dit quoi.

import { useState } from 'react';
import ResizableSplit from '@/components/ResizableSplit/ResizableSplit';
import { AutoEvalReponse } from '@/components/AutoEvalActivity/AutoEvalActivity';
import SondageRepartition from './SondageRepartition';
import { useDirect } from '@/hooks/useDirect';
import { AUTOEVAL_TYPE_LABELS } from '@/types/autoevaluation';
import type { AutoEvalQuestionType } from '@/types/autoevaluation';
import type { SondageVue } from '@/types/manche';
import styles from '@/components/Competition/CompetitionPilote.module.css';
import propres from './SondagePilote.module.css';

type Onglet = 'questions' | 'stats';

export default function SondagePilote({ sessionId }: { sessionId: string }) {
  const { vue, motif, sommaire, demarree, reste, avantDepart, isLoading, piloter } =
    useDirect<SondageVue>({ sessionId, base: '/api/sondage' });
  const [onglet, setOnglet] = useState<Onglet>('questions');

  const carteSeule = (contenu: React.ReactNode) => (
    <div className={styles.contentSection}>
      <div className={styles.sectionHeader}>
        <h2>Sondage</h2>
      </div>
      <div className={styles.jeu}>{contenu}</div>
    </div>
  );

  if (isLoading) return carteSeule(<p className={styles.vide}>Chargement…</p>);

  if (!vue) {
    if (motif === 'refuse') {
      return carteSeule(
        <p className={styles.vide}>Ce sondage appartient à un autre professeur.</p>
      );
    }
    return carteSeule(
      <>
        <p className={styles.vide}>Aucun sondage ouvert pour cette classe.</p>
        <div className={styles.bottomActions}>
          <span className={styles.bottomActionsLine} />
          <div className={styles.bottomActionsRow}>
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
              onClick={() => piloter('ouvrir')}
            >
              Ouvrir le sondage
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
  const finie = vue.phase === 'finie';
  const info = q?.type === 'info';
  // Une question sans chrono (ou un bloc informatif) reste ouverte jusqu'à ce
  // que le prof la ferme : le bouton « Arrêter la question » sert à ça.
  const chronometre = enQuestion && vue.chronoSec > 0;
  const libelle: Record<string, string> = AUTOEVAL_TYPE_LABELS;
  const bilan = vue.bilan ?? [];

  // ── Colonne de gauche : ce que la classe voit ──
  const jeu = (
    <div className={styles.contentSection}>
      <div className={styles.sectionHeader}>
        <h2>Sondage</h2>
        {/* Pendant une question : qui a répondu, sur ceux qui JOUENT. Entre
            deux questions (salle d'attente comprise) : qui est connecté. */}
        {vue.compteur ? (
          <span className={styles.headerCompteur}>
            {vue.compteur.repondu} / {vue.compteur.attendus} ont répondu
          </span>
        ) : vue.presents !== undefined ? (
          <span className={styles.headerCompteur}>
            {vue.presents} connecté{vue.presents > 1 ? 's' : ''}
          </span>
        ) : null}
      </div>

      <div className={styles.jeu}>
        <div className={styles.bandeau}>
          <span className={styles.phase}>
            {vue.phase === 'salle'
              ? 'Salle d’attente'
              : enQuestion
              ? 'Question ouverte'
              : close
              ? 'Réponses de la classe'
              : 'Terminé'}
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

        {q && (demarree || close) && (
          <>
            {info ? (
              <div className={propres.info}>{q.enonce}</div>
            ) : (
              <>
                <div className={styles.enonce}>
                  <p>{q.enonce}</p>
                </div>
                {close ? (
                  <SondageRepartition question={q} data={vue.repartition} />
                ) : (
                  // La question telle que l'élève la voit, en lecture seule :
                  // la classe la lit au tableau pendant qu'elle répond.
                  <div className={propres.apercu}>
                    <AutoEvalReponse question={q} answer={{}} onChange={() => {}} disabled />
                  </div>
                )}
              </>
            )}
          </>
        )}

        {vue.phase === 'salle' && (
          <p className={styles.vide}>
            La salle est ouverte. Choisis ta première question dans l’onglet « Questions ».
          </p>
        )}
        {finie && <p className={styles.vide}>Sondage terminé. Les réponses restent lisibles dans l’onglet « Statistiques ».</p>}

        {/* Barre d'actions — forme imposée : un trait, les boutons, un trait.
            Verts = agir sur le sondage ; ambre = l'arrêter. */}
        <div className={styles.bottomActions}>
          <span className={styles.bottomActionsLine} />
          <div className={styles.bottomActionsRow}>
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
              onClick={() => piloter('lancer')}
              disabled={chronometre || finie}
            >
              {vue.numero === 0 && vue.phase === 'salle' ? 'Lancer la première question' : 'Question suivante'}
            </button>
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
              onClick={() => piloter('stopper')}
              disabled={!enQuestion}
            >
              Arrêter la question
            </button>
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.actionBtnAmber}`}
              onClick={() => piloter('terminer')}
              disabled={finie}
            >
              Arrêter le sondage
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
        <h2>Pilotage du sondage</h2>
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
                const encours = vue.questionIndex === item.index && !finie;
                return (
                  <li key={item.index}>
                    <button
                      type="button"
                      className={`${styles.ligne} ${posee ? styles.posee : ''} ${
                        encours ? styles.encours : ''
                      }`}
                      onClick={() => piloter('lancer', { index: item.index })}
                      disabled={encours && enQuestion}
                      title={posee ? 'Déjà posée — cliquez pour la reposer' : 'Poser cette question'}
                    >
                      <span className={styles.rang}>{item.numero ?? 'ℹ'}</span>
                      <span className={styles.apercu}>{item.apercu}</span>
                      <span className={styles.typeTag}>
                        {libelle[item.type as AutoEvalQuestionType] ?? item.type}
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
                  {(vue.posees ?? []).length} / {sommaire.length || '—'}
                </span>
              </div>
              <div className={styles.statLigne}>
                <span>Réponses à la question en cours</span>
                <span className={styles.statValeur}>
                  {vue.compteur ? `${vue.compteur.repondu} / ${vue.compteur.attendus}` : '—'}
                </span>
              </div>

              {/* Le BILAN : chaque question posée et sa répartition. C'est la
                  trace du sondage — et elle ne porte aucun nom. */}
              {bilan.length === 0 ? (
                <p className={styles.vide}>
                  Les réponses de la classe apparaissent ici, question par question, dès que la
                  première est close.
                </p>
              ) : (
                <div className={propres.bilan}>
                  {bilan.map((b) => (
                    <section key={b.index} className={propres.bilanItem}>
                      <header className={propres.bilanHead}>
                        <span className={propres.bilanNumero}>{b.numero ?? '·'}</span>
                        <p className={propres.bilanEnonce}>{b.question.enonce}</p>
                        <span className={propres.bilanCompte}>
                          {b.repondu} réponse{b.repondu > 1 ? 's' : ''}
                        </span>
                      </header>
                      <div className={propres.bilanCorps}>
                        <SondageRepartition question={b.question} data={b.repartition} sansTitre />
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return <ResizableSplit storageKey="sondage-split" left={jeu} right={panneau} />;
}
