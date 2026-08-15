'use client';

// Onglet Évaluation d'une activité de recherche — le seul onglet de résultats :
// l'ancien onglet « Recherche » a été supprimé, ses statistiques sont ici, en
// bas. De haut en bas : les deux scores (Réponses / Démarche), les habiletés
// travaillées, puis comment l'élève a cherché.
//
// Les deux scores évoluent en direct pendant que le prof corrige la colonne de
// gauche : ils sont recalculés à chaque rendu, jamais stockés.

import { useDidactique } from '@/hooks/useDidactique';
import { habileteLabel } from '@/types/didactique';
import {
  formatPoints,
  percentGlobalRecherche,
  resteANoter,
  scoreRecherche,
} from '@/lib/recherche-scoring';
import type { RechercheVolet } from '@/lib/recherche-scoring';
import type {
  NavigKidQuestion,
  NavigKidReponse,
  RechercheQuestionScore,
} from '@/types/navigkid';
import RechercheStatsTab from '@/components/RechercheStatsTab/RechercheStatsTab';
import ConfianceBilan from '@/components/ConfianceBilan';
import { bilanConfiance } from '@/lib/confiance-scoring';
import styles from './RechercheEvaluation.module.css';

interface Props {
  questions: NavigKidQuestion[];
  reponse: NavigKidReponse | null;
  scores?: Record<string, RechercheQuestionScore>;
  // Le score est-il montrable ? (prof : toujours ; élève : correction rendue)
  showScores: boolean;
  // Vue prof : le bilan de lucidité s'adresse au professeur, pas à l'élève
  isProfessorView?: boolean;
}

function formatTemps(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 1) return `${Math.round(ms / 1000)} s`;
  return `${min} min`;
}

function ScoreCard({
  titre,
  volet,
  variant,
}: {
  titre: string;
  volet: RechercheVolet;
  variant: 'reponses' | 'demarche';
}) {
  const vide = volet.max === 0;
  return (
    <div className={`${styles.scoreCard} ${styles[variant]}`}>
      <div className={styles.scoreLabel}>{titre}</div>
      <div className={styles.scoreValue}>
        {vide ? '—' : `${formatPoints(volet.points)} / ${volet.max}`}
      </div>
      <div className={styles.scorePercent}>
        {vide
          ? 'pas encore noté'
          : `${volet.percent} %${volet.aNoter > 0 ? ` · ${volet.aNoter} à noter` : ''}`}
      </div>
    </div>
  );
}

export default function RechercheEvaluation({
  questions,
  reponse,
  scores,
  showScores,
  isProfessorView = false,
}: Props) {
  const { config } = useDidactique();
  const score = scoreRecherche(questions, reponse, scores);

  const habiletes = config?.habiletes ?? [];
  const nomHabilete = (id: string) => {
    const h = habiletes.find((x) => x.id === id);
    return h ? habileteLabel(h) : id;
  };

  const aDesNotes = score.reponses.max > 0 || score.demarche.max > 0;

  // Total des deux volets. Il ne remplace pas le détail — « mal cherché » et
  // « mal répondu » ne disent pas la même chose — mais c'est la note du travail,
  // et l'élève la cherchait sans la trouver.
  const totalPoints = score.reponses.points + score.demarche.points;
  const totalMax = score.reponses.max + score.demarche.max;
  const totalPercent = percentGlobalRecherche(score);
  const aNoter = resteANoter(score);

  // Lucidité : le smiley posé dans l'extension, confronté à la note de la
  // RÉPONSE (jamais celle de la démarche — l'élève se prononçait sur ce qu'il
  // avait trouvé, pas sur la façon dont il avait cherché).
  const bilan = bilanConfiance(
    questions.map((q, index) => {
      const volet = score.parQuestion.find((p) => p.index === index);
      return {
        questionId: String(index),
        enonce: q.texte,
        percent:
          volet && volet.reponsePoints !== null && volet.reponseMax > 0
            ? Math.round((volet.reponsePoints / volet.reponseMax) * 100)
            : null,
        confiance: reponse?.questions?.find((d) => d.questionIndex === index)?.confiance,
      };
    })
  );

  return (
    <div className={styles.container}>
      {showScores ? (
        <>
          {totalPercent !== null && (
            <div className={styles.total}>
              <span className={styles.totalLabel}>Total</span>
              <span className={styles.totalValue}>
                {formatPoints(totalPoints)} / {totalMax}
              </span>
              <span className={styles.totalPercent}>{totalPercent} %</span>
              {aNoter > 0 && (
                <span className={styles.totalPartiel}>
                  Score partiel — {aNoter} question{aNoter > 1 ? 's' : ''} pas encore notée
                  {aNoter > 1 ? 's' : ''} par ton professeur, et donc hors total.
                </span>
              )}
            </div>
          )}
          <div className={styles.scores}>
            <ScoreCard titre="Réponses" volet={score.reponses} variant="reponses" />
            <ScoreCard titre="Démarche" volet={score.demarche} variant="demarche" />
          </div>
          {!aDesNotes && (
            <p className={styles.hint}>
              Aucun barème n&apos;a été fixé sur les questions de ce questionnaire : les points se
              règlent question par question dans le constructeur (colonnes <em>Points</em> et{' '}
              <em>Démarche</em>).
            </p>
          )}
        </>
      ) : (
        <p className={styles.hint}>
          Ta note apparaîtra ici quand ton professeur aura rendu la correction.
        </p>
      )}

      {showScores && <ConfianceBilan bilan={bilan} isProfessorView={isProfessorView} />}

      {showScores && score.parHabilete.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Habiletés travaillées</h3>
          {score.parHabilete.map((h) => {
            const pct = h.max > 0 ? Math.round((h.points / h.max) * 100) : 0;
            const couleur = pct >= 70 ? styles.barGood : pct >= 45 ? styles.barMid : styles.barLow;
            return (
              <div key={h.habileteId} className={styles.habilete}>
                <div className={styles.habileteRow}>
                  <span className={styles.habileteName}>{nomHabilete(h.habileteId)}</span>
                  <span className={styles.habileteScore}>
                    {formatPoints(h.points)} / {h.max} pts
                  </span>
                </div>
                <div className={styles.bar}>
                  <div className={`${styles.barFill} ${couleur}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
          <p className={styles.note}>
            Une question qui travaille deux habiletés compte <strong>entièrement dans chacune</strong> :
            la somme des lignes ne retombe pas sur le total, et c&apos;est voulu.
          </p>
        </section>
      )}

      {showScores && score.parHabilete.length === 0 && aDesNotes && (
        <p className={styles.hint}>
          Aucune habileté n&apos;est rattachée aux questions : le détail par habileté et le profil de
          l&apos;élève resteront vides. Elles se cochent question par question dans le constructeur.
        </p>
      )}

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Comment la recherche a été menée</h3>
        <div className={styles.statGrid}>
          <div className={styles.stat}>
            <div className={styles.statValue}>{score.stats.motsCles}</div>
            <div className={styles.statLabel}>mots-clés saisis</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>{score.stats.sites}</div>
            <div className={styles.statLabel}>
              sites consultés
              {score.stats.sites > 0 && (
                <>
                  <br />
                  <span className={styles.statSub}>{score.stats.sitesPertinents} jugés pertinents</span>
                </>
              )}
            </div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>
              {score.stats.fiabiliteMoyenne !== null
                ? `${formatPoints(score.stats.fiabiliteMoyenne)}/5`
                : '—'}
            </div>
            <div className={styles.statLabel}>fiabilité moyenne attribuée</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>{formatTemps(score.stats.tempsTotalMs)}</div>
            <div className={styles.statLabel}>temps de recherche</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>{score.stats.passages}</div>
            <div className={styles.statLabel}>passages surlignés</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>
              {score.stats.questionsRepondues}/{score.stats.questionsTotal}
            </div>
            <div className={styles.statLabel}>questions répondues</div>
          </div>
        </div>
        <p className={styles.note}>
          Ces chiffres viennent de l&apos;extension : ils disent <strong>comment</strong> la recherche a
          été menée, pas ce qu&apos;elle a trouvé.
        </p>
      </section>

      <details className={styles.details}>
        <summary className={styles.detailsSummary}>Détail des recherches (mots-clés, sites, temps)</summary>
        <RechercheStatsTab questions={questions} reponse={reponse} />
      </details>
    </div>
  );
}
