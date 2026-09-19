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
import Podium from './Podium';
import EquipesPanel from './EquipesPanel';
import { QuestionCard } from '@/components/LectureQuizActivity/LectureQuizActivity';
import { useDirect } from '@/hooks/useDirect';
import { LECTURE_TYPE_LABELS } from '@/types/lecture';
import { EQUIPE_TEINTES, PODIUM_TAILLES } from '@/types/manche';
import type { LectureQuestionType } from '@/types/lecture';
import type { PodiumLigne } from './Podium';
import styles from './CompetitionPilote.module.css';

type Onglet = 'questions' | 'equipes' | 'stats';
type PodiumMode = 'eleves' | 'equipes';

export default function CompetitionPilote({ sessionId }: { sessionId: string }) {
  const { vue, motif, sommaire, demarree, reste, avantDepart, isLoading, piloter } = useDirect({
    sessionId,
  });
  const [onglet, setOnglet] = useState<Onglet>('questions');
  // ── Le podium, à la demande ──
  // Le prof choisit combien de lignes il projette (1 / 3 / 5 / 10), et QUAND :
  // un bouton ambre le fait apparaître à la place de la question, un second
  // clic la ramène. Le choix « visible / caché » est attaché à la question
  // pour laquelle il a été fait : lancer la suivante le remet à zéro sans
  // effet ni remise à zéro manuelle. En fin de partie, le podium s'affiche
  // d'office.
  const [podiumTaille, setPodiumTaille] = useState<number>(3);
  const [podiumChoix, setPodiumChoix] = useState<{ index: number; visible: boolean } | null>(
    null
  );
  // Élèves ou équipes au podium. `null` = pas encore choisi : on projette les
  // équipes dès qu'il y en a, les élèves sinon.
  const [podiumMode, setPodiumMode] = useState<PodiumMode | null>(null);

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
  const finie = vue.phase === 'finie';
  const classement = vue.classement ?? [];
  // Le score n'existe qu'une fois la réponse révélée (ou la partie finie).
  const podiumPossible = (revele || finie) && classement.length > 0;
  const podiumVisible = podiumPossible
    ? podiumChoix?.index === vue.questionIndex
      ? podiumChoix.visible
      : finie
    : false;
  const basculerPodium = () =>
    setPodiumChoix({ index: vue.questionIndex, visible: !podiumVisible });

  // ── Les équipes ──
  const avecEquipes = (vue.equipes?.length ?? 0) > 0;
  const classementEquipes = vue.classementEquipes ?? [];
  const modeEffectif: PodiumMode = podiumMode ?? (avecEquipes ? 'equipes' : 'eleves');
  // Le podium ne sait pas ce qu'il classe : on lui prépare ses lignes.
  const lignesPodium: PodiumLigne[] =
    modeEffectif === 'equipes' && avecEquipes
      ? classementEquipes.map((l) => ({
          id: l.id,
          rang: l.rang,
          nom: l.nom,
          total: l.total,
          sous: l.membres.join(' · '),
          teinte: EQUIPE_TEINTES[l.nom],
        }))
      : classement.map((l) => ({
          id: l.uid,
          rang: l.rang,
          nom: l.nom,
          total: l.total,
          serie: l.serie,
        }));
  const titrePodium =
    (finie ? 'Podium final' : 'Podium') +
    (modeEffectif === 'equipes' && avecEquipes ? ' des équipes' : '');

  // ── Colonne de gauche : l'espace de jeu ──
  const jeu = (
    <div className={styles.contentSection}>
      <div className={styles.sectionHeader}>
        <h2>Espace de jeu</h2>
        {/* Le compteur vit dans l'en-tête : le prof le surveille sans quitter
            la question des yeux. */}
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

        {podiumVisible && (
          <Podium lignes={lignesPodium} taille={podiumTaille} titre={titrePodium} />
        )}

        {q && !podiumVisible && (demarree || close || revele) && (
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
        {finie && !podiumVisible && <p className={styles.vide}>Partie terminée.</p>}

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
              disabled={finie}
            >
              Arrêter la partie
            </button>
            {/* Afficher = ambre. Le sélecteur de taille est collé au bouton :
                on choisit COMBIEN on montre au moment où on le montre. */}
            <span className={styles.podiumGroupe}>
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.actionBtnAmber}`}
                onClick={basculerPodium}
                disabled={!podiumPossible}
              >
                {podiumVisible ? 'Revenir à la question' : 'Afficher le podium'}
              </button>
              {avecEquipes && (
                <span className={styles.podiumTailles} role="group" aria-label="Podium des élèves ou des équipes">
                  {(['eleves', 'equipes'] as PodiumMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={`${styles.podiumTaille} ${
                        modeEffectif === mode ? styles.podiumTailleActive : ''
                      }`}
                      onClick={() => setPodiumMode(mode)}
                      disabled={!podiumPossible}
                    >
                      {mode === 'eleves' ? 'Élèves' : 'Équipes'}
                    </button>
                  ))}
                </span>
              )}
              <span className={styles.podiumTailles} role="group" aria-label="Taille du podium">
                {PODIUM_TAILLES.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`${styles.podiumTaille} ${
                      podiumTaille === n ? styles.podiumTailleActive : ''
                    }`}
                    onClick={() => setPodiumTaille(n)}
                    disabled={!podiumPossible}
                    title={`Afficher les ${n} premiers`}
                  >
                    {n}
                  </button>
                ))}
              </span>
            </span>
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
            className={`${styles.onglet} ${onglet === 'equipes' ? styles.ongletActif : ''}`}
            onClick={() => setOnglet('equipes')}
          >
            Équipes{avecEquipes ? ` (${vue.equipes!.length})` : ''}
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
          {onglet === 'equipes' ? (
            <EquipesPanel
              equipes={vue.equipes}
              sansEquipe={vue.sansEquipe}
              effectif={vue.compteur?.attendus ?? 0}
              onTirer={(nombre) => piloter('equipes', { nombre })}
              onRecomposer={(equipes) => piloter('equipes', { equipes })}
              onSupprimer={() => piloter('equipes', { equipes: [] })}
            />
          ) : onglet === 'questions' ? (
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
              {/* Le classement ENTIER, pour le prof seul : le podium projeté
                  n'en montre que la tête. Il n'existe qu'une fois la réponse
                  révélée — avant, il dirait qui a raison. Le détail par
                  question (qui répond vite et faux) est le sujet de l'étape 5. */}
              {avecEquipes && classementEquipes.length > 0 && (
                <table className={`${styles.classement} ${styles.classementEquipes}`}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Équipe</th>
                      <th>Points</th>
                      <th>Membres</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classementEquipes.map((l) => (
                      <tr key={l.id}>
                        <td>{l.rang}</td>
                        <td>
                          <i
                            className={styles.teinteEquipe}
                            style={{ background: EQUIPE_TEINTES[l.nom] ?? 'var(--c-text-muted)' }}
                          />
                          {l.nom}
                        </td>
                        <td className={styles.classementPoints}>
                          {l.total.toLocaleString('fr-BE')}
                        </td>
                        <td className={styles.membres}>{l.membres.join(', ') || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {classement.length > 0 ? (
                <table className={styles.classement}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Élève</th>
                      <th>Points</th>
                      <th title="Bonnes réponses consécutives">Série</th>
                      <th title="Question par question : juste, partiel, faux, sans réponse — le temps au survol">
                        Détail
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {classement.map((l) => (
                      <tr key={l.uid} className={l.total === 0 ? styles.classementZero : ''}>
                        <td>{l.rang}</td>
                        <td>{l.nom}</td>
                        <td className={styles.classementPoints}>
                          {l.total.toLocaleString('fr-BE')}
                        </td>
                        <td>{l.serie >= 2 ? `🔥 ${l.serie}` : '—'}</td>
                        <td>
                          {/* Une puce par question : c'est ici qu'on lit « vite
                              et faux » — une puce rouge avec un temps court. */}
                          <span className={styles.detail}>
                            {(l.detail ?? []).map((d) => {
                              const etat =
                                d.part === null
                                  ? 'vide'
                                  : d.part >= 1
                                  ? 'juste'
                                  : d.part > 0
                                  ? 'partiel'
                                  : 'faux';
                              const secondes =
                                d.tempsMs === null ? null : Math.round(d.tempsMs / 1000);
                              const libelleEtat =
                                etat === 'vide'
                                  ? 'sans réponse'
                                  : etat === 'juste'
                                  ? 'juste'
                                  : etat === 'partiel'
                                  ? `partiel (${Math.round(d.part! * 100)} %)`
                                  : 'faux';
                              return (
                                <span
                                  key={d.questionId}
                                  className={`${styles.puce} ${styles[`puce_${etat}`]}`}
                                  title={`Q${d.numero ?? '?'} · ${libelleEtat}${
                                    secondes !== null ? ` · ${secondes} s` : ''
                                  }`}
                                >
                                  {d.numero ?? '·'}
                                </span>
                              );
                            })}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className={styles.vide}>
                  Le classement apparaît dès que la première réponse est révélée.
                </p>
              )}

              {/* Le versement : la partie finie devient des copies rendues,
                  lisibles dans la correction et le profil. Automatique à
                  « Arrêter la partie » ; rejouable si quelque chose a manqué. */}
              {finie && (
                <div className={styles.versement}>
                  {vue.versement ? (
                    <span>
                      {vue.versement.copies === 0
                        ? 'Aucune copie versée — personne n’a répondu.'
                        : `${vue.versement.copies} ${
                            vue.versement.copies > 1 ? 'copies versées' : 'copie versée'
                          } dans les travaux de l’activité, à ${new Date(
                            vue.versement.at
                          ).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })}.`}
                    </span>
                  ) : (
                    <span>Les copies n’ont pas encore été versées.</span>
                  )}
                  <button
                    type="button"
                    className={styles.versementBtn}
                    onClick={() => piloter('terminer')}
                  >
                    {vue.versement ? 'Verser à nouveau' : 'Verser les copies'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return <ResizableSplit storageKey="competition-split" left={jeu} right={panneau} />;
}
