'use client';

// CE QUE LA CLASSE A RÉPONDU — affiché entre la fin du chrono et la révélation.
//
// Le chrono qui s'arrête ne dit pas la réponse : il ouvre la discussion. On
// montre d'abord ce que la classe a répondu, le prof commente, puis il révèle
// (demande de JP, 2026-09-07).
//
// ⚠ DEUX RÈGLES, et elles viennent toutes deux d'une correction de JP :
//  1. On PRÉSERVE LA FORME DE LA QUESTION. Le nombre se pose en PASTILLE dans
//     l'encadré, sur le lien, dans la boîte. Pas de graphique générique — la
//     première version dessinait les mêmes barres pour tout le monde et faisait
//     perdre la question de vue.
//  2. AUCUNE couleur de jugement : ni vert ni rouge. C'est la minute où la
//     classe se demande encore qui a raison.
//
// Le QCM ne passe pas par ici : il garde ses grandes cases (`CompetitionQcm`),
// qui reçoivent directement leurs pastilles.

import AppariementField from '@/components/QuestionInteractions/AppariementField';
import type { LectureQuestion } from '@/types/lecture';
import type { MancheRepartition } from '@/types/manche';
import styles from './Repartition.module.css';

interface Props {
  question: LectureQuestion;
  data: MancheRepartition | null | undefined;
}

export default function Repartition({ question, data }: Props) {
  if (!data) {
    // Soit personne n'a répondu, soit ce type ne se résume pas (l'image à
    // annoter — décision de JP : « rien du tout » plutôt qu'un dessin faux).
    return <p className={styles.vide}>Rien à afficher pour cette question.</p>;
  }

  const titre = (
    <p className={styles.titre}>
      Ce que la classe a répondu — {data.total} réponse{data.total > 1 ? 's' : ''}
    </p>
  );

  // ── Réponse courte : nuage de mots ──
  if (data.forme === 'mots') {
    const max = Math.max(1, ...data.mots.map((m) => m.n));
    return (
      <div className={styles.bloc}>
        {titre}
        <div className={styles.nuage}>
          {data.mots.map((m) => {
            const part = m.n / max;
            return (
              <span
                key={m.mot}
                className={`${styles.mot} ${part > 0.5 ? styles.motFort : ''}`}
                // La taille dit la fréquence, et c'est tout ce qu'un nuage a à
                // dire. Deux graisses suffisent à marquer les dominants ; une
                // échelle plus fine donnerait une précision que ces effectifs
                // n'ont pas.
                style={{ fontSize: `${14 + Math.round(part * 22)}px` }}
                title={`${m.n} élève${m.n > 1 ? 's' : ''}`}
              >
                {m.mot}
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Appariement : les liens de la classe, pastille au milieu ──
  if (data.forme === 'paires') {
    return (
      <div className={styles.bloc}>
        {titre}
        {/* On réutilise le champ du JEU, en lecture seule : c'est la même
            grille, les mêmes pastilles, les mêmes traits. Un second rendu
            divergerait au premier ajustement. */}
        <AppariementField
          question={question}
          answer={{}}
          onChange={() => {}}
          disabled
          graine={null}
          repartition={data.paires}
        />
      </div>
    );
  }

  // ── Remise en ordre : dans chaque place, l'étiquette majoritaire ──
  if (data.forme === 'ordre') {
    const items = question.ordreItems ?? [];
    const texte = (id: string | null) =>
      items.find((j) => j.id === id)?.texte ?? (id ? '(média)' : null);
    return (
      <div className={styles.bloc}>
        {titre}
        <ul className={styles.places}>
          {data.places.map((p) => {
            const libelle = texte(p.jetonId);
            return (
              <li key={p.rang} className={styles.place}>
                <span className={styles.rang}>{p.rang + 1}</span>
                {libelle ? (
                  <>
                    <span className={styles.etiquette}>{libelle}</span>
                    <span className={styles.pastille}>{p.n}</span>
                  </>
                ) : (
                  <span className={styles.personne}>personne</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  // ── Ensembles : chaque jeton dans CHAQUE boîte où on l'a mis ──
  if (data.forme === 'ensembles') {
    const boites = question.ensembles ?? [];
    const jetons = question.ensembleItems ?? [];
    const texte = (id: string) => jetons.find((j) => j.id === id)?.texte ?? '(média)';
    return (
      <div className={styles.bloc}>
        {titre}
        <div className={styles.boites}>
          {boites.map((b) => {
            // Un jeton hésitant apparaît dans DEUX boîtes à la fois — c'est
            // exactement ce qu'on veut voir (décision de JP).
            const dedans = data.cases
              .filter((c) => c.ensembleId === b.id)
              .sort((x, y) => y.n - x.n);
            return (
              <div key={b.id} className={styles.boite}>
                <h4 className={styles.boiteTitre}>{b.titre}</h4>
                {dedans.length === 0 ? (
                  <p className={styles.vide}>Personne.</p>
                ) : (
                  <ul className={styles.jetons}>
                    {dedans.map((c) => (
                      <li key={c.jetonId} className={styles.jeton}>
                        <span className={styles.jetonTexte}>{texte(c.jetonId)}</span>
                        <span className={styles.pastille}>{c.n}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return <p className={styles.vide}>Rien à afficher pour cette question.</p>;
}
