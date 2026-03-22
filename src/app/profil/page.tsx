'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useStudentProfil } from '@/hooks/useStudentProfil';
import { useStudentClasses } from '@/hooks/useStudentClasses';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import EmptyState from '@/components/EmptyState/EmptyState';
import type { SectionStats, CriterionStats, DevoirStat, DevoirCriterionStat } from '@/types/profil';
import styles from './profil.module.css';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const LANG_META: Record<string, { label: string; icon: string }> = {
  ortho:       { label: 'Orthographe', icon: '✍️' },
  syntaxe:     { label: 'Syntaxe',     icon: '🔗' },
  lexique:     { label: 'Lexique',     icon: '📖' },
  ponctuation: { label: 'Ponctuation', icon: '⸺' },
};

function scoreColor(score: number) {
  if (score < 35) return 'var(--c-danger)';
  if (score < 60) return 'var(--c-accent)';
  return 'var(--c-success)';
}

function scoreValueClass(score: number) {
  if (score < 35) return styles.statValueDanger;
  if (score < 60) return styles.statValueWarning;
  return styles.statValueSuccess;
}

function scoreLabel(score: number) {
  if (score < 35) return 'À travailler';
  if (score < 60) return 'Insuffisant';
  if (score < 80) return 'Suffisant';
  return 'Acquis';
}

// Trouve le ou les pires critères (score < 50)
function getPointsAttention(criteria: Array<{ name: string; score?: number; averageScore?: number }>): string[] {
  const scored = criteria
    .map((c) => ({ name: c.name, s: c.score ?? c.averageScore ?? 100 }))
    .filter((c) => c.s < 50)
    .sort((a, b) => a.s - b.s);
  return scored.slice(0, 2).map((c) => c.name);
}

// ─── Barre de critère avec marqueurs classe ───────────────────────────────────
function CriterionRow({
  name, score, classeAvg, classeMax, count, history,
}: {
  name: string;
  score: number;
  classeAvg: number | null;
  classeMax: number | null;
  count?: number;
  history?: { devoirName: string; score: number }[];
}) {
  const hasClass = classeAvg !== null || classeMax !== null;

  return (
    <div className={styles.criterionItem}>
      <div className={styles.criterionHeader}>
        <span className={styles.criterionName}>{name}</span>
        <span className={styles.criterionScore} style={{ color: scoreColor(score) }}>
          {score}%
          <span className={styles.criterionScoreLabel}> — {scoreLabel(score)}</span>
        </span>
      </div>

      <div className={styles.criterionBarTrack}>
        <div
          className={styles.criterionBarFill}
          style={{ width: `${score}%`, background: scoreColor(score) }}
        />
        {classeAvg !== null && (
          <div
            className={styles.classeAvgMarker}
            style={{ left: `${classeAvg}%` }}
            title={`Moyenne classe : ${classeAvg}%`}
          />
        )}
        {classeMax !== null && (
          <div
            className={styles.classeMaxMarker}
            style={{ left: `${classeMax}%` }}
            title={`Max classe : ${classeMax}%`}
          />
        )}
      </div>

      {hasClass && (
        <div className={styles.criterionMeta}>
          {classeAvg !== null && (
            <span className={styles.metaAvg}>
              <span className={styles.metaDotAvg} />cl. moy. {classeAvg}%
            </span>
          )}
          {classeMax !== null && (
            <span className={styles.metaMax}>
              <span className={styles.metaDotMax} />cl. max {classeMax}%
            </span>
          )}
          {count !== undefined && count > 1 && (
            <span className={styles.metaCount}>{count} éval.</span>
          )}
        </div>
      )}

      {history && history.length > 1 && (
        <div className={styles.historyList}>
          {history.slice(-5).map((h, i) => (
            <div key={i} className={styles.historyItem}>
              <span className={styles.historyName}>{h.devoirName}</span>
              <span className={styles.historyScore} style={{ color: scoreColor(h.score) }}>
                {h.score}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Contenu d'une section (écriture ou lecture) ──────────────────────────────
function SectionContent({
  criteria,
  globalScore,
  classeAvg,
  classeMax,
}: {
  criteria: Array<CriterionStats | DevoirCriterionStat>;
  globalScore: number;
  classeAvg: number | null;
  classeMax: number | null;
}) {
  const langCriteria = criteria.filter((c) => c.languageType);
  const otherCriteria = criteria.filter((c) => !c.languageType);

  return (
    <div className={styles.sectionBody}>
      {/* Score global + comparaison classe */}
      <div className={styles.globalRow}>
        <div className={styles.globalScoreBlock}>
          <div
            className={styles.globalCircle}
            style={{
              background: `conic-gradient(${scoreColor(globalScore)} ${globalScore * 3.6}deg, var(--c-border) 0)`,
            }}
          >
            <span className={styles.globalCircleInner}>{globalScore}%</span>
          </div>
          <div>
            <div className={styles.globalScoreLabel}>Score global</div>
            <div className={styles.globalScoreSub}>{scoreLabel(globalScore)}</div>
          </div>
        </div>

        {(classeAvg !== null || classeMax !== null) && (
          <div className={styles.globalClasseRow}>
            {classeAvg !== null && (
              <div className={styles.statCard}>
                <span className={scoreValueClass(classeAvg)}>{classeAvg}%</span>
                <span className={styles.statLabel}>Moy. classe</span>
              </div>
            )}
            {classeMax !== null && (
              <div className={styles.statCard}>
                <span className={scoreValueClass(classeMax)}>{classeMax}%</span>
                <span className={styles.statLabel}>Max classe</span>
              </div>
            )}
            {classeAvg !== null && (
              <div className={`${styles.statCard} ${globalScore >= classeAvg ? styles.statCardSuccess : styles.statCardDanger}`}>
                <span className={globalScore >= classeAvg ? styles.statValueSuccess : styles.statValueDanger}>
                  {globalScore >= classeAvg ? '+' : ''}{globalScore - classeAvg}%
                </span>
                <span className={styles.statLabel}>Écart moy.</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Critères de langue mis en avant */}
      {langCriteria.length > 0 && (
        <>
          <h4 className={styles.subTitle}>Maîtrise de la langue</h4>
          <div className={styles.langGrid}>
            {(['ortho', 'syntaxe', 'lexique', 'ponctuation'] as const).map((type) => {
              const crit = langCriteria.find((c) => c.languageType === type);
              if (!crit) return null;
              const meta = LANG_META[type];
              const score = 'score' in crit ? crit.score : crit.averageScore;
              return (
                <div
                  key={type}
                  className={`${styles.langCard} ${score < 35 ? styles.langCardDanger : score < 60 ? styles.langCardWarning : styles.langCardOk}`}
                >
                  <span className={styles.langIcon}>{meta.icon}</span>
                  <span className={styles.langLabel}>{meta.label}</span>
                  <span className={styles.langScore} style={{ color: scoreColor(score) }}>
                    {score}%
                  </span>
                  <div className={styles.langBarTrack}>
                    <div
                      className={styles.langBarFill}
                      style={{ width: `${score}%`, background: scoreColor(score) }}
                    />
                    {crit.classeAvg !== null && (
                      <div
                        className={styles.classeAvgMarker}
                        style={{ left: `${crit.classeAvg}%` }}
                      />
                    )}
                  </div>
                  {crit.classeAvg !== null && (
                    <span className={styles.langMeta}>
                      cl. {crit.classeAvg}%
                      {crit.classeMax !== null && ` / ${crit.classeMax}%`}
                    </span>
                  )}
                  <span className={styles.langScoreLabel}>{scoreLabel(score)}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Tous les autres critères */}
      {otherCriteria.length > 0 && (
        <>
          <h4 className={styles.subTitle}>Tous les critères</h4>
          <div className={styles.criteriaList}>
            {otherCriteria.map((crit) => {
              const score = 'score' in crit ? crit.score : crit.averageScore;
              const count = 'count' in crit ? crit.count : undefined;
              const history = 'history' in crit ? crit.history : undefined;
              return (
                <CriterionRow
                  key={crit.name}
                  name={crit.name}
                  score={score}
                  classeAvg={crit.classeAvg}
                  classeMax={crit.classeMax}
                  count={count}
                  history={history}
                />
              );
            })}
          </div>
        </>
      )}

      {/* Légende */}
      {criteria.some((c) => c.classeAvg !== null) && (
        <div className={styles.legendBox}>
          <span className={styles.legendItem}>
            <span className={styles.legendLineAvg} /> Moyenne de la classe
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendLineMax} /> Maximum de la classe
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function ProfilPage() {
  const { isAuthenticated, isLoading: authLoading, role } = useAuth();
  const router = useRouter();
  const { profilData, isLoading } = useStudentProfil();
  const { classes, isLoading: classesLoading } = useStudentClasses();
  const [isReady, setIsReady] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (authLoading && !isAuthenticated) return;
    if (!isAuthenticated) { router.replace('/login'); return; }
    if (role === 'eleve' && !classesLoading && classes.length === 0) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, role, classes, classesLoading, router]);

  // Activités écriture pour le filtre — DOIT être avant tout return conditionnel
  const ecritureDevoirs = useMemo(
    () => profilData?.devoirStats.filter((d) => d.type === 'ecrire') ?? [],
    [profilData]
  );

  // Données courantes selon le filtre (écriture seulement)
  const currentEcriture = useMemo((): {
    criteria: Array<CriterionStats | DevoirCriterionStat>;
    globalScore: number;
    classeAvg: number | null;
    classeMax: number | null;
    totalEvaluations: number;
  } | null => {
    if (!profilData) return null;
    if (activeFilter === 'all') {
      if (!profilData.ecritureStats) return null;
      return profilData.ecritureStats;
    }
    const d = ecritureDevoirs.find((x) => x.devoirId === activeFilter);
    if (!d) return null;
    return {
      criteria: d.criteria,
      globalScore: d.myScore,
      classeAvg: d.classeAvg,
      classeMax: d.classeMax,
      totalEvaluations: 1,
    };
  }, [activeFilter, profilData, ecritureDevoirs]);

  // 4 encadrés de stats (dépendent du filtre)
  const topStats = useMemo(() => {
    if (!profilData) return null;

    if (activeFilter === 'all') {
      const attention = getPointsAttention(
        (profilData.ecritureStats?.criteria ?? []).map((c) => ({
          name: c.name, averageScore: c.averageScore,
        }))
      );
      return {
        box1: { value: String(profilData.travauxRemis), label: 'Travaux remis' },
        box2: { value: String(profilData.reussites), label: 'Réussites ≥ 60%', colorClass: styles.statValueSuccess },
        box3: { value: String(profilData.echecs), label: 'Échecs < 60%', colorClass: styles.statValueDanger },
        attention,
      };
    }

    const d = ecritureDevoirs.find((x) => x.devoirId === activeFilter);
    if (!d) return null;
    const attention = getPointsAttention(d.criteria.map((c) => ({ name: c.name, score: c.score })));
    return {
      box1: { value: `${d.myScore}%`, label: 'Mon score', colorClass: scoreValueClass(d.myScore) },
      box2: {
        value: d.classeAvg !== null ? `${d.classeAvg}%` : '—',
        label: 'Moy. classe',
        colorClass: d.classeAvg !== null ? scoreValueClass(d.classeAvg) : styles.statValue,
      },
      box3: {
        value: d.classeMax !== null ? `${d.classeMax}%` : '—',
        label: 'Max classe',
        colorClass: d.classeMax !== null ? scoreValueClass(d.classeMax) : styles.statValue,
      },
      attention,
    };
  }, [activeFilter, profilData, ecritureDevoirs]);

  const lectureStats = profilData?.lectureStats ?? null;

  // Guard après tous les hooks
  if (!isAuthenticated || (role === 'eleve' && classesLoading)) return null;

  return (
    <div className={`${styles.pageWrapper} ${isReady ? styles.ready : ''}`}>
      <Header variant={role === 'prof' ? 'prof' : 'student'} />

      <main className={styles.main}>
        <h1 className={styles.pageTitle}>Mon profil d&apos;écrilecteur</h1>
        <p className={styles.pageSubtitle}>
          Tes résultats agrégés sur toutes les évaluations corrigées
        </p>

        {isLoading ? (
          <EmptyState icon="hourglass" message="Chargement de ton profil..." />
        ) : !profilData || profilData.totalEvaluations === 0 ? (
          <EmptyState
            icon="chart"
            message="Aucune évaluation disponible pour le moment. Tes résultats apparaîtront ici dès que ton professeur aura corrigé un de tes travaux."
          />
        ) : (
          <>
            {/* ── 4 encadrés de stats générales ── */}
            {topStats && (
              <div className={styles.topStats}>
                <div className={styles.statCard}>
                  <span className={topStats.box1.colorClass ?? styles.statValue}>
                    {topStats.box1.value}
                  </span>
                  <span className={styles.statLabel}>{topStats.box1.label}</span>
                </div>
                <div className={styles.statCard}>
                  <span className={topStats.box2.colorClass ?? styles.statValue}>
                    {topStats.box2.value}
                  </span>
                  <span className={styles.statLabel}>{topStats.box2.label}</span>
                </div>
                <div className={styles.statCard}>
                  <span className={topStats.box3.colorClass ?? styles.statValue}>
                    {topStats.box3.value}
                  </span>
                  <span className={styles.statLabel}>{topStats.box3.label}</span>
                </div>
                {/* Point d'attention */}
                <div className={`${styles.statCard} ${topStats.attention.length > 0 ? styles.statCardDanger : styles.statCardSuccess}`}>
                  {topStats.attention.length > 0 ? (
                    <>
                      <span className={styles.attentionLabel}>
                        ⚠ {topStats.attention.join(', ')}
                      </span>
                      <span className={styles.statLabel}>Point d&apos;attention</span>
                    </>
                  ) : (
                    <>
                      <span className={styles.statValueSuccess}>✓</span>
                      <span className={styles.statLabel}>Aucun point d&apos;attention</span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ── Section Statistiques d'écriture ── */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Statistiques d&apos;écriture</h2>

              {/* Filtre par activité */}
              {ecritureDevoirs.length > 1 && (
                <div className={styles.filterRow}>
                  <button
                    className={`${styles.filterChip} ${activeFilter === 'all' ? styles.filterChipActive : ''}`}
                    onClick={() => setActiveFilter('all')}
                  >
                    Toutes les activités
                  </button>
                  {ecritureDevoirs.map((d) => (
                    <button
                      key={d.devoirId}
                      className={`${styles.filterChip} ${activeFilter === d.devoirId ? styles.filterChipActive : ''}`}
                      onClick={() => setActiveFilter(d.devoirId)}
                    >
                      {d.name}
                    </button>
                  ))}
                </div>
              )}

              {currentEcriture ? (
                <SectionContent
                  criteria={currentEcriture.criteria}
                  globalScore={currentEcriture.globalScore}
                  classeAvg={currentEcriture.classeAvg}
                  classeMax={currentEcriture.classeMax}
                />
              ) : (
                <EmptyState icon="chart" message="Aucun travail d'écriture évalué pour le moment." />
              )}
            </section>

            {/* ── Section Statistiques de lecture ── */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Statistiques de lecture</h2>
              {lectureStats ? (
                <SectionContent
                  criteria={lectureStats.criteria}
                  globalScore={lectureStats.globalScore}
                  classeAvg={lectureStats.classeAvg}
                  classeMax={lectureStats.classeMax}
                />
              ) : (
                <div className={styles.emptySection}>
                  <EmptyState
                    icon="chart"
                    message="Aucun travail de lecture évalué pour le moment."
                  />
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
