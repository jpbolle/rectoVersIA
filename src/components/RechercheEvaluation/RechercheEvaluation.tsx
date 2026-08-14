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
import { formatPoints, scoreRecherche } from '@/lib/recherche-scoring';
import type { RechercheVolet } from '@/lib/recherche-scoring';
import type {
  NavigKidQuestion,
  NavigKidReponse,
  RechercheQuestionScore,
} from '@/types/navigkid';
import RechercheStatsTab from '@/components/RechercheStatsTab/RechercheStatsTab';
import styles from './RechercheEvaluation.module.css';

interface Props {
  questions: NavigKidQuestion[];
  reponse: NavigKidReponse | null;
  scores?: Record<string, RechercheQuestionScore>;
  // Le score est-il montrable ? (prof : toujours ; élève : correction rendue)
  showScores: boolean;
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

export default function RechercheEvaluation({ questions, reponse, scores, showScores }: Props) {
  const { config } = useDidactique();
  const score = scoreRecherche(questions, reponse, scores);

  const habiletes = config?.habiletes ?? [];
  const nomHabilete = (id: string) => {
    const h = habiletes.find((x) => x.id === id);
    return h ? habileteLabel(h) : id;
  };

  const aDesNotes = score.reponses.max > 0 || score.demarche.max > 0;

  return (
    <div className={styles.container}>
      {showScores ? (
        <>
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
