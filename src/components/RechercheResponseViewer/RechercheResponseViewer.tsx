'use client';

import type { NavigKidQuestion, NavigKidReponse } from '@/types/navigkid';
import styles from './RechercheResponseViewer.module.css';

interface RechercheResponseViewerProps {
  questions: NavigKidQuestion[];
  reponse: NavigKidReponse | null;
  studentView?: boolean;
}

function formatTemps(ms: number): string {
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const resteSec = sec % 60;
  return `${min}m${resteSec > 0 ? `${resteSec}s` : ''}`;
}

export default function RechercheResponseViewer({
  questions,
  reponse,
  studentView = false,
}: RechercheResponseViewerProps) {
  const hasReponse = reponse && reponse.questions && reponse.questions.length > 0;

  if (questions.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>Aucune question dans ce questionnaire.</div>
      </div>
    );
  }

  // Vue prof sans réponse : message simple
  if (!hasReponse && !studentView) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>Aucune réponse soumise par l&apos;élève.</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Bannière NavigKid si pas encore de réponse (vue élève) */}
      {!hasReponse && studentView && (
        <div className={styles.navigkidBanner}>
          <span className={styles.navigkidBannerIcon}>🔍</span>
          <span>
            Utilise l&apos;extension <strong>NavigKid!</strong> dans Chrome pour répondre à ce questionnaire.
            Tes mots-clés, sites consultés, passages surlignés et réponses apparaîtront ici.
          </span>
        </div>
      )}

      {questions.map((question, index) => {
        const qData = reponse?.questions?.find(q => q.questionIndex === index);

        return (
          <div key={index} className={styles.questionCard}>
            {/* En-tête question */}
            <div className={styles.questionHeader}>
              <span className={styles.questionNumber}>{index + 1}</span>
              <span className={styles.questionTexte}>{question.texte}</span>
              <span className={`${styles.questionType} ${
                question.type === 'qcm' ? styles.typeQcm : styles.typeTexte
              }`}>
                {question.type === 'qcm' ? 'QCM' : 'Texte'}
              </span>
            </div>

            {/* 1. Mots-clés recherchés — toujours visible */}
            <div className={styles.motsClesSection}>
              <div className={styles.sectionLabel}>
                🔎 Mots-clés recherchés
                {qData?.motsCles && qData.motsCles.length > 0 && (
                  <span className={styles.sectionCount}>{qData.motsCles.length}</span>
                )}
              </div>
              {qData?.motsCles && qData.motsCles.length > 0 ? (
                <div className={styles.tagsList}>
                  {qData.motsCles.map((mc, i) => (
                    <span key={i} className={styles.motCleTag}>{mc.texte}</span>
                  ))}
                </div>
              ) : (
                <div className={styles.sectionEmpty}>Tes recherches Google apparaîtront ici.</div>
              )}
            </div>

            {/* 2. Sites consultés — toujours visible */}
            <div className={styles.sourcesSection}>
              <div className={styles.sectionLabel}>
                📌 Sites consultés
                <span className={styles.sectionCount}>
                  {qData?.sitesConsultes?.length ?? 0}/{question.nbSources} requis
                </span>
              </div>
              {qData?.sitesConsultes && qData.sitesConsultes.length > 0 ? (
                <div className={styles.sourcesList}>
                  {qData.sitesConsultes.map((site, i) => (
                    <div key={i} className={styles.sourceItem}>
                      <div className={styles.sourceTitre}>{site.titre}</div>
                      <div className={styles.sourceUrl}>
                        <a href={site.url} target="_blank" rel="noopener noreferrer">
                          {site.url}
                        </a>
                      </div>
                      <div className={styles.sourceMeta}>
                        <span className={`${styles.sourceTag} ${
                          site.pertinence ? styles.tagPertinent : styles.tagNonPertinent
                        }`}>
                          {site.pertinence ? 'Pertinent' : 'Non pertinent'}
                        </span>
                        <span className={styles.fiabilite}>
                          Fiabilité : <strong>{site.fiabilite > 0 ? `${site.fiabilite}/5` : 'non évaluée'}</strong>
                        </span>
                        {site.tempsPasse > 0 && (
                          <span className={styles.temps}>⏱ {formatTemps(site.tempsPasse)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.sectionEmpty}>
                  Clique sur un résultat Google pour l&apos;ajouter ici.
                </div>
              )}
            </div>

            {/* 3. Passages surlignés — toujours visible */}
            <div className={styles.passagesSection}>
              <div className={styles.sectionLabel}>
                ✏️ Passages surlignés
                {qData?.passages && qData.passages.length > 0 && (
                  <span className={styles.sectionCount}>{qData.passages.length}</span>
                )}
              </div>
              {qData?.passages && qData.passages.length > 0 ? (
                <div className={styles.passagesList}>
                  {qData.passages.map((p, i) => (
                    <div key={i} className={styles.passageItem}>
                      <div
                        className={styles.passageCouleur}
                        style={{ backgroundColor: p.couleur }}
                      />
                      <div className={styles.passageContent}>
                        <div className={styles.passageTexte}>« {p.texte} »</div>
                        <div className={styles.passageUrl}>
                          {(() => {
                            try { return new URL(p.url).hostname; }
                            catch { return p.url; }
                          })()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.sectionEmpty}>
                  Surligne du texte sur une page web pour le collecter ici.
                </div>
              )}
            </div>

            {/* 4. Réponse — en dernier comme dans l'extension */}
            <div className={styles.reponseSection}>
              <div className={styles.sectionLabel}>✍️ Ta réponse</div>
              {qData?.reponse ? (
                question.type === 'qcm' ? (
                  <div className={styles.qcmReponse}>{qData.reponse}</div>
                ) : (
                  <div className={styles.reponseText}>{qData.reponse}</div>
                )
              ) : (
                <div className={`${styles.reponseText} ${styles.reponseEmpty}`}>
                  {studentView ? 'Ta réponse apparaîtra ici après soumission.' : 'Pas de réponse'}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
