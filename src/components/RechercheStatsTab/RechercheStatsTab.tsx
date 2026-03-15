'use client';

import { useMemo } from 'react';
import type { NavigKidQuestion, NavigKidReponse } from '@/types/navigkid';
import styles from './RechercheStatsTab.module.css';

interface RechercheStatsTabProps {
  questions: NavigKidQuestion[];
  reponse: NavigKidReponse | null;
}

function formatTemps(ms: number): string {
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const resteSec = sec % 60;
  return `${min}m${resteSec > 0 ? `${resteSec}s` : ''}`;
}

export default function RechercheStatsTab({
  questions,
  reponse,
}: RechercheStatsTabProps) {
  const stats = useMemo(() => {
    if (!reponse?.questions) {
      return null;
    }

    const qData = reponse.questions;

    // Nombre de réponses complètes
    const answeredCount = qData.filter(q => q.reponse?.trim()).length;

    // Total mots-clés
    const allMotsCles: Record<string, number> = {};
    qData.forEach(q => {
      q.motsCles?.forEach(mc => {
        const key = mc.texte.toLowerCase();
        allMotsCles[key] = (allMotsCles[key] || 0) + 1;
      });
    });

    // Total sites + domaines
    const allSites = qData.flatMap(q => q.sitesConsultes || []);
    const totalTemps = allSites.reduce((sum, s) => sum + (s.tempsPasse || 0), 0);

    const domainMap: Record<string, { count: number; temps: number }> = {};
    allSites.forEach(s => {
      let hostname: string;
      try {
        hostname = new URL(s.url).hostname;
      } catch {
        hostname = s.url;
      }
      if (!domainMap[hostname]) {
        domainMap[hostname] = { count: 0, temps: 0 };
      }
      domainMap[hostname].count++;
      domainMap[hostname].temps += s.tempsPasse || 0;
    });

    const domains = Object.entries(domainMap)
      .sort((a, b) => b[1].temps - a[1].temps)
      .slice(0, 10);

    // Total passages
    const totalPassages = qData.reduce((sum, q) => sum + (q.passages?.length || 0), 0);

    // Progression par question
    const progression = questions.map((question, index) => {
      const qd = qData.find(q => q.questionIndex === index);
      const hasReponse = !!qd?.reponse?.trim();
      const sourcesCollectees = qd?.sitesConsultes?.length || 0;
      const sourcesRequises = question.nbSources || 1;
      const sourcesRatio = Math.min(sourcesCollectees / sourcesRequises, 1);
      return {
        index,
        hasReponse,
        sourcesCollectees,
        sourcesRequises,
        completionPct: Math.round(((hasReponse ? 0.5 : 0) + sourcesRatio * 0.5) * 100),
      };
    });

    return {
      answeredCount,
      totalQuestions: questions.length,
      motsCles: Object.entries(allMotsCles).sort((a, b) => b[1] - a[1]),
      totalSites: allSites.length,
      totalTemps,
      totalPassages,
      domains,
      progression,
    };
  }, [questions, reponse]);

  if (!stats) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          Aucune donnée de recherche disponible.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Résumé */}
      <div className={styles.summary}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryValue}>
            {stats.answeredCount}/{stats.totalQuestions}
          </div>
          <div className={styles.summaryLabel}>Réponses</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryValue}>{stats.totalSites}</div>
          <div className={styles.summaryLabel}>Sites visités</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryValue}>{stats.motsCles.length}</div>
          <div className={styles.summaryLabel}>Mots-clés</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryValue}>{stats.totalPassages}</div>
          <div className={styles.summaryLabel}>Passages surlignés</div>
        </div>
      </div>

      {/* Progression par question */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Progression par question</div>
        <div className={styles.progressList}>
          {stats.progression.map(p => (
            <div key={p.index} className={styles.progressItem}>
              <span className={`${styles.progressNum} ${
                p.hasReponse ? styles.progressComplete : styles.progressIncomplete
              }`}>
                {p.index + 1}
              </span>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${p.completionPct}%` }}
                />
              </div>
              <span className={styles.progressLabel}>
                {p.sourcesCollectees}/{p.sourcesRequises} sources
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Mots-clés */}
      {stats.motsCles.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Mots-clés recherchés</div>
          <div className={styles.tagCloud}>
            {stats.motsCles.map(([mot, count]) => (
              <span key={mot} className={styles.tag}>
                {mot}
                {count > 1 && <span className={styles.tagCount}>×{count}</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Domaines visités */}
      {stats.domains.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Sites les plus visités</div>
          <div className={styles.domainList}>
            {stats.domains.map(([domain, data]) => (
              <div key={domain} className={styles.domainItem}>
                <span className={styles.domainName}>{domain}</span>
                <div className={styles.domainMeta}>
                  <span>
                    <span className={styles.domainMetaValue}>{data.count}</span> visite{data.count > 1 ? 's' : ''}
                  </span>
                  {data.temps > 0 && (
                    <span>{formatTemps(data.temps)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Temps total */}
      {stats.totalTemps > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Temps de recherche total</div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryValue}>{formatTemps(stats.totalTemps)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
