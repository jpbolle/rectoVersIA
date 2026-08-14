'use client';

// Onglet Évaluation d'une auto-évaluation — la LUCIDITÉ de l'élève.
//
// Il n'y a pas de note à afficher : ce que cet onglet montre, c'est l'écart
// entre le regard de l'élève et celui du prof, question ordonnée par question
// ordonnée. Les émotions et les réponses libres n'y figurent pas — elles ne se
// comparent pas (cf. lib/autoeval-scoring.ts).
//
// Partagé prof / élève. Côté élève, rien ne s'affiche tant que la correction
// ne lui est pas rendue : il verrait le regard du prof avant l'heure.

import { useMemo } from 'react';
import { parseAutoEvalAnswers } from '@/types/autoevaluation';
import type { AutoEvalAnswer, AutoEvalQuestionnaire } from '@/types/autoevaluation';
import { LUCIDITE_LABELS, comparer, phraseTendance } from '@/lib/autoeval-scoring';
import styles from './AutoEvalEvaluation.module.css';

interface Props {
  quiz: AutoEvalQuestionnaire;
  travailContent: string | undefined | null;
  profAnswers: Record<string, AutoEvalAnswer> | undefined;
  // Le regard du prof est-il visible ? (prof toujours, élève une fois rendu)
  showComparaison: boolean;
}

export default function AutoEvalEvaluation({
  quiz,
  travailContent,
  profAnswers,
  showComparaison,
}: Props) {
  const eleve = useMemo(
    () => parseAutoEvalAnswers(travailContent)?.answers ?? {},
    [travailContent]
  );
  const bilan = useMemo(
    () => comparer(quiz, eleve, showComparaison ? profAnswers : undefined),
    [quiz, eleve, profAnswers, showComparaison]
  );

  if (!showComparaison) {
    return (
      <div className={styles.attente}>
        <p className={styles.attenteTitre}>Ton auto-évaluation est enregistrée.</p>
        <p className={styles.attenteTexte}>
          Ton professeur répondra aux mêmes questions de son côté. Tu verras alors son regard à
          côté du tien — et ce que l’écart dit de la façon dont tu te vois.
        </p>
      </div>
    );
  }

  if (bilan.comparees === 0) {
    return (
      <div className={styles.attente}>
        <p className={styles.attenteTitre}>Comparaison en attente</p>
        <p className={styles.attenteTexte}>
          {bilan.enAttenteProf > 0
            ? `${bilan.enAttenteProf} question${bilan.enAttenteProf > 1 ? 's' : ''} attend${
                bilan.enAttenteProf > 1 ? 'ent' : ''
              } encore votre regard dans la colonne de gauche.`
            : 'Ce questionnaire ne contient aucune question comparable : les émotions et les réponses libres se lisent, elles ne se confrontent pas.'}
        </p>
      </div>
    );
  }

  const pct = (n: number) => Math.round((n / bilan.comparees) * 100);

  return (
    <div className={styles.panel}>
      {/* ── Tendance générale ── */}
      {bilan.tendance && (
        <div className={`${styles.tendance} ${styles[bilan.tendance]}`}>
          <span className={styles.tendanceTitre}>
            {bilan.tendance === 'juste' && '✓ '}
            {bilan.tendance === 'sousEstime' && '↓ '}
            {bilan.tendance === 'surestime' && '↑ '}
            {LUCIDITE_LABELS[bilan.tendance]}
          </span>
          <p className={styles.tendanceTexte}>{phraseTendance(bilan)}</p>
        </div>
      )}

      {/* ── Répartition ── */}
      <div className={styles.repartition}>
        {(
          [
            ['juste', bilan.justes, 'd’accord avec le professeur'],
            ['sousEstime', bilan.sousEstimations, 'sous-estimations'],
            ['surestime', bilan.surestimations, 'surestimations'],
          ] as const
        ).map(([cle, n, libelle]) => (
          <div key={cle} className={styles.stat}>
            <span className={`${styles.statVal} ${styles[cle]}`}>{n}</span>
            <span className={styles.statLbl}>{libelle}</span>
            <div className={styles.statBarre}>
              <div className={`${styles.statFill} ${styles[cle]}`} style={{ width: `${pct(n)}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* ── Détail question par question ── */}
      <div className={styles.detail}>
        <h4 className={styles.detailTitre}>Question par question</h4>
        {bilan.ecarts.map((e) => (
          <div key={e.questionId} className={styles.ligne}>
            <p className={styles.ligneEnonce}>{e.enonce}</p>
            <div className={styles.axe}>
              {[1, 2, 3, 4, 5].map((n) => {
                const estEleve = e.eleve === n;
                const estProf = e.prof === n;
                return (
                  <span
                    key={n}
                    className={`${styles.cran} ${estEleve ? styles.cranEleve : ''} ${
                      estProf ? styles.cranProf : ''
                    }`}
                    title={
                      estEleve && estProf
                        ? 'Vous êtes d’accord'
                        : estEleve
                          ? 'Position de l’élève'
                          : estProf
                            ? 'Votre position'
                            : undefined
                    }
                  >
                    {estEleve && estProf ? '◆' : estEleve ? '●' : estProf ? '○' : ''}
                  </span>
                );
              })}
            </div>
            <span className={`${styles.badge} ${styles[e.lucidite]}`}>
              {LUCIDITE_LABELS[e.lucidite]}
              {e.net && <em className={styles.net}> — nette</em>}
            </span>
          </div>
        ))}
        <p className={styles.legende}>
          <span className={styles.cranEleveLeg}>●</span> l’élève ·{' '}
          <span className={styles.cranProfLeg}>○</span> le professeur ·{' '}
          <span className={styles.cranEleveLeg}>◆</span> les deux au même endroit
        </p>
      </div>

      {bilan.enAttenteProf > 0 && (
        <p className={styles.reste}>
          {bilan.enAttenteProf} question{bilan.enAttenteProf > 1 ? 's' : ''} sans regard du
          professeur — elle{bilan.enAttenteProf > 1 ? 's ne sont' : ' n’est'} pas comptée
          {bilan.enAttenteProf > 1 ? 's' : ''} ici.
        </p>
      )}
    </div>
  );
}
