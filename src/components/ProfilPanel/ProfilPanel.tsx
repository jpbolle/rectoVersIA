'use client';

// Profil d'écrilecteur en 5 onglets (Général / Lire / Écrire / Rechercher /
// Vocabulaire) — extrait de la page /profil pour être réutilisable :
// - sans prop : l'utilisateur connecté consulte son propre profil (page /profil) ;
// - avec eleveId : un prof consulte la fiche d'un de ses élèves (popup
//   « Fiche de l'élève » des pages Mes Classes) — les routes /api/profil/*
//   vérifient l'appartenance de l'élève à une classe du prof.
// Chaque onglet est chargé à sa première ouverture (un appel API par onglet).

import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import EmptyState from '@/components/EmptyState/EmptyState';
import type {
  CriterionStats, DevoirCriterionStat,
  ProfilGeneral, ProfilSection, RechercheItem, ProfilVocabulaire, ProfilVocabGroup,
  VocabActiviteStat,
} from '@/types/profil';
import styles from '@/app/profil/profil.module.css';

// ─── Onglets ─────────────────────────────────────────────────────────────────

type TabId = 'general' | 'lire' | 'ecrire' | 'parler' | 'rechercher' | 'vocabulaire';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'general', label: 'Général', icon: '🏠' },
  { id: 'lire', label: 'Lire', icon: '📖' },
  { id: 'ecrire', label: 'Écrire', icon: '✍️' },
  { id: 'parler', label: 'Parler', icon: '🗣️' },
  { id: 'rechercher', label: 'Rechercher', icon: '🔍' },
  { id: 'vocabulaire', label: 'Vocabulaire', icon: '🧠' },
];

// Pas d'endpoint pour « parler » : aucune activité orale n'existe encore,
// l'onglet affiche un état vide sans appel serveur.
const TAB_ENDPOINTS: Record<Exclude<TabId, 'parler'>, string> = {
  general: '/api/profil/general',
  lire: '/api/profil/lecture',
  ecrire: '/api/profil/ecriture',
  rechercher: '/api/profil/recherche',
  vocabulaire: '/api/profil/vocabulaire',
};

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

function formatDate(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit' });
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

// ─── Évolution d'un critère (liste « Tous les critères ») ────────────────────

// Petite courbe à points : une évaluation = un point, coloré selon le score.
// Le survol d'un point affiche le résultat obtenu (infobulle native).
function DotSparkline({
  points,
  width = 110,
  height = 34,
}: {
  points: { score: number; devoirName: string; date: string }[];
  width?: number;
  height?: number;
}) {
  const w = width, h = height, pad = h > 40 ? 12 : 7;
  const dotR = h > 40 ? 4.5 : 3.5;
  const xs = points.map((_, i) =>
    points.length === 1 ? w / 2 : pad + (i * (w - 2 * pad)) / (points.length - 1)
  );
  const ys = points.map((p) => h - pad - (p.score / 100) * (h - 2 * pad));
  return (
    <svg width={w} height={h} className={styles.sparkline}>
      {points.length > 1 && (
        <polyline
          points={xs.map((x, i) => `${x},${ys[i]}`).join(' ')}
          fill="none"
          stroke="var(--c-border)"
          strokeWidth="1.5"
        />
      )}
      {points.map((p, i) => (
        <g key={i} className={styles.sparklineDot}>
          {/* Zone de survol élargie (le point fait 3,5 px) */}
          <circle cx={xs[i]} cy={ys[i]} r="9" fill="transparent" />
          <circle cx={xs[i]} cy={ys[i]} r={dotR} fill={scoreColor(p.score)} />
          <title>{`${p.devoirName} — ${formatDateShort(p.date)} : ${p.score}%`}</title>
        </g>
      ))}
    </svg>
  );
}

// Ligne de critère groupée par grille : score, courbe d'évolution, et détail
// dépliable (le pourcentage de chaque évaluation)
function CriterionEvolutionRow({ crit }: { crit: CriterionStats }) {
  const [open, setOpen] = useState(false);
  const multi = crit.history.length > 1;

  return (
    <div className={styles.evoRow}>
      <button
        type="button"
        className={styles.evoMain}
        onClick={() => multi && setOpen((o) => !o)}
        disabled={!multi}
        title={multi ? 'Voir le détail des évaluations' : undefined}
      >
        <span className={styles.evoName}>{crit.name}</span>
        <span className={styles.evoMeta}>
          {crit.count > 1 && `${crit.count} éval.`}
          {crit.classeAvg !== null && ` · cl. moy. ${crit.classeAvg}%`}
        </span>
        {/* Mini-courbe masquée quand le détail est ouvert (les points y sont déjà) */}
        {multi && !open && <DotSparkline points={crit.history} />}
        <span className={styles.evoScore} style={{ color: scoreColor(crit.averageScore) }}>
          {crit.averageScore}%
        </span>
        <span className={`${styles.evoChevron} ${multi ? '' : styles.evoChevronHidden}`}>
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && (
        <div className={styles.evoDetails}>
          <div className={styles.evoDetailList}>
            {crit.history.map((h, i) => (
              <div key={i} className={styles.evoDetailRow}>
                <span className={styles.evoDetailName}>{h.devoirName}</span>
                <span className={styles.evoDetailDate}>{formatDateShort(h.date)}</span>
                <span className={styles.evoDetailScore} style={{ color: scoreColor(h.score) }}>
                  {h.score}%
                </span>
              </div>
            ))}
          </div>
          {/* Les points, en plus grand, à côté de la liste */}
          <DotSparkline points={crit.history} width={220} height={90} />
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
  totalEvaluations,
}: {
  criteria: Array<CriterionStats | DevoirCriterionStat>;
  globalScore: number;
  classeAvg: number | null;
  classeMax: number | null;
  totalEvaluations: number;
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
            <div className={styles.globalScoreSub}>
              {scoreLabel(globalScore)}
              {totalEvaluations > 1 ? ` · ${totalEvaluations} évaluations` : ''}
            </div>
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

      {/* Tous les autres critères — vue agrégée : groupés par grille
          d'évaluation, avec courbe d'évolution ; vue par activité : liste simple */}
      {otherCriteria.length > 0 && (
        <>
          <h4 className={styles.subTitle}>Tous les critères</h4>
          {'history' in otherCriteria[0] ? (
            (() => {
              const groups = new Map<string, CriterionStats[]>();
              for (const c of otherCriteria as CriterionStats[]) {
                const g = c.grille || 'Autres critères';
                if (!groups.has(g)) groups.set(g, []);
                groups.get(g)!.push(c);
              }
              return [...groups.entries()].map(([grilleName, crits]) => (
                <div key={grilleName} className={styles.grilleGroup}>
                  <div className={styles.grilleGroupTitle}>📋 {grilleName}</div>
                  {crits.map((crit) => (
                    <CriterionEvolutionRow key={crit.name} crit={crit} />
                  ))}
                </div>
              ));
            })()
          ) : (
            <div className={styles.criteriaList}>
              {otherCriteria.map((crit) => {
                const score = 'score' in crit ? crit.score : crit.averageScore;
                return (
                  <CriterionRow
                    key={crit.name}
                    name={crit.name}
                    score={score}
                    classeAvg={crit.classeAvg}
                    classeMax={crit.classeMax}
                  />
                );
              })}
            </div>
          )}
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

// ─── Onglet Lire / Écrire (avec filtre par activité) ─────────────────────────
function SectionTab({ data }: { data: ProfilSection }) {
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const current = useMemo(() => {
    if (activeFilter === 'all') {
      if (!data.stats) return null;
      return { ...data.stats };
    }
    const d = data.devoirs.find((x) => x.devoirId === activeFilter);
    if (!d) return null;
    return {
      criteria: d.criteria,
      globalScore: d.myScore,
      classeAvg: d.classeAvg,
      classeMax: d.classeMax,
      totalEvaluations: 1,
    };
  }, [activeFilter, data]);

  if (!data.stats) {
    return <EmptyState icon="📊" message="Absence de données" />;
  }

  return (
    <section className={styles.section}>
      {data.devoirs.length > 1 && (
        <div className={styles.filterRow}>
          <button
            className={`${styles.filterChip} ${activeFilter === 'all' ? styles.filterChipActive : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            Toutes les activités
          </button>
          {data.devoirs.map((d) => (
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

      {current && (
        <SectionContent
          criteria={current.criteria}
          globalScore={current.globalScore}
          classeAvg={current.classeAvg}
          classeMax={current.classeMax}
          totalEvaluations={current.totalEvaluations}
        />
      )}
    </section>
  );
}

// ─── Onglet Général ──────────────────────────────────────────────────────────
function GeneralTab({ data, onOpenTab }: { data: ProfilGeneral; onOpenTab: (tab: TabId) => void }) {
  const voc = data.vocabulaire;
  const vocTotal = voc?.total || 1;
  const vocPctMaitrise = voc ? Math.round((voc.maitrise / vocTotal) * 100) : 0;

  const domains: Array<{
    tab: TabId; icon: string; name: string;
    value: string; unit?: string; sub: string;
    pct: number; color: string;
    // Barre empilée (carte Vocabulaire) — remplace la barre simple
    segments?: { pct: number; color: string }[];
  }> = [
    {
      tab: 'lire', icon: '📖', name: 'Lire',
      value: data.lire ? `${data.lire.score}%` : '—',
      sub: data.lire
        ? `${data.lire.evaluations} évaluation${data.lire.evaluations > 1 ? 's' : ''}`
        : 'Aucune évaluation',
      pct: data.lire?.score ?? 0,
      color: data.lire ? scoreColor(data.lire.score) : 'var(--c-border)',
    },
    {
      tab: 'ecrire', icon: '✍️', name: 'Écrire',
      value: data.ecrire ? `${data.ecrire.score}%` : '—',
      sub: data.ecrire
        ? `${data.ecrire.evaluations} évaluation${data.ecrire.evaluations > 1 ? 's' : ''}`
        : 'Aucune évaluation',
      pct: data.ecrire?.score ?? 0,
      color: data.ecrire ? scoreColor(data.ecrire.score) : 'var(--c-border)',
    },
    {
      tab: 'parler', icon: '🗣️', name: 'Parler',
      value: '—',
      sub: 'Aucune évaluation',
      pct: 0,
      color: 'var(--c-border)',
    },
    {
      tab: 'rechercher', icon: '🔍', name: 'Rechercher',
      value: data.rechercher ? `${data.rechercher.remises}/${data.rechercher.total}` : '—',
      sub: data.rechercher ? 'recherches remises' : 'Aucune recherche guidée',
      pct: data.rechercher && data.rechercher.total > 0
        ? Math.round((data.rechercher.remises / data.rechercher.total) * 100) : 0,
      color: 'var(--c-primary)',
    },
    {
      tab: 'vocabulaire', icon: '🧠', name: 'Vocabulaire',
      value: voc ? `${vocPctMaitrise}%` : '—',
      unit: voc ? ` maîtrisés` : undefined,
      sub: voc
        ? `${voc.maitrise}/${voc.total} mots${voc.evalMoyenne !== null ? ` · éval. moy. ${voc.evalMoyenne} %` : ''}`
        : 'Aucun mot travaillé',
      pct: vocPctMaitrise,
      color: voc ? scoreColor(vocPctMaitrise) : 'var(--c-border)',
      segments: voc
        ? VOCAB_SEGMENTS.map((s) => ({
            pct: (voc[s.key] / vocTotal) * 100,
            color: s.color,
          }))
        : undefined,
    },
  ];

  return (
    <>
      <div className={styles.topStats}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{data.travauxRemis}</span>
          <span className={styles.statLabel}>Travaux remis</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValueSuccess}>{data.reussites}</span>
          <span className={styles.statLabel}>Réussites ≥ 60%</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValueDanger}>{data.echecs}</span>
          <span className={styles.statLabel}>Échecs &lt; 60%</span>
        </div>
        <div className={`${styles.statCard} ${data.attention.length > 0 ? styles.statCardDanger : styles.statCardSuccess}`}>
          {data.attention.length > 0 ? (
            <>
              <span className={styles.attentionLabel}>⚠ {data.attention.join(', ')}</span>
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

      {data.nonRendusSanctionnes.length > 0 && (
        <div className={styles.sanctionBlock}>
          <div className={styles.sanctionTitle}>
            ⚠ Travaux non faits, non justifiés — note : 0
          </div>
          <div className={styles.sanctionList}>
            {data.nonRendusSanctionnes.map((t, i) => (
              <span key={i} className={styles.sanctionItem}>
                {t.intitule}
                {t.date && <span className={styles.sanctionDate}> — {formatDateShort(t.date)}</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className={styles.domGrid}>
        {domains.map((d) => (
          <button key={d.tab} className={styles.domCard} onClick={() => onOpenTab(d.tab)}>
            <span className={styles.domIcon}>{d.icon}</span>
            <div className={styles.domName}>{d.name}</div>
            <div className={styles.domScore} style={{ color: d.color }}>
              {d.value}
              {d.unit && <span className={styles.domScoreUnit}>{d.unit}</span>}
            </div>
            <div className={styles.domSub}>{d.sub}</div>
            <div className={`${styles.domBarTrack} ${d.segments ? styles.domBarStacked : ''}`}>
              {d.segments
                ? d.segments.filter((s) => s.pct > 0).map((s, i) => (
                    <div key={i} style={{ width: `${s.pct}%`, background: s.color }} />
                  ))
                : <div className={styles.domBarFill} style={{ width: `${d.pct}%`, background: d.color }} />}
            </div>
            <span className={styles.domLink}>Voir le détail →</span>
          </button>
        ))}
      </div>
    </>
  );
}

// ─── Onglet Rechercher ───────────────────────────────────────────────────────
function RechercheTab({ items }: { items: RechercheItem[] }) {
  if (items.length === 0) {
    return <EmptyState icon="📊" message="Absence de données" />;
  }
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Mes recherches guidées (NavigKid)</h2>
      {items.map((item) => (
        <div key={item.devoirId} className={styles.questCard}>
          <div className={styles.questInfo}>
            <div className={styles.questTitle}>{item.titre}</div>
            <div className={styles.questMeta}>
              {item.soumise
                ? `Remise le ${formatDate(item.date)} · ${item.nbReponses}/${item.nbQuestions} questions répondues · ${item.sitesConsultes} sites consultés · ${item.passages} passages surlignés`
                : `${item.nbQuestions} questions · pas encore remise`}
            </div>
          </div>
          <span className={`${styles.questBadge} ${item.soumise ? styles.questBadgeDone : styles.questBadgeTodo}`}>
            {item.soumise ? 'Remise ✓' : 'À faire'}
          </span>
        </div>
      ))}
    </section>
  );
}

// ─── Onglet Vocabulaire ──────────────────────────────────────────────────────

// Date courte « 2 mai » — évite la confusion avec une fraction de score
function formatDateShort(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' });
}

// Pastille de résultat : % coloré en gras, détail (fraction, date) en petit
function ScoreChip({ pct, detail, date }: { pct: number; detail?: string; date?: string }) {
  const sub = [detail, date].filter(Boolean).join(' · ');
  return (
    <span className={styles.scoreChip}>
      <span className={styles.scoreChipPct} style={{ color: scoreColor(pct) }}>
        {Math.round(pct)} %
      </span>
      {sub && <span className={styles.scoreChipSub}>{sub}</span>}
    </span>
  );
}

// Durée lisible — 0 seconde = pas encore mesuré (chronomètre récent)
function formatDuration(sec: number): string {
  if (!sec) return '—';
  const m = Math.max(1, Math.round(sec / 60));
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}

// Ordre du rouge au vert, comme les colonnes de la maîtrise lexicale
const VOCAB_SEGMENTS: { key: keyof VocabActiviteStat['repartition']; label: string; color: string }[] = [
  { key: 'inconnu', label: 'Inconnus', color: '#d8d2c8' },
  { key: 'faible', label: 'Quasiment pas maîtrisés', color: '#c0522b' },
  { key: 'moyen', label: 'Moyennement maîtrisés', color: '#d4a94c' },
  { key: 'maitrise', label: 'Maîtrisés', color: '#4a9a6a' },
];

function VocabActiviteCard({ act }: { act: VocabActiviteStat }) {
  const total = act.totalWords || 1;
  const pctOf = (n: number) => Math.round((n / total) * 100);
  const scorePct = (correct: number, t: number) => (t > 0 ? Math.round((correct / t) * 100) : 0);
  const [initial, ...intermediaires] = act.diagnostics;

  return (
    <div className={styles.vocActCard}>
      <div className={styles.vocActHead}>
        <span className={styles.vocActTitle}>{act.intitule}</span>
        {act.date && <span className={styles.vocActDate}>{formatDate(act.date)}</span>}
      </div>

      <div className={styles.vocActStats}>
        <div className={styles.vocActStat}>
          <span className={styles.vocActStatValue}>{act.ouvertures}</span>
          <span className={styles.vocActStatLabel}>séance{act.ouvertures > 1 ? 's' : ''} d&apos;étude</span>
        </div>
        <div className={styles.vocActStat} title={act.timeSpentSeconds ? undefined : 'Pas encore mesuré'}>
          <span className={styles.vocActStatValue}>{formatDuration(act.timeSpentSeconds)}</span>
          <span className={styles.vocActStatLabel}>temps d&apos;étude</span>
        </div>
        <div className={styles.vocActStat}>
          <span className={styles.vocActStatValue}>{act.learningSessions}</span>
          <span className={styles.vocActStatLabel}>session{act.learningSessions > 1 ? 's' : ''} d&apos;apprentissage</span>
        </div>
        <div className={styles.vocActStat}>
          <span className={styles.vocActStatValue}>{act.evaluations.length}</span>
          <span className={styles.vocActStatLabel}>évaluation{act.evaluations.length > 1 ? 's' : ''}</span>
        </div>
      </div>

      <div className={styles.vocActBar}>
        {VOCAB_SEGMENTS.filter((s) => act.repartition[s.key] > 0).map((s) => (
          <div
            key={s.key}
            style={{ width: `${(act.repartition[s.key] / total) * 100}%`, background: s.color }}
            title={`${s.label} : ${act.repartition[s.key]} mot${act.repartition[s.key] > 1 ? 's' : ''}`}
          />
        ))}
      </div>
      <div className={styles.vocActLegend}>
        {VOCAB_SEGMENTS.map((s) => (
          <span key={s.key} className={styles.vocActLegendItem}>
            <span className={styles.vocActDot} style={{ background: s.color }} />
            {s.label} : {pctOf(act.repartition[s.key])} % ({act.repartition[s.key]})
          </span>
        ))}
      </div>

      <div className={styles.vocActScores}>
        <div className={styles.vocActScoreRow}>
          <span className={styles.vocActScoreLabel}>Diagnostic initial</span>
          {initial
            ? <span className={styles.scoreChips}>
                <ScoreChip
                  pct={scorePct(initial.correct, initial.total)}
                  detail={`${initial.correct}/${initial.total}`}
                  date={formatDateShort(initial.date)}
                />
              </span>
            : <span className={styles.vocActNone}>non fait</span>}
        </div>
        <div className={styles.vocActScoreRow}>
          <span className={styles.vocActScoreLabel}>Diagnostics intermédiaires</span>
          {intermediaires.length > 0
            ? <span className={styles.scoreChips}>
                {intermediaires.map((d, i) => (
                  <ScoreChip
                    key={i}
                    pct={scorePct(d.correct, d.total)}
                    detail={`${d.correct}/${d.total}`}
                    date={formatDateShort(d.date)}
                  />
                ))}
              </span>
            : <span className={styles.vocActNone}>aucun</span>}
        </div>
        <div className={styles.vocActScoreRow}>
          <span className={styles.vocActScoreLabel}>Évaluations</span>
          {act.evaluations.length > 0
            ? <span className={styles.scoreChips}>
                {act.evaluations.map((e, i) => (
                  <ScoreChip key={i} pct={e.percentage} date={formatDateShort(e.date)} />
                ))}
              </span>
            : <span className={styles.vocActNone}>aucune</span>}
        </div>
      </div>
    </div>
  );
}

// Synthèse de toutes les activités vocabulaire — même format que les cartes
// individuelles, affichée en tête de la section.
function VocabOverviewCard({ activites }: { activites: VocabActiviteStat[] }) {
  const sum = (f: (a: VocabActiviteStat) => number) => activites.reduce((s, a) => s + f(a), 0);
  const repartition = {
    maitrise: sum((a) => a.repartition.maitrise),
    moyen: sum((a) => a.repartition.moyen),
    faible: sum((a) => a.repartition.faible),
    inconnu: sum((a) => a.repartition.inconnu),
  };
  const totalWords = sum((a) => a.totalWords);
  const total = totalWords || 1;
  const timeSpent = sum((a) => a.timeSpentSeconds);
  const nbEvals = sum((a) => a.evaluations.length);

  const avg = (vals: number[]) =>
    vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
  const pctDiag = (d: { correct: number; total: number }) =>
    d.total > 0 ? (d.correct / d.total) * 100 : 0;
  const avgInitiaux = avg(
    activites.map((a) => a.diagnostics[0]).filter(Boolean).map(pctDiag)
  );
  const inters = activites.flatMap((a) => a.diagnostics.slice(1));
  const avgInters = avg(inters.map(pctDiag));
  const evals = activites.flatMap((a) => a.evaluations);
  const avgEvals = avg(evals.map((e) => e.percentage));

  return (
    <div className={styles.vocActCard}>
      <div className={styles.vocActHead}>
        <span className={styles.vocActTitle}>Vue d&apos;ensemble</span>
        <span className={styles.vocActDate}>
          {activites.length} activité{activites.length > 1 ? 's' : ''} · {totalWords} mots
        </span>
      </div>

      <div className={styles.vocActStats}>
        <div className={styles.vocActStat}>
          <span className={styles.vocActStatValue}>{sum((a) => a.ouvertures)}</span>
          <span className={styles.vocActStatLabel}>séances d&apos;étude</span>
        </div>
        <div className={styles.vocActStat} title={timeSpent ? undefined : 'Pas encore mesuré'}>
          <span className={styles.vocActStatValue}>{formatDuration(timeSpent)}</span>
          <span className={styles.vocActStatLabel}>temps d&apos;étude</span>
        </div>
        <div className={styles.vocActStat}>
          <span className={styles.vocActStatValue}>{sum((a) => a.learningSessions)}</span>
          <span className={styles.vocActStatLabel}>sessions d&apos;apprentissage</span>
        </div>
        <div className={styles.vocActStat}>
          <span className={styles.vocActStatValue}>{nbEvals}</span>
          <span className={styles.vocActStatLabel}>évaluation{nbEvals > 1 ? 's' : ''}</span>
        </div>
      </div>

      <div className={styles.vocActBar}>
        {VOCAB_SEGMENTS.filter((s) => repartition[s.key] > 0).map((s) => (
          <div
            key={s.key}
            style={{ width: `${(repartition[s.key] / total) * 100}%`, background: s.color }}
            title={`${s.label} : ${repartition[s.key]} mot${repartition[s.key] > 1 ? 's' : ''}`}
          />
        ))}
      </div>
      <div className={styles.vocActLegend}>
        {VOCAB_SEGMENTS.map((s) => (
          <span key={s.key} className={styles.vocActLegendItem}>
            <span className={styles.vocActDot} style={{ background: s.color }} />
            {s.label} : {Math.round((repartition[s.key] / total) * 100)} % ({repartition[s.key]})
          </span>
        ))}
      </div>

      <div className={styles.vocActScores}>
        <div className={styles.vocActScoreRow}>
          <span className={styles.vocActScoreLabel}>Diagnostics initiaux</span>
          {avgInitiaux !== null
            ? <span className={styles.scoreChips}><ScoreChip pct={avgInitiaux} detail="moyenne" /></span>
            : <span className={styles.vocActNone}>aucun</span>}
        </div>
        <div className={styles.vocActScoreRow}>
          <span className={styles.vocActScoreLabel}>Diagnostics intermédiaires</span>
          {avgInters !== null
            ? <span className={styles.scoreChips}>
                <ScoreChip pct={avgInters} detail={`moyenne sur ${inters.length}`} />
              </span>
            : <span className={styles.vocActNone}>aucun</span>}
        </div>
        <div className={styles.vocActScoreRow}>
          <span className={styles.vocActScoreLabel}>Évaluations</span>
          {avgEvals !== null
            ? <span className={styles.scoreChips}>
                <ScoreChip pct={avgEvals} detail={`moyenne sur ${evals.length}`} />
              </span>
            : <span className={styles.vocActNone}>aucune</span>}
        </div>
      </div>
    </div>
  );
}

function VocabGroupCols({ group }: { group: ProfilVocabGroup }) {
  const cols: [string, (l: number) => boolean][] = [
    ['inconnus', (l) => l <= 1],
    ['fragiles', (l) => l === 2 || l === 3],
    ['connus', (l) => l >= 4],
  ];
  return (
    <div className={styles.themeGroup}>
      <div className={styles.themeHead}>
        {group.isPerso ? '⭐' : '📚'} {group.name}
        <span className={styles.themeCount}>— {group.words.length} mots</span>
      </div>
      <div className={styles.themeCols}>
        {cols.map(([key, match]) => (
          <div key={key} className={styles.themeCol}>
            {group.words
              .filter((w) => match(w.level))
              .sort((a, b) => (a.level - b.level) || (a.successes - b.successes))
              .map((w) => (
              <span
                key={w.word}
                className={`${styles.wordChip} ${styles[`level${w.level}`]}`}
                data-tip={w.attempts === 0
                  ? 'Jamais testé'
                  : `${w.attempts} tentative${w.attempts > 1 ? 's' : ''} · ${w.successes} réussite${w.successes > 1 ? 's' : ''}`}
              >
                {w.word}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// profView : un prof consulte la fiche — statistiques par activité seulement,
// sans les listes de mots (réservées à la vue élève).
function VocabulaireTab({ data, profView }: { data: ProfilVocabulaire; profView: boolean }) {
  if (data.activites.length === 0 && data.groups.length === 0 && data.perso.length === 0) {
    return <EmptyState icon="📊" message="Absence de données" />;
  }
  return (
    <>
      {data.activites.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Activités de vocabulaire</h2>
          <VocabOverviewCard activites={data.activites} />
          {data.activites.map((a) => <VocabActiviteCard key={a.devoirId} act={a} />)}
        </section>
      )}

      {!profView && data.groups.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Maîtrise lexicale</h2>
          <div className={styles.gradientBar} />
          <div className={styles.colHeads}>
            <div className={styles.colHead} style={{ color: '#7b241c' }}>
              Inconnus<span className={styles.colHeadSub}>jamais réussis ou jamais testés</span>
            </div>
            <div className={styles.colHead} style={{ color: '#c0522b' }}>
              Fragiles<span className={styles.colHeadSub}>quelques réussites</span>
            </div>
            <div className={styles.colHead} style={{ color: '#4a9a6a' }}>
              Connus<span className={styles.colHeadSub}>réussis régulièrement</span>
            </div>
          </div>
          {data.groups.map((g) => <VocabGroupCols key={g.id} group={g} />)}
        </section>
      )}

      {/* La liste personnelle (mots + définitions) vit désormais dans la page
          élève « Mes ressources personnelles » (/mes-ressources). */}
    </>
  );
}

// ─── Panneau principal ────────────────────────────────────────────────────────

interface ProfilPanelProps {
  // Consultation par un prof : id du document eleves/{id} — absent = profil
  // de l'utilisateur connecté
  eleveId?: string;
}

export default function ProfilPanel({ eleveId }: ProfilPanelProps) {
  const { isAuthenticated, getAuthHeaders } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('general');

  // Données par onglet — chargées à la première ouverture de l'onglet
  const [general, setGeneral] = useState<ProfilGeneral | null>(null);
  const [lecture, setLecture] = useState<ProfilSection | null>(null);
  const [ecriture, setEcriture] = useState<ProfilSection | null>(null);
  const [recherche, setRecherche] = useState<RechercheItem[] | null>(null);
  const [vocabulaire, setVocabulaire] = useState<ProfilVocabulaire | null>(null);
  const fetchedTabs = useRef(new Set<TabId>());

  useEffect(() => {
    if (!isAuthenticated) return;
    if (activeTab === 'parler') return; // pas encore de données orales
    const tab = activeTab;
    if (fetchedTabs.current.has(tab)) return;
    fetchedTabs.current.add(tab);

    (async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const query = eleveId ? `?eleveId=${encodeURIComponent(eleveId)}` : '';
        const res = await fetch(TAB_ENDPOINTS[tab] + query, { headers });
        const json = await res.json();
        if (!json.success) return;
        switch (tab) {
          case 'general': setGeneral(json.data); break;
          case 'lire': setLecture(json.data); break;
          case 'ecrire': setEcriture(json.data); break;
          case 'rechercher': setRecherche(json.data); break;
          case 'vocabulaire': setVocabulaire(json.data); break;
        }
      } catch (err) {
        console.error(`Erreur fetch profil (${tab}):`, err);
      }
    })();
  }, [activeTab, isAuthenticated, getAuthHeaders, eleveId]);

  const loadingState = <EmptyState icon="hourglass" message="En cours de chargement" />;

  return (
    <>
      <div className={styles.tabsBar}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`${styles.tabBtn} ${activeTab === t.id ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'general' && (
        general ? <GeneralTab data={general} onOpenTab={setActiveTab} /> : loadingState
      )}
      {activeTab === 'lire' && (
        lecture ? <SectionTab data={lecture} /> : loadingState
      )}
      {activeTab === 'ecrire' && (
        ecriture ? <SectionTab data={ecriture} /> : loadingState
      )}
      {activeTab === 'parler' && (
        <EmptyState icon="🗣️" message="Aucune activité orale évaluée pour le moment." />
      )}
      {activeTab === 'rechercher' && (
        recherche ? <RechercheTab items={recherche} /> : loadingState
      )}
      {activeTab === 'vocabulaire' && (
        vocabulaire ? <VocabulaireTab data={vocabulaire} profView={!!eleveId} /> : loadingState
      )}
    </>
  );
}
