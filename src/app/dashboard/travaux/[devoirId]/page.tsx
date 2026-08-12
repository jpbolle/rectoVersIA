'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import UserAvatar from '@/components/UserAvatar';
import type { Devoir } from '@/types/devoir';
import type { Travail } from '@/types/travail';
import type { Correction } from '@/types/correction';
import type { Grille } from '@/types/grille';
import { LEVEL_PERCENTAGES } from '@/types/grille';
import type { NavigKidQuestion } from '@/types/navigkid';
import Link from 'next/link';
import Footer from '@/components/Footer/Footer';
import styles from './travaux.module.css';

export default function TravauxPage() {
  const params = useParams();
  const router = useRouter();
  const devoirId = params.devoirId as string;

  const { isAuthenticated, role, isLoading: authLoading, getAuthHeaders } = useAuth();
  const [devoir, setDevoir] = useState<Devoir | null>(null);
  const [travaux, setTravaux] = useState<Travail[]>([]);
  const [corrections, setCorrections] = useState<Map<string, Correction>>(new Map());
  const [grille, setGrille] = useState<Grille | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [showEcritureStats, setShowEcritureStats] = useState(false);
  const copyTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [questionnaire, setQuestionnaire] = useState<NavigKidQuestion[] | null>(null);
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);

  useEffect(() => {
    if (role && role !== 'prof') {
      router.replace('/dashboard');
    }
  }, [authLoading, role, router]);

  useEffect(() => {
    async function fetchData() {
      const headers = await getAuthHeaders();
      if (!headers) return;

      setIsLoading(true);
      setError(null);

      try {
        const devoirRes = await fetch(`/api/devoirs/${devoirId}`, { headers });
        const devoirJson = await devoirRes.json();

        if (devoirJson.success) {
          setDevoir(devoirJson.data);

          if (devoirJson.data.typeTravail === 'rechercher' && devoirJson.data.questionnaireId) {
            const qRes = await fetch(`/api/navigkid/questionnaire?id=${devoirJson.data.questionnaireId}`, { headers });
            const qJson = await qRes.json();
            if (qJson.success) setQuestionnaire(qJson.data.questions || []);
          }

          if (devoirJson.data.grille) {
            const grilleRes = await fetch(`/api/grilles/${encodeURIComponent(devoirJson.data.grille)}`, { headers });
            const grilleJson = await grilleRes.json();
            if (grilleJson.success) setGrille(grilleJson.data);
          }
        } else {
          setError('Devoir non trouve');
          return;
        }

        const [travauxRes, correctionsRes] = await Promise.all([
          fetch(`/api/travaux?devoirId=${devoirId}`, { headers }),
          fetch(`/api/corrections?devoirId=${devoirId}`, { headers }),
        ]);

        const travauxJson = await travauxRes.json();
        if (travauxJson.success) setTravaux(travauxJson.data);

        const correctionsJson = await correctionsRes.json();
        if (correctionsJson.success && Array.isArray(correctionsJson.data)) {
          const map = new Map<string, Correction>();
          for (const c of correctionsJson.data) map.set(c.travailId, c);
          setCorrections(map);
        }
      } catch (err) {
        console.error('Erreur fetch data:', err);
        setError('Erreur lors du chargement');
      } finally {
        setIsLoading(false);
      }
    }

    if (isAuthenticated && role === 'prof') fetchData();
  }, [isAuthenticated, role, devoirId, getAuthHeaders]);

  const isLate = useCallback(
    (travail: Travail) => {
      if (!devoir?.dateRemise || !travail.submittedAt) return false;
      const deadline = new Date(devoir.dateRemise);
      deadline.setHours(23, 59, 59, 999);
      return new Date(travail.submittedAt) > deadline;
    },
    [devoir]
  );

  const isNotOpened = useCallback((travail: Travail) => {
    return travail.status === 'draft' && travail.content === '';
  }, []);

  const { travauxNonOuverts, travauxNonCorriges, travauxCorriges } = useMemo(() => {
    const nonOuverts: Travail[] = [];
    const nonCorriges: Travail[] = [];
    const corriges: Travail[] = [];

    for (const t of travaux) {
      const correction = corrections.get(t.id);
      // Copie marquée « non rendu » : plus rien à corriger → colonne Corrigés
      if (t.nonRendu) corriges.push(t);
      else if (isNotOpened(t)) nonOuverts.push(t);
      else if (correction && correction.score > 0) corriges.push(t);
      else nonCorriges.push(t);
    }

    nonOuverts.sort((a, b) => a.studentName.localeCompare(b.studentName));
    nonCorriges.sort((a, b) => {
      const aLate = isLate(a) ? 1 : 0;
      const bLate = isLate(b) ? 1 : 0;
      if (aLate !== bLate) return aLate - bLate;
      return a.studentName.localeCompare(b.studentName);
    });
    corriges.sort((a, b) => a.studentName.localeCompare(b.studentName));

    return { travauxNonOuverts: nonOuverts, travauxNonCorriges: nonCorriges, travauxCorriges: corriges };
  }, [travaux, corrections, isLate, isNotOpened]);

  const stats = useMemo(() => {
    // Copies marquées « non rendu » : les justifiées sortent des statistiques,
    // les non justifiées comptent comme un 0 (cote finale disciplinaire)
    const nonRenduIds = new Set(travaux.filter((t) => t.nonRendu).map((t) => t.id));
    const excusedCount = travaux.filter((t) => t.nonRendu === 'justifie').length;
    const sanctionedCount = travaux.filter((t) => t.nonRendu === 'nonJustifie').length;

    const submittedCount = travaux.filter((t) => t.status === 'submitted' && !t.nonRendu).length;
    const remiseTotal = travaux.length - excusedCount;
    const tauxRemise = remiseTotal > 0 ? Math.round((submittedCount / remiseTotal) * 100) : null;

    const correctedOnes = Array.from(corrections.entries())
      .filter(([travailId, c]) => c.score > 0 && !nonRenduIds.has(travailId))
      .map(([, c]) => c);
    const allScores = [
      ...correctedOnes.map((c) => c.score),
      ...Array(sanctionedCount).fill(0) as number[],
    ];
    const successCount = allScores.filter((s) => s >= 50).length;
    const failureCount = allScores.filter((s) => s < 50).length;

    const sortedScores = [...allScores].sort((a, b) => a - b);
    const n = sortedScores.length;
    const moyenne = n > 0 ? Math.round(sortedScores.reduce((s, v) => s + v, 0) / n) : null;
    const mediane = n === 0 ? null
      : n % 2 === 0
        ? Math.round((sortedScores[n / 2 - 1] + sortedScores[n / 2]) / 2)
        : sortedScores[Math.floor(n / 2)];

    // Distribution par tranches (les 0 disciplinaires comptent en « faible »)
    const distribution = {
      faible: allScores.filter((s) => s < 45).length,
      insuffisant: allScores.filter((s) => s >= 45 && s < 65).length,
      reussi: allScores.filter((s) => s >= 65).length,
    };

    // 3 critères les plus faibles
    const weakestCriteria: { name: string; avgPct: number }[] = [];
    if (grille && correctedOnes.length > 0) {
      for (const criterion of grille.criteria) {
        const levels = correctedOnes
          .map((c) => c.evaluation[criterion.id])
          .filter((l) => l !== undefined) as number[];
        if (levels.length === 0) continue;
        const avgPct = Math.round(
          levels.reduce((s, l) => s + (LEVEL_PERCENTAGES[l as keyof typeof LEVEL_PERCENTAGES] ?? 0), 0) / levels.length
        );
        weakestCriteria.push({ name: criterion.name, avgPct });
      }
      weakestCriteria.sort((a, b) => a.avgPct - b.avgPct);
    }
    const top3Weak = weakestCriteria.slice(0, 3);

    // Statistiques d'écriture (ortho / ponctu / syntaxe)
    const orthoStudents: string[] = [];
    const ponctuStudents: string[] = [];
    const syntaxeStudents: string[] = [];
    const multipleIssuesStudents: string[] = [];

    if (grille) {
      const orthoCrits = grille.criteria.filter((c) => /orthograph/i.test(c.name));
      const ponctuCrits = grille.criteria.filter((c) => /ponctuat/i.test(c.name));
      const syntaxeCrits = grille.criteria.filter((c) => /syntaxe|syntact/i.test(c.name));

      for (const [travailId, correction] of corrections) {
        if (correction.score === 0) continue;
        const travail = travaux.find((t) => t.id === travailId);
        if (!travail) continue;

        const hasOrtho = orthoCrits.some((c) => correction.evaluation[c.id] !== undefined && correction.evaluation[c.id] <= 2);
        const hasPonctu = ponctuCrits.some((c) => correction.evaluation[c.id] !== undefined && correction.evaluation[c.id] <= 2);
        const hasSyntaxe = syntaxeCrits.some((c) => correction.evaluation[c.id] !== undefined && correction.evaluation[c.id] <= 2);

        if (hasOrtho) orthoStudents.push(travail.studentName);
        if (hasPonctu) ponctuStudents.push(travail.studentName);
        if (hasSyntaxe) syntaxeStudents.push(travail.studentName);
        if ([hasOrtho, hasPonctu, hasSyntaxe].filter(Boolean).length >= 2)
          multipleIssuesStudents.push(travail.studentName);
      }

      orthoStudents.sort((a, b) => a.localeCompare(b));
      ponctuStudents.sort((a, b) => a.localeCompare(b));
      syntaxeStudents.sort((a, b) => a.localeCompare(b));
      multipleIssuesStudents.sort((a, b) => a.localeCompare(b));
    }

    return {
      tauxRemise, submittedCount,
      successCount, failureCount,
      moyenne, mediane,
      distribution, top3Weak,
      orthoStudents, ponctuStudents, syntaxeStudents, multipleIssuesStudents,
    };
  }, [corrections, travaux, grille]);

  const scoreClass = (val: number | null) => {
    if (val === null) return styles.statValue;
    if (val < 50) return styles.statValueDanger;
    if (val < 60) return styles.statValueWarning;
    return styles.statValueSuccess;
  };

  const handleCopyCode = useCallback(() => {
    if (!devoir?.codeAcces) return;
    navigator.clipboard.writeText(devoir.codeAcces);
    setCodeCopied(true);
    clearTimeout(copyTimeout.current);
    copyTimeout.current = setTimeout(() => setCodeCopied(false), 2000);
  }, [devoir?.codeAcces]);

  const handleBack = () => router.push('/dashboard');

  if ((authLoading && !isAuthenticated) || isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <span>Chargement...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <span>⚠️</span>
        <h2>Erreur</h2>
        <p>{error}</p>
        <button onClick={handleBack} className={styles.backButton}>Retour au tableau de bord</button>
      </div>
    );
  }

  const totalCorriges = stats.successCount + stats.failureCount;

  const renderCard = (travail: Travail) => {
    const correction = corrections.get(travail.id);
    const hasScore = correction && correction.score > 0;
    const late = isLate(travail);
    const notOpened = isNotOpened(travail);

    return (
      <div
        key={travail.id}
        className={`${styles.travailCard} ${notOpened ? styles.travailCardNotOpened : ''}`}
        onClick={() => router.push(`/dashboard/travaux/${devoirId}/${travail.id}`)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && router.push(`/dashboard/travaux/${devoirId}/${travail.id}`)}
      >
        <div className={styles.travailHeader}>
          <div className={styles.headerTags}>
            <span className={styles.studentName}>{travail.studentName}</span>
            {notOpened ? (
              <span className={`${styles.statusBadge} ${styles.statusNotOpened}`}>Non ouvert</span>
            ) : (
              <span className={`${styles.statusBadge} ${travail.status === 'submitted' ? styles.statusSubmitted : styles.statusDraft}`}>
                {travail.status === 'submitted' ? 'Remis' : 'Brouillon'}
              </span>
            )}
            {late && <span className={styles.lateBadge}>En retard</span>}
            {travail.nonRendu && (
              <span className={`${styles.statusBadge} ${styles.statusNonRendu}`}>
                {travail.nonRendu === 'justifie' ? 'Non rendu — justifié' : 'Non fait — 0'}
              </span>
            )}
          </div>
          {hasScore && <span className={styles.scoreBubble}>{correction.score}%</span>}
        </div>
        {!notOpened && (
          <div className={styles.travailMeta}>
            <span className={styles.date}>
              {travail.submittedAt
                ? `Remis le ${new Date(travail.submittedAt).toLocaleDateString('fr-BE')}`
                : `Modifié le ${new Date(travail.updatedAt).toLocaleDateString('fr-BE')}`}
            </span>
          </div>
        )}
      </div>
    );
  };

  const renderStudentList = (names: string[]) => {
    if (names.length === 0) return <span className={styles.autresStatsNone}>Aucun élève</span>;
    return (
      <div className={styles.autresStatsList}>
        {names.map((name) => (
          <span key={name} className={styles.autresStatsChip}>{name}</span>
        ))}
      </div>
    );
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/" className={styles.logoLink}>
            <img src="/logoRecto.png" alt="Recto-VersIA" className={styles.logoImg} />
          </Link>
          <button className={styles.backBtn} onClick={handleBack}>←</button>
          <div className={styles.headerContent}>
            <h1 className={styles.title}>{devoir?.intitule || 'Travaux'}</h1>
            <p className={styles.subtitle}>Travaux des élèves</p>
            {devoir?.codeAcces && (
              <button className={styles.codeAccesBadge} onClick={handleCopyCode} title="Copier le code d'accès">
                Code extension : <strong>{devoir.codeAcces}</strong>
                <span className={styles.codeAccesCopy}>{codeCopied ? '✓' : '⎘'}</span>
              </button>
            )}
          </div>
        </div>
        <div className={styles.headerRight}><UserAvatar /></div>
      </header>

      {questionnaire && (
        <div className={styles.questionnairePanel}>
          <button className={styles.questionnairePanelToggle} onClick={() => setShowQuestionnaire((v) => !v)}>
            📋 Questionnaire ({questionnaire.length} question{questionnaire.length > 1 ? 's' : ''})
            <span>{showQuestionnaire ? '▲' : '▼'}</span>
          </button>
          {showQuestionnaire && (
            <ol className={styles.questionnaireList}>
              {questionnaire.map((q, i) => (
                <li key={i} className={styles.questionnaireItem}>
                  <span className={styles.questionnaireTexte}>{q.texte}</span>
                  <span className={styles.questionnaireType}>{q.type === 'qcm' ? 'QCM' : 'Texte libre'}</span>
                  {q.type === 'qcm' && q.options && (
                    <ul className={styles.questionnaireOptions}>
                      {q.options.map((opt, j) => (
                        <li key={j} className={q.correctes?.includes(j) ? styles.correctOption : ''}>
                          {opt}{q.correctes?.includes(j) && ' ✓'}
                        </li>
                      ))}
                    </ul>
                  )}
                  {q.reponseAttendue && <p className={styles.questionnaireCorrige}><em>Corrigé : {q.reponseAttendue}</em></p>}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      <main className={styles.main}>
        {/* ── Section Statistiques ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Statistiques</h2>

          {/* Ligne 1 : 4 encadrés principaux */}
          <div className={styles.stats}>
            <div className={styles.statCard}>
              <span className={scoreClass(stats.tauxRemise)}>
                {stats.tauxRemise !== null ? `${stats.tauxRemise}%` : '—'}
              </span>
              <span className={styles.statLabel}>
                Taux de remise
                <span className={styles.statSub}>{stats.submittedCount} / {travaux.length}</span>
              </span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statValueSuccess}>{stats.successCount}</span>
              <span className={styles.statLabel}>Réussites ≥ 50%</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statValueDanger}>{stats.failureCount}</span>
              <span className={styles.statLabel}>Échecs &lt; 50%</span>
            </div>
            <div className={styles.statCard}>
              <span className={scoreClass(stats.moyenne)}>
                {stats.moyenne !== null ? `${stats.moyenne}%` : '—'}
              </span>
              <span className={styles.statLabel}>Moyenne</span>
            </div>
            <div className={styles.statCard}>
              <span className={scoreClass(stats.mediane)}>
                {stats.mediane !== null ? `${stats.mediane}%` : '—'}
              </span>
              <span className={styles.statLabel}>
                Médiane
                <span className={styles.tooltipWrapper}>
                  <span className={styles.tooltipIcon}>ⓘ</span>
                  <span className={styles.tooltip}>
                    La médiane est la valeur centrale : la moitié des élèves est au-dessus, l&apos;autre moitié en dessous. Moins sensible aux scores extrêmes que la moyenne.
                  </span>
                </span>
              </span>
            </div>
          </div>

          {/* Ligne 2 : critères faibles + distribution */}
          {totalCorriges > 0 && grille && (
            <div className={styles.statsRow2}>
              {/* 3 critères les plus faibles */}
              <div className={`${styles.statCard} ${styles.statCardWide}`}>
                <span className={styles.statCardTitle}>3 critères les plus faibles</span>
                {stats.top3Weak.length === 0 ? (
                  <span className={styles.autresStatsNone}>Pas encore de données</span>
                ) : (
                  <div className={styles.weakCriteriaList}>
                    {stats.top3Weak.map((c, i) => (
                      <div key={i} className={styles.weakCriterionRow}>
                        <span className={styles.weakCriterionName}>{c.name}</span>
                        <div className={styles.weakCriterionBar}>
                          <div
                            className={styles.weakCriterionFill}
                            style={{
                              width: `${c.avgPct}%`,
                              background: c.avgPct < 35 ? 'var(--c-danger)' : c.avgPct < 60 ? 'var(--c-accent)' : 'var(--c-success)',
                            }}
                          />
                        </div>
                        <span className={styles.weakCriterionPct}>{c.avgPct}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Distribution par tranches */}
              <div className={`${styles.statCard} ${styles.statCardWide}`}>
                <span className={styles.statCardTitle}>Distribution des résultats</span>
                <div className={styles.distrib}>
                  {[
                    { label: '0–44%', count: stats.distribution.faible, color: 'var(--c-danger)' },
                    { label: '45–64%', count: stats.distribution.insuffisant, color: 'var(--c-accent)' },
                    { label: '65–100%', count: stats.distribution.reussi, color: 'var(--c-primary)' },
                  ].map(({ label, count, color }) => (
                    <div key={label} className={styles.distribRow}>
                      <span className={styles.distribLabel}>{label}</span>
                      <div className={styles.distribBarTrack}>
                        <div
                          className={styles.distribBarFill}
                          style={{
                            width: totalCorriges > 0 ? `${Math.round((count / totalCorriges) * 100)}%` : '0%',
                            background: color,
                          }}
                        />
                      </div>
                      <span className={styles.distribCount}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Statistiques d'écriture (collapsible) */}
          {grille && (
            <div className={styles.autresStats}>
              <button className={styles.autresStatsToggle} onClick={() => setShowEcritureStats((v) => !v)}>
                <span>Statistiques d&apos;écriture</span>
                <span className={styles.autresStatsChevron}>{showEcritureStats ? '▲' : '▼'}</span>
              </button>
              {showEcritureStats && (
                <div className={styles.autresStatsContent}>
                  <div className={styles.autresStatsRow}>
                    <div className={`${styles.autresStatsGroup} ${styles.autresStatsGroupAlert}`}>
                      <span className={styles.autresStatsGroupTitle}>
                        ⚠️ 2 soucis d&apos;écriture ou plus
                        <span className={styles.autresStatsBadge}>{stats.multipleIssuesStudents.length}</span>
                      </span>
                      {renderStudentList(stats.multipleIssuesStudents)}
                    </div>
                  </div>
                  <div className={styles.autresStatsRow}>
                    <div className={styles.autresStatsGroup}>
                      <span className={styles.autresStatsGroupTitle}>
                        Orthographe
                        <span className={styles.autresStatsBadge}>{stats.orthoStudents.length}</span>
                      </span>
                      {renderStudentList(stats.orthoStudents)}
                    </div>
                    <div className={styles.autresStatsGroup}>
                      <span className={styles.autresStatsGroupTitle}>
                        Ponctuation
                        <span className={styles.autresStatsBadge}>{stats.ponctuStudents.length}</span>
                      </span>
                      {renderStudentList(stats.ponctuStudents)}
                    </div>
                    <div className={styles.autresStatsGroup}>
                      <span className={styles.autresStatsGroupTitle}>
                        Syntaxe
                        <span className={styles.autresStatsBadge}>{stats.syntaxeStudents.length}</span>
                      </span>
                      {renderStudentList(stats.syntaxeStudents)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── Section Résultats ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Résultats</h2>

          {travaux.length === 0 ? (
            <div className={styles.empty}>
              <span>📝</span>
              <p>Aucun élève dans les classes de ce devoir.</p>
            </div>
          ) : (
            <div className={styles.columns}>
              <div className={styles.column}>
                <h3 className={`${styles.columnTitle} ${styles.columnTitleNotOpened}`}>
                  🔒 Non ouvert par l&apos;élève
                  <span className={styles.columnCount}>{travauxNonOuverts.length}</span>
                </h3>
                {travauxNonOuverts.length === 0 ? (
                  <p className={styles.columnEmpty}>Tous les élèves ont ouvert leur copie.</p>
                ) : (
                  <div className={styles.travauxList}>{travauxNonOuverts.map(renderCard)}</div>
                )}
              </div>

              <div className={styles.column}>
                <h3 className={styles.columnTitle}>
                  📝 À corriger
                  <span className={styles.columnCount}>{travauxNonCorriges.length}</span>
                </h3>
                {travauxNonCorriges.length === 0 ? (
                  <p className={styles.columnEmpty}>Aucun travail à corriger.</p>
                ) : (
                  <div className={styles.travauxList}>{travauxNonCorriges.map(renderCard)}</div>
                )}
              </div>

              <div className={styles.column}>
                <h3 className={`${styles.columnTitle} ${styles.columnTitleCorrected}`}>
                  ✅ Corrigés
                  <span className={styles.columnCount}>{travauxCorriges.length}</span>
                </h3>
                {travauxCorriges.length === 0 ? (
                  <p className={styles.columnEmpty}>Aucun travail corrigé pour l&apos;instant.</p>
                ) : (
                  <div className={styles.travauxList}>{travauxCorriges.map(renderCard)}</div>
                )}
              </div>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
