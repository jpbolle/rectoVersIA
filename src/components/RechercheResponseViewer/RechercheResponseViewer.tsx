'use client';

import type { NavigKidQuestion, NavigKidReponse } from '@/types/navigkid';
import styles from './RechercheResponseViewer.module.css';

interface RechercheResponseViewerProps {
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

export default function RechercheResponseViewer({
  questions,
  reponse,
}: RechercheResponseViewerProps) {
  if (!reponse || !reponse.questions) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          Aucune réponse soumise par l&apos;élève.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {questions.map((question, index) => {
        const qData = reponse.questions?.find(q => q.questionIndex === index);

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

            {/* Réponse de l'élève */}
            <div className={styles.reponseSection}>
              <div className={styles.sectionLabel}>Réponse</div>
              {qData?.reponse ? (
                question.type === 'qcm' ? (
                  <div className={styles.qcmReponse}>{qData.reponse}</div>
                ) : (
                  <div className={styles.reponseText}>{qData.reponse}</div>
                )
              ) : (
                <div className={`${styles.reponseText} ${styles.reponseEmpty}`}>
                  Pas de réponse
                </div>
              )}
            </div>

            {/* Mots-clés recherchés */}
            {qData?.motsCles && qData.motsCles.length > 0 && (
              <div className={styles.motsClesSection}>
                <div className={styles.sectionLabel}>
                  Mots-clés recherchés ({qData.motsCles.length})
                </div>
                <div className={styles.tagsList}>
                  {qData.motsCles.map((mc, i) => (
                    <span key={i} className={styles.motCleTag}>{mc.texte}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Sources collectées */}
            {qData?.sitesConsultes && qData.sitesConsultes.length > 0 && (
              <div className={styles.sourcesSection}>
                <div className={styles.sectionLabel}>
                  Sources collectées ({qData.sitesConsultes.length}/{question.nbSources} requises)
                </div>
                <div className={styles.sourcesList}>
                  {qData.sitesConsultes.map((site, i) => (
                    <div key={i} className={styles.sourceItem}>
                      <div className={styles.sourceHeader}>
                        <div>
                          <div className={styles.sourceTitre}>{site.titre}</div>
                          <div className={styles.sourceUrl}>
                            <a href={site.url} target="_blank" rel="noopener noreferrer">
                              {site.url}
                            </a>
                          </div>
                        </div>
                      </div>
                      <div className={styles.sourceMeta}>
                        <span className={`${styles.sourceTag} ${
                          site.pertinence ? styles.tagPertinent : styles.tagNonPertinent
                        }`}>
                          {site.pertinence ? 'Pertinent' : 'Non pertinent'}
                        </span>
                        {site.fiabilite > 0 && (
                          <span className={styles.fiabilite}>
                            Fiabilité : <span className={styles.fiabiliteValue}>{site.fiabilite}/5</span>
                          </span>
                        )}
                        {site.tempsPasse > 0 && (
                          <span className={styles.temps}>
                            Temps : {formatTemps(site.tempsPasse)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Passages surlignés */}
            {qData?.passages && qData.passages.length > 0 && (
              <div className={styles.passagesSection}>
                <div className={styles.sectionLabel}>
                  Passages surlignés ({qData.passages.length})
                </div>
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
                            try {
                              return new URL(p.url).hostname;
                            } catch {
                              return p.url;
                            }
                          })()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
