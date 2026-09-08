'use client';

// ═══ Écran ÉLÈVE du mode Compétition ═══
//
// L'élève ouvre son activité comme n'importe quelle autre. Il ne connaît aucun
// identifiant de manche : sa CLASSE désigne la session pour lui (`devoirId`
// suffit à la route). Il attend, la question surgit au même instant que chez
// ses camarades, il répond, elle se referme.
//
// UNE seule façon de répondre, pour tous les types : on compose LIBREMENT —
// on change d'avis autant qu'on veut —, puis on CONFIRME par le bouton
// « Envoyer ma réponse », et c'est verrouillé. Y compris sur un QCM à réponse
// unique : les jeux du genre partent au clic, mais JP a tranché (2026-09-08)
// — « c'est l'intérêt du bouton ENVOYER ».

import { useCallback, useState } from 'react';
import { QuestionCard } from '@/components/LectureQuizActivity/LectureQuizActivity';
import CompetitionQcm from './CompetitionQcm';
import Repartition from './Repartition';
import { useDirect } from '@/hooks/useDirect';
import type { LectureAnswer } from '@/types/lecture';
import styles from './CompetitionActivity.module.css';

interface CompetitionActivityProps {
  devoirId: string;
  /** Titre de l'activité, affiché dans la salle d'attente */
  intitule?: string;
}

export default function CompetitionActivity({ devoirId, intitule }: CompetitionActivityProps) {
  const { vue, demarree, reste, avantDepart, isLoading, repondre } = useDirect({ devoirId });

  // Les réponses en cours de composition, RANGÉES PAR QUESTION.
  //
  // Un brouillon unique qu'on remettrait à zéro à chaque changement de question
  // demanderait un effet qui écrit dans l'état — ce que React déconseille, et
  // que le projet a déjà payé ailleurs. Une entrée par question règle la chose
  // sans effet du tout, et rend son brouillon à l'élève si le prof repose la
  // question.
  const [brouillons, setBrouillons] = useState<Record<string, LectureAnswer>>({});
  const [envoi, setEnvoi] = useState(false);
  // Un envoi refusé (chrono expiré pendant le trajet, réponse vide) doit se
  // VOIR : sans message, l'élève reste devant un écran qui n'a pas bougé.
  /**
   * Le dernier refus, ATTACHÉ À SA QUESTION.
   *
   * ⚠ Un simple booléen survivait au changement de question : l'élève lisait
   * « tu as déjà répondu » devant une question neuve à laquelle il n'avait
   * jamais touché. On retient donc l'identifiant, et le message ne s'affiche
   * que s'il parle bien de la question à l'écran. (Pas d'effet de remise à
   * zéro : React déconseille d'écrire l'état depuis un effet, et le projet l'a
   * déjà payé.)
   */
  const [refus, setRefus] = useState<{ questionId: string; motif: string } | null>(null);
  /**
   * La question dont l'envoi vient d'être ACCEPTÉ, connue localement.
   *
   * Attendre `vue.aRepondu` — qui vient du serveur — laissait jusqu'à une
   * seconde d'écran mort après le clic. Dans un jeu, une seconde sans réponse
   * est une seconde où l'on reclique.
   */
  const [confirme, setConfirme] = useState<string | null>(null);
  const questionId = vue?.question?.id ?? null;
  const brouillon: LectureAnswer = (questionId && brouillons[questionId]) || {};

  const poser = useCallback(
    (partial: LectureAnswer, remplace = false) => {
      if (!questionId) return;
      setBrouillons((b) => ({
        ...b,
        [questionId]: remplace ? partial : { ...b[questionId], ...partial },
      }));
    },
    [questionId]
  );

  const envoyer = useCallback(
    async (answer: LectureAnswer) => {
      if (!questionId) return;
      setEnvoi(true);
      setRefus(null);
      const { accepte, motif } = await repondre(questionId, answer);
      setEnvoi(false);
      if (accepte) setConfirme(questionId);
      else setRefus({ questionId, motif: motif ?? 'inconnu' });
    },
    [questionId, repondre]
  );

  if (isLoading) {
    return <div className={styles.attente}>Chargement…</div>;
  }

  // Aucune manche ouverte : ce n'est pas une erreur. Le prof n'a pas encore
  // lancé la partie, ou elle a eu lieu un autre jour.
  if (!vue || vue.phase === 'salle') {
    return (
      <div className={styles.attente}>
        <p className={styles.attenteTitre}>{intitule || 'Compétition'}</p>
        <p>En attente de ton professeur…</p>
        {/* Son équipe, dès la salle : il doit savoir avec qui il joue avant la
            première question. Ses coéquipiers sont des camarades de classe —
            prénom et initiale, rien qu'ils ne sachent déjà. */}
        {vue?.monEquipe && (
          <p className={styles.equipe}>
            Tu joues dans l’équipe <strong>{vue.monEquipe.nom}</strong>
            {vue.monEquipe.coequipiers.length > 0
              ? ` avec ${vue.monEquipe.coequipiers.join(', ')}.`
              : ', pour l’instant seul.'}
          </p>
        )}
      </div>
    );
  }

  if (vue.phase === 'finie') {
    // Son score final, et rien de plus : le classement des autres reste au
    // tableau du prof (règle du plan — jamais le bas du classement devant la
    // classe).
    return (
      <div className={styles.attente}>
        <p className={styles.attenteTitre}>Partie terminée</p>
        {vue.monScore ? (
          <div className={styles.scoreFinal}>
            <span className={styles.scoreTotal}>
              {vue.monScore.total.toLocaleString('fr-BE')} pts
            </span>
            <span className={styles.scoreRang}>
              {vue.monScore.rang}
              <sup>{vue.monScore.rang === 1 ? 'er' : 'e'}</sup> sur {vue.monScore.sur}
            </span>
            {vue.monScore.equipe && (
              <span className={styles.scoreEquipe}>
                Équipe {vue.monScore.equipe.nom} :{' '}
                {vue.monScore.equipe.total.toLocaleString('fr-BE')} pts · {vue.monScore.equipe.rang}
                <sup>{vue.monScore.equipe.rang === 1 ? 're' : 'e'}</sup> sur{' '}
                {vue.monScore.equipe.sur}
              </span>
            )}
          </div>
        ) : (
          <p>Merci d’avoir joué.</p>
        )}
      </div>
    );
  }

  // Les deux secondes de compte à rebours : tout le monde les voit ensemble.
  if (avantDepart > 0) {
    return <div className={styles.rebours}>{avantDepart}</div>;
  }

  const q = vue.question;
  if (!q) {
    return <div className={styles.attente}>En attente de la question suivante…</div>;
  }

  // Ouverte tant que le chrono court, qu'aucun envoi n'est en vol, et que
  // l'élève n'a PAS ENCORE confirmé : une fois envoyée, sa réponse est figée.
  const dejaConfirme = vue.aRepondu === true || confirme === q.id;
  const ouverte = demarree && !envoi && !dejaConfirme && vue.phase === 'question';
  // Trois moments : la question court, elle est close (on voit ce que la
  // classe a répondu), le prof révèle. La bonne réponse n'arrive qu'au
  // troisième — le serveur ne l'envoie pas avant.
  const close = vue.phase === 'resultat';
  const revele = vue.phase === 'revele';
  const estQcm = q.type === 'qcm';
  // Une réponse sans contenu n'est pas une réponse : le bouton reste gris tant
  // que l'élève n'a rien posé (le serveur la refuse de toute façon).
  const brouillonVide = Object.keys(brouillon).length === 0;
  // Le refus ne vaut que pour la question qui l'a provoqué.
  const motifRefus = refus && refus.questionId === q.id ? refus.motif : null;
  const aRepondu = dejaConfirme;
  // Tout passe par le bouton — décision de JP, un clic ne suffit jamais.
  const envoiManuel = true;

  return (
    <div className={styles.espace}>
      {demarree && vue.chronoSec > 0 && vue.phase === 'question' && (
        <div className={styles.chrono}>
          <span
            className={`${styles.chronoValeur} ${reste <= 10 ? styles.chronoUrgent : ''}`}
          >
            {reste}
          </span>
          <div className={styles.chronoBarre}>
            <i style={{ width: `${(reste / vue.chronoSec) * 100}%` }} />
          </div>
        </div>
      )}

      {/* ⚠ L'énoncé n'est affiché ICI que pour le QCM et la répartition :
          `QuestionCard` porte déjà le sien pour les six autres types, et le
          sortir aussi le donnait DEUX FOIS à l'écran. */}
      {(estQcm || close) && (
        <div className={styles.enonce} dangerouslySetInnerHTML={{ __html: q.enonce }} />
      )}

      {/* Le QCM garde SES cases : une fois la question close, les pastilles
          s'y posent. Les autres types passent par leur propre rendu. */}
      {estQcm ? (
        <>
          <CompetitionQcm
            question={q}
            choisis={
              q.multiple
                ? brouillon.choiceIndexes ?? []
                : typeof brouillon.choiceIndex === 'number'
                ? [brouillon.choiceIndex]
                : []
            }
            onChoisir={(i) => {
              if (q.multiple) {
                const set = new Set(brouillon.choiceIndexes ?? []);
                if (set.has(i)) set.delete(i);
                else set.add(i);
                poser({ choiceIndexes: [...set].sort((a, b) => a - b) }, true);
                return;
              }
              // Réponse unique : on retient le choix, le bouton l'enverra.
              poser({ choiceIndex: i }, true);
            }}
            ouverte={ouverte}
            revele={revele}
            parChoix={
              vue.repartition?.forme === 'choix' ? vue.repartition.parChoix : undefined
            }
          />
        </>
      ) : close ? (
        // Question close, rien n'est encore corrigé : l'élève voit ce que sa
        // classe a répondu, comme au tableau.
        <Repartition question={q} data={vue.repartition} />
      ) : (
        // Les six autres types passent par la carte PARTAGÉE du questionnaire
        // de lecture : deux rendus parallèles divergeraient au premier
        // ajustement.
        <QuestionCard
          question={q}
          number={vue.numero}
          answer={brouillon}
          onAnswerChange={(partial) => poser(partial)}
          disabled={!ouverte}
          onZoomImage={() => {}}
          showCorrection={revele}
          autoEvaluation={false}
          graine={null}
        />
      )}

      {aRepondu && vue.phase === 'question' && (
        <p className={styles.repondu}>Réponse envoyée ✓</p>
      )}

      {/* À la révélation : ce que la question lui a rapporté, son total, son
          rang. Le sien seulement — le podium se lit au tableau. */}
      {revele && vue.monScore && (
        <div className={styles.score}>
          <span className={styles.scoreQuestion}>
            {vue.monScore.question === null
              ? '—'
              : vue.monScore.question > 0
              ? `+ ${vue.monScore.question.toLocaleString('fr-BE')} pts`
              : '0 pt'}
          </span>
          <span className={styles.scoreDetail}>
            Total {vue.monScore.total.toLocaleString('fr-BE')} pts · {vue.monScore.rang}
            <sup>{vue.monScore.rang === 1 ? 'er' : 'e'}</sup> sur {vue.monScore.sur}
            {vue.monScore.serie >= 2 && ` · 🔥 série de ${vue.monScore.serie}`}
          </span>
          {vue.monScore.equipe && (
            <span className={styles.scoreDetail}>
              Équipe {vue.monScore.equipe.nom} :{' '}
              {vue.monScore.equipe.total.toLocaleString('fr-BE')} pts · {vue.monScore.equipe.rang}
              <sup>{vue.monScore.equipe.rang === 1 ? 're' : 'e'}</sup> sur{' '}
              {vue.monScore.equipe.sur}
            </span>
          )}
        </div>
      )}
      {motifRefus && (
        <p className={styles.refus}>
          {motifRefus === 'phase'
            ? 'Trop tard : la question est fermée.'
            : motifRefus === 'vide'
            ? 'Ta réponse est vide.'
            : motifRefus === 'deja'
            ? 'Tu as déjà répondu à cette question.'
            : motifRefus === 'question'
            ? 'La question a changé — attends la suivante.'
            : 'Ta réponse n’a pas pu être envoyée.'}
        </p>
      )}

      {envoiManuel && ouverte && (
        <div className={styles.bottomActions}>
          <span className={styles.bottomActionsLine} />
          <div className={styles.bottomActionsRow}>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => envoyer(brouillon)}
              disabled={envoi || brouillonVide}
            >
              {envoi ? 'Envoi…' : 'Envoyer ma réponse'}
            </button>
          </div>
          <span className={styles.bottomActionsLine} />
        </div>
      )}
    </div>
  );
}
