'use client';

// CE QUE LA CLASSE A RÉPONDU à une question de SONDAGE — projeté au tableau
// dès que la question est close, et montré à l'élève sur son écran.
//
// Deux règles, héritées de la compétition et reconduites (plan du 2026-09-08) :
//  1. On PRÉSERVE LA FORME DE LA QUESTION : les cases restent des cases, les
//     emojis restent des emojis, et le nombre s'y pose en PASTILLE. Pas de
//     graphique générique qui ferait perdre la question de vue.
//  2. AUCUN NOM, nulle part. Le sondage est anonyme : des comptes, des mots,
//     des textes mélangés — jamais qui a dit quoi.
//
// Et pas de couleur de jugement non plus : il n'y a rien à juger.

import { ECHELLE_COMPETENCE, ECHELLE_HUMEUR, LIKERT_MAX_DEFAUT, LIKERT_MIN_DEFAUT, LIKERT_NIVEAUX, estLikertMatrice } from '@/types/autoevaluation';
import type { AutoEvalQuestion } from '@/types/autoevaluation';
import type { SondageRepartition as Repartition } from '@/types/manche';
import styles from './SondageRepartition.module.css';

interface Props {
  question: AutoEvalQuestion;
  data: Repartition | null | undefined;
  /** Sans le titre « N réponses » — dans l'onglet Statistiques, il est déjà dit */
  sansTitre?: boolean;
}

export default function SondageRepartition({ question, data, sansTitre = false }: Props) {
  if (!data) {
    return <p className={styles.vide}>Personne n’a encore répondu.</p>;
  }

  const titre = sansTitre ? null : (
    <p className={styles.titre}>
      Ce que la classe a répondu — {data.total} réponse{data.total > 1 ? 's' : ''}
    </p>
  );

  // ── Choix multiple : les mêmes cases, une pastille dans chacune ──
  if (data.forme === 'choix') {
    const max = Math.max(1, ...data.parChoix);
    return (
      <div className={styles.bloc}>
        {titre}
        <ul className={styles.choix}>
          {(question.choices ?? []).map((opt, i) => {
            const n = data.parChoix[i] ?? 0;
            return (
              <li key={i} className={`${styles.case} ${n === max && n > 0 ? styles.caseForte : ''}`}>
                <span className={styles.caseLettre}>{String.fromCharCode(65 + i)}</span>
                <span className={styles.caseTexte}>{opt}</span>
                <span className={styles.pastille}>{n}</span>
                {/* La barre sous la case dit la part sans chiffre : lisible du fond */}
                <i className={styles.caseBarre} style={{ width: `${(n / max) * 100}%` }} />
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

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
                style={{ fontSize: `${16 + Math.round(part * 26)}px` }}
                title={`${m.n} réponse${m.n > 1 ? 's' : ''}`}
              >
                {m.mot}
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Réponse longue : les textes en cartes, anonymes ──
  if (data.forme === 'textes') {
    return (
      <div className={styles.bloc}>
        {titre}
        <ul className={styles.cartes}>
          {data.textes.map((t, i) => (
            <li key={i} className={styles.carte}>
              {t}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // ── Emojis : les cinq échelons, une pastille sous chacun ──
  if (data.forme === 'emojis') {
    const echelle = question.type === 'competence' ? ECHELLE_COMPETENCE : ECHELLE_HUMEUR;
    const max = Math.max(1, ...data.parEchelon);
    return (
      <div className={styles.bloc}>
        {titre}
        <div className={styles.echelons}>
          {echelle.map((e, i) => {
            const n = data.parEchelon[i] ?? 0;
            return (
              <div key={e.id} className={`${styles.echelon} ${n === max && n > 0 ? styles.echelonFort : ''}`}>
                <span className={styles.echelonEmoji}>{e.emoji}</span>
                <span className={styles.echelonTexte}>{e.label}</span>
                <span className={styles.pastille}>{n}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Échelle de 1 à 5 : cinq crans, une colonne par cran, la moyenne en repère ──
  if (data.forme === 'echelle') {
    const max = Math.max(1, ...data.parNiveau);
    return (
      <div className={styles.bloc}>
        {titre}
        <div className={styles.echelle}>
          <div className={styles.bornes}>
            <span>{question.likertMin || LIKERT_MIN_DEFAUT}</span>
            <span>{question.likertMax || LIKERT_MAX_DEFAUT}</span>
          </div>
          <div className={styles.crans}>
            {Array.from({ length: LIKERT_NIVEAUX }, (_, i) => {
              const n = data.parNiveau[i] ?? 0;
              return (
                <div key={i} className={styles.cran}>
                  <div className={styles.cranColonne}>
                    <i style={{ height: `${(n / max) * 100}%` }} />
                  </div>
                  <span className={styles.pastille}>{n}</span>
                  <span className={styles.cranNumero}>{i + 1}</span>
                </div>
              );
            })}
          </div>
          {data.moyenne !== null && (
            <p className={styles.moyenne}>
              Moyenne : <strong>{data.moyenne.toLocaleString('fr-BE')}</strong> / {LIKERT_NIVEAUX}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Matrice, échelle à items : le tableau, chaque cellule avec son compte ──
  if (data.forme === 'grille') {
    const items = question.matriceItems ?? [];
    const colonnes = estLikertMatrice(question)
      ? Array.from({ length: LIKERT_NIVEAUX }, (_, i) => String(i + 1))
      : question.choices ?? [];
    return (
      <div className={styles.bloc}>
        {titre}
        {estLikertMatrice(question) && (
          <div className={styles.bornes}>
            <span>1 — {question.likertMin || LIKERT_MIN_DEFAUT}</span>
            <span>{LIKERT_NIVEAUX} — {question.likertMax || LIKERT_MAX_DEFAUT}</span>
          </div>
        )}
        <div className={styles.grilleScroll}>
          <table className={styles.grille}>
            <thead>
              <tr>
                <th />
                {colonnes.map((c, j) => (
                  <th key={j}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, l) => {
                const ligne = data.lignes[l] ?? [];
                const totalLigne = Math.max(1, ...[ligne.reduce((s, n) => s + n, 0)]);
                return (
                  <tr key={l}>
                    <th>{item}</th>
                    {colonnes.map((_, j) => {
                      const n = ligne[j] ?? 0;
                      // La teinte dit la part de la ligne : plus c'est foncé,
                      // plus la classe s'y est rangée. Le chiffre reste.
                      const part = n / totalLigne;
                      return (
                        <td
                          key={j}
                          style={{ background: `rgba(45, 106, 90, ${0.06 + part * 0.5})` }}
                          className={part >= 0.5 ? styles.celluleForte : ''}
                        >
                          {n}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return <p className={styles.vide}>Rien à afficher pour cette question.</p>;
}
