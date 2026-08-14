'use client';

// Vue des réponses d'une activité de recherche (NavigKid).
//
// Chaque question forme une carte à deux blocs — la DÉMARCHE (mots-clés, sites,
// passages) puis la RÉPONSE — et chaque bloc porte sa correction dans une
// GOUTTIÈRE à sa droite, en face de ce qu'elle note : rien ne s'empile sous la
// production de l'élève. Sous 1150 px la gouttière repasse dessous, en ligne.
//
// Vue prof : la gouttière est active (✔ / ? / ✘, points, remarque).
// Vue élève : elle n'apparaît qu'une fois la correction rendue visible, en
// lecture seule.

import type {
  NavigKidQuestion,
  NavigKidReponse,
  RechercheQuestionScore,
} from '@/types/navigkid';
import { formatPoints, scoreRecherche } from '@/lib/recherche-scoring';
import type { RechercheQuestionResult } from '@/lib/recherche-scoring';
import styles from './RechercheResponseViewer.module.css';

interface RechercheResponseViewerProps {
  questions: NavigKidQuestion[];
  reponse: NavigKidReponse | null;
  studentView?: boolean;
  scores?: Record<string, RechercheQuestionScore>;
  // Prof : appelé à chaque geste de correction. Absent = lecture seule.
  onScoreChange?: (questionIndex: number, patch: Partial<RechercheQuestionScore>) => void;
  // Élève : la correction lui est-elle rendue visible ?
  showScores?: boolean;
}

function bonnesReponses(question: NavigKidQuestion): string[] {
  if (!Array.isArray(question.correctes) || !Array.isArray(question.options)) return [];
  return question.correctes.map((i) => question.options![i]).filter(Boolean);
}

function formatTemps(ms: number): string {
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const resteSec = sec % 60;
  return `${min}m${resteSec > 0 ? `${resteSec}s` : ''}`;
}

// ─── Gouttière : les trois verdicts + les points + la remarque ───
interface GutterProps {
  label: string;
  points: number | null;
  max: number;
  comment: string;
  editable: boolean;
  readOnlyVisible: boolean;
  note?: string;
  onPoints: (points: number | null) => void;
  onComment: (text: string) => void;
}

function Gutter({
  label,
  points,
  max,
  comment,
  editable,
  readOnlyVisible,
  note,
  onPoints,
  onComment,
}: GutterProps) {
  // Barème à 0 : le prof n'a pas prévu de points pour ce volet
  if (max <= 0) return null;
  if (!editable && !readOnlyVisible) return null;

  // Lecture seule (élève) : la note et la remarque, rien à manipuler
  if (!editable) {
    if (points === null && !comment) return null;
    return (
      <div className={styles.gutter}>
        <span className={styles.gutterLabel}>{label}</span>
        {points !== null && (
          <div className={styles.gutterScore}>
            {formatPoints(points)} <span className={styles.gutterScoreMax}>/ {max}</span>
          </div>
        )}
        {comment && <p className={styles.gutterComment}>{comment}</p>}
      </div>
    );
  }

  const verdicts: { valeur: number; icone: string; classe: string; titre: string }[] = [
    { valeur: 1, icone: '✔', classe: styles.vOk, titre: 'Tous les points' },
    { valeur: 0.5, icone: '?', classe: styles.vHalf, titre: 'La moitié des points' },
    { valeur: 0, icone: '✘', classe: styles.vNo, titre: 'Aucun point' },
  ];
  const actif = (v: number) => points !== null && Math.abs(points - v * max) < 0.001;

  return (
    <div className={styles.gutter}>
      <span className={styles.gutterLabel}>{label}</span>
      <div className={styles.verdicts}>
        {verdicts.map((v) => (
          <button
            key={v.valeur}
            type="button"
            title={v.titre}
            className={`${styles.vBtn} ${v.classe} ${actif(v.valeur) ? styles.vBtnOn : ''}`}
            onClick={() => onPoints(Math.round(v.valeur * max * 10) / 10)}
          >
            {v.icone}
          </button>
        ))}
      </div>
      <div className={styles.ptsRow}>
        <input
          type="number"
          min={0}
          max={max}
          step={0.5}
          className={styles.ptsInput}
          value={points === null ? '' : points}
          placeholder="—"
          onChange={(e) => {
            const brut = e.target.value;
            if (brut === '') return onPoints(null);
            const n = parseFloat(brut);
            if (!Number.isNaN(n)) onPoints(Math.max(0, Math.min(max, n)));
          }}
        />
        <span className={styles.ptsMax}>/ {max} pts</span>
      </div>
      <textarea
        className={styles.gutterTextarea}
        value={comment}
        placeholder="Remarque…"
        onChange={(e) => onComment(e.target.value)}
      />
      {note && <span className={styles.gutterNote}>{note}</span>}
    </div>
  );
}

export default function RechercheResponseViewer({
  questions,
  reponse,
  studentView = false,
  scores,
  onScoreChange,
  showScores = false,
}: RechercheResponseViewerProps) {
  const hasReponse = reponse && reponse.questions && reponse.questions.length > 0;
  const editable = !studentView && typeof onScoreChange === 'function';
  const score = scoreRecherche(questions, reponse, scores);

  if (questions.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>Aucune question dans ce questionnaire.</div>
      </div>
    );
  }

  if (!hasReponse && !studentView) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>Aucune réponse soumise par l&apos;élève.</div>
      </div>
    );
  }

  const patch = (index: number, p: Partial<RechercheQuestionScore>) => onScoreChange?.(index, p);

  return (
    <div className={styles.container}>
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
        const qData = reponse?.questions?.find((q) => q.questionIndex === index);
        const r: RechercheQuestionResult = score.parQuestion[index];
        const saisi = scores?.[String(index)];
        const totalMax = r.reponseMax + r.demarcheMax;
        const totalObtenu = (r.reponsePoints ?? 0) + (r.demarchePoints ?? 0);
        const noteVisible = editable || showScores;

        return (
          <div key={index} className={styles.questionCard}>
            <div className={styles.questionHeader}>
              <span className={styles.questionNumber}>{index + 1}</span>
              <span className={styles.questionTexte}>{question.texte}</span>
              <span
                className={`${styles.questionType} ${
                  question.type === 'qcm' ? styles.typeQcm : styles.typeTexte
                }`}
              >
                {question.type === 'qcm' ? 'QCM' : 'Ouverte'}
              </span>
              {noteVisible && totalMax > 0 && (
                <span className={styles.questionScore}>
                  {formatPoints(totalObtenu)} / {totalMax}
                </span>
              )}
            </div>

            {/* ─── Bloc 1 : la démarche ─── */}
            <div className={styles.block}>
              <div className={styles.prod}>
                <div className={styles.sectionLabel}>
                  🔎 Démarche de recherche
                  <span className={styles.sectionCount}>
                    {qData?.motsCles?.length ?? 0} mot{(qData?.motsCles?.length ?? 0) > 1 ? 's' : ''}-clé
                    {(qData?.motsCles?.length ?? 0) > 1 ? 's' : ''} · {qData?.sitesConsultes?.length ?? 0}/
                    {question.nbSources} site{question.nbSources > 1 ? 's' : ''}
                  </span>
                </div>

                {qData?.motsCles && qData.motsCles.length > 0 ? (
                  <div className={styles.tagsList}>
                    {qData.motsCles.map((mc, i) => (
                      <span key={i} className={styles.motCleTag}>
                        {mc.texte}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className={styles.sectionEmpty}>
                    {studentView ? 'Tes recherches Google apparaîtront ici.' : 'Aucun mot-clé'}
                  </div>
                )}

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
                          <span
                            className={`${styles.sourceTag} ${
                              site.pertinence ? styles.tagPertinent : styles.tagNonPertinent
                            }`}
                          >
                            {site.pertinence ? 'Pertinent' : 'Non pertinent'}
                          </span>
                          <span className={styles.fiabilite}>
                            Fiabilité :{' '}
                            <strong>{site.fiabilite > 0 ? `${site.fiabilite}/5` : 'non évaluée'}</strong>
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
                    {studentView ? "Clique sur un résultat Google pour l'ajouter ici." : 'Aucun site'}
                  </div>
                )}

                {qData?.passages && qData.passages.length > 0 && (
                  <div className={styles.passagesList}>
                    {qData.passages.map((p, i) => (
                      <div key={i} className={styles.passageItem}>
                        <div className={styles.passageCouleur} style={{ backgroundColor: p.couleur }} />
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
                )}
              </div>

              <Gutter
                label="Démarche"
                points={r.demarchePoints}
                max={r.demarcheMax}
                comment={saisi?.demarcheComment ?? ''}
                editable={editable}
                readOnlyVisible={showScores}
                onPoints={(p) => patch(index, { demarche: p })}
                onComment={(t) => patch(index, { demarcheComment: t })}
              />
            </div>

            {/* ─── Bloc 2 : la réponse ─── */}
            <div className={styles.block}>
              <div className={styles.prod}>
                <div className={styles.sectionLabel}>✍️ Réponse</div>
                {qData?.reponse ? (
                  <>
                    <div
                      className={`${styles.reponseText} ${
                        r.reponsePoints === null || r.reponseMax === 0
                          ? ''
                          : r.reponsePoints >= r.reponseMax
                            ? styles.reponseJuste
                            : r.reponsePoints > 0
                              ? styles.reponsePartielle
                              : styles.reponseFausse
                      }`}
                    >
                      {qData.reponse}
                    </div>

                    {question.type === 'qcm' && r.reponseAuto !== null && (
                      <div className={styles.autoRow}>
                        {r.reponseOverride ? (
                          <span className={styles.autoOverride}>
                            ↩ Corrigé par le professeur — l&apos;ordinateur avait mis{' '}
                            {r.reponseAuto > 0 ? 'juste' : 'faux'}
                          </span>
                        ) : (
                          <span
                            className={r.reponseAuto > 0 ? styles.autoJuste : styles.autoFausse}
                          >
                            {r.reponseAuto > 0
                              ? '✅ Correction automatique : juste'
                              : '❌ Correction automatique : fausse'}
                          </span>
                        )}
                        {editable && !r.reponseOverride && r.reponseAuto === 0 && (
                          <button
                            type="button"
                            className={styles.contesterBtn}
                            onClick={() => patch(index, { reponse: r.reponseMax })}
                          >
                            Je ne suis pas d&apos;accord → tous les points
                          </button>
                        )}
                      </div>
                    )}

                    {question.type === 'qcm' &&
                      r.reponseAuto === 0 &&
                      bonnesReponses(question).length > 0 && (
                        <div className={styles.bonneReponse}>
                          Bonne réponse : {bonnesReponses(question).join(' · ')}
                        </div>
                      )}

                    {question.type === 'qcm' && r.reponseAuto === null && !studentView && (
                      <div className={styles.autoRow}>
                        <span className={styles.autoNeutre}>
                          Aucune bonne réponse n&apos;a été désignée dans le questionnaire — à noter à la main.
                        </span>
                      </div>
                    )}

                    {question.type === 'texte' && (
                      <div className={styles.autoRow}>
                        <span className={styles.autoNeutre}>
                          {studentView
                            ? "Cette réponse est lue et corrigée par ton professeur : elle n'est pas corrigée automatiquement."
                            : 'Question ouverte — pas de correction automatique.'}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className={`${styles.reponseText} ${styles.reponseEmpty}`}>
                    {studentView ? 'Ta réponse apparaîtra ici après soumission.' : 'Pas de réponse'}
                  </div>
                )}
              </div>

              <Gutter
                label="Réponse"
                points={r.reponsePoints}
                max={r.reponseMax}
                comment={saisi?.reponseComment ?? ''}
                editable={editable}
                readOnlyVisible={showScores}
                note={
                  question.type === 'qcm' && r.reponseAuto !== null && !r.reponseOverride
                    ? "Verdict de l'ordinateur, tant que vous ne le modifiez pas."
                    : undefined
                }
                onPoints={(p) => patch(index, { reponse: p })}
                onComment={(t) => patch(index, { reponseComment: t })}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
