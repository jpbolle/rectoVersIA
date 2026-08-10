'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useStudentClasses } from '@/hooks/useStudentClasses';
import Header from '@/components/Header/Header';
import Footer from '@/components/Footer/Footer';
import EmptyState from '@/components/EmptyState/EmptyState';
import type {
  CriterionStats, DevoirCriterionStat,
  ProfilGeneral, ProfilSection, RechercheItem, ProfilVocabulaire, ProfilVocabGroup,
} from '@/types/profil';
import styles from './profil.module.css';

// ─── Onglets ─────────────────────────────────────────────────────────────────

type TabId = 'general' | 'lire' | 'ecrire' | 'rechercher' | 'vocabulaire';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'general', label: 'Général', icon: '🏠' },
  { id: 'lire', label: 'Lire', icon: '📖' },
  { id: 'ecrire', label: 'Écrire', icon: '✍️' },
  { id: 'rechercher', label: 'Rechercher', icon: '🔍' },
  { id: 'vocabulaire', label: 'Vocabulaire', icon: '🧠' },
];

const TAB_ENDPOINTS: Record<TabId, string> = {
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

// ─── Onglet Lire / Écrire (avec filtre par activité) ─────────────────────────
function SectionTab({ data, emptyMessage }: { data: ProfilSection; emptyMessage: string }) {
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
    return <EmptyState icon="chart" message={emptyMessage} />;
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
  const domains: Array<{
    tab: TabId; icon: string; name: string;
    value: string; unit?: string; sub: string;
    pct: number; color: string;
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
      tab: 'rechercher', icon: '🔍', name: 'Rechercher',
      value: data.rechercher ? `${data.rechercher.remises}/${data.rechercher.total}` : '—',
      sub: data.rechercher ? 'recherches remises' : 'Aucune recherche guidée',
      pct: data.rechercher && data.rechercher.total > 0
        ? Math.round((data.rechercher.remises / data.rechercher.total) * 100) : 0,
      color: 'var(--c-primary)',
    },
    {
      tab: 'vocabulaire', icon: '🧠', name: 'Vocabulaire',
      value: data.vocabulaire ? `${data.vocabulaire.connus}` : '—',
      unit: data.vocabulaire ? `/${data.vocabulaire.total} mots` : undefined,
      sub: data.vocabulaire ? 'mots connus' : 'Aucun mot travaillé',
      pct: data.vocabulaire && data.vocabulaire.total > 0
        ? Math.round((data.vocabulaire.connus / data.vocabulaire.total) * 100) : 0,
      color: 'var(--c-primary)',
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
            <div className={styles.domBarTrack}>
              <div className={styles.domBarFill} style={{ width: `${d.pct}%`, background: d.color }} />
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
    return <EmptyState icon="chart" message="Aucune recherche guidée pour le moment." />;
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

function VocabulaireTab({ data }: { data: ProfilVocabulaire }) {
  if (data.groups.length === 0 && data.perso.length === 0) {
    return <EmptyState icon="chart" message="Aucun mot de vocabulaire travaillé pour le moment." />;
  }
  return (
    <>
      {data.groups.length > 0 && (
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

      {data.perso.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Liste personnelle</h2>
          <div className={styles.persoNote}>
            Les mots dont tu as demandé la définition, dans l&apos;app ou avec NavigKid.
          </div>
          <div>
            {data.perso.map((w) => (
              <div key={w.word} className={styles.persoItem}>
                <span className={styles.persoWord}>{w.word}</span>
                <span className={styles.persoDef}>{w.definition}</span>
                {w.addedAt && <span className={styles.persoDate}>{formatDate(w.addedAt)}</span>}
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function ProfilPage() {
  const { isAuthenticated, isLoading: authLoading, role, getAuthHeaders } = useAuth();
  const router = useRouter();
  const { classes, isLoading: classesLoading } = useStudentClasses();
  const [isReady, setIsReady] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('general');

  // Données par onglet — chargées à la première ouverture de l'onglet
  const [general, setGeneral] = useState<ProfilGeneral | null>(null);
  const [lecture, setLecture] = useState<ProfilSection | null>(null);
  const [ecriture, setEcriture] = useState<ProfilSection | null>(null);
  const [recherche, setRecherche] = useState<RechercheItem[] | null>(null);
  const [vocabulaire, setVocabulaire] = useState<ProfilVocabulaire | null>(null);
  const fetchedTabs = useRef(new Set<TabId>());

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

  useEffect(() => {
    if (!isAuthenticated) return;
    const tab = activeTab;
    if (fetchedTabs.current.has(tab)) return;
    fetchedTabs.current.add(tab);

    (async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const res = await fetch(TAB_ENDPOINTS[tab], { headers });
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
  }, [activeTab, isAuthenticated, getAuthHeaders]);

  // Guard après tous les hooks
  if (!isAuthenticated || (role === 'eleve' && classesLoading)) return null;

  const loadingState = <EmptyState icon="hourglass" message="Chargement..." />;

  return (
    <div className={`${styles.pageWrapper} ${isReady ? styles.ready : ''}`}>
      <Header variant={role === 'prof' ? 'prof' : 'student'} />

      <main className={styles.main}>
        <h1 className={styles.pageTitle}>Mon profil d&apos;écrilecteur</h1>
        <p className={styles.pageSubtitle}>
          Tes résultats agrégés sur toutes les évaluations corrigées
        </p>

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
          lecture
            ? <SectionTab data={lecture} emptyMessage="Aucun travail de lecture évalué pour le moment." />
            : loadingState
        )}
        {activeTab === 'ecrire' && (
          ecriture
            ? <SectionTab data={ecriture} emptyMessage="Aucun travail d'écriture évalué pour le moment." />
            : loadingState
        )}
        {activeTab === 'rechercher' && (
          recherche ? <RechercheTab items={recherche} /> : loadingState
        )}
        {activeTab === 'vocabulaire' && (
          vocabulaire ? <VocabulaireTab data={vocabulaire} /> : loadingState
        )}
      </main>

      <Footer />
    </div>
  );
}
