'use client';

// Présentation partagée des bilans de LUCIDITÉ — « se voit-il juste ? ».
//
// L'application mesure cette même chose de trois façons, selon le dispositif :
//  - ÉCRITURE      : l'élève s'auto-évalue sur la grille, le prof note la même
//                    grille — l'écart se lit en crans (voir grille-lucidite.ts) ;
//  - LECTURE et RECHERCHE : l'élève annonce un degré d'assurance avant de
//                    connaître sa note (voir confiance-scoring.ts) ;
//  - AUTO-ÉVALUATION : l'élève et le prof répondent aux mêmes questions
//                    (voir autoeval-scoring.ts).
//
// Le calcul diffère à chaque fois, l'affichage non : ce composant ne porte que
// la présentation, chaque appelant lui fournit ses libellés. C'est la règle
// « unifier le mécanisme, jamais les singularités ».

import type { Lucidite } from '@/lib/autoeval-scoring';
import styles from './LuciditeBilan.module.css';

const TENDANCE_LABEL: Record<Lucidite, string> = {
  juste: 'Tu te vois juste',
  sousEstime: 'Tu te sous-estimes',
  surestime: 'Tu te surestimes',
};

const TENDANCE_LABEL_PROF: Record<Lucidite, string> = {
  juste: 'Se voit juste',
  sousEstime: 'Se sous-estime',
  surestime: 'Se surestime',
};

const TENDANCE_EMOJI: Record<Lucidite, string> = {
  juste: '🎯',
  sousEstime: '🌱',
  surestime: '⚠️',
};

export interface LigneLucidite {
  id: string;
  label: string;      // ce sur quoi portait le décalage (question, critère)
  gauche: string;     // ce que l'élève annonçait
  droite: string;     // ce qu'il a obtenu
}

interface Props {
  titre: string;
  tendance: Lucidite | null;
  comparees: number;
  justes: number;
  sousEstimations: number;
  surestimations: number;
  /** Unité comparée : « question », « critère »… */
  unite: string;
  /** Phrase adressée à l'élève, sous le titre */
  phrase?: string;
  /** Décalages nets seulement — un cran d'écart est une nuance, pas une leçon */
  lignes?: LigneLucidite[];
  /** Mention de bas de bloc (ce qui est resté hors comparaison) */
  note?: string;
  isProfessorView?: boolean;
}

export default function LuciditeBilan({
  titre,
  tendance,
  comparees,
  justes,
  sousEstimations,
  surestimations,
  unite,
  phrase,
  lignes,
  note,
  isProfessorView,
}: Props) {
  // Rien de comparable : le bloc n'a rien à dire, il ne s'affiche pas
  if (comparees === 0) return null;

  const t = tendance ?? 'juste';

  return (
    <section className={`${styles.wrap} ${styles[t]}`}>
      <div className={styles.head}>
        <span className={styles.emoji}>{TENDANCE_EMOJI[t]}</span>
        <span className={styles.titre}>
          {isProfessorView ? TENDANCE_LABEL_PROF[t] : TENDANCE_LABEL[t]}
        </span>
        <span className={styles.compte}>
          {comparees} {unite}
          {comparees > 1 ? 's' : ''} comparé{comparees > 1 ? 's' : ''}
        </span>
      </div>

      <p className={styles.sousTitre}>{titre}</p>

      {!isProfessorView && phrase && <p className={styles.phrase}>{phrase}</p>}

      <div className={styles.compteurs}>
        <span className={`${styles.compteur} ${styles.cJuste}`}>{justes} vu juste</span>
        <span className={`${styles.compteur} ${styles.cSous}`}>
          {sousEstimations} sous-estimé{sousEstimations > 1 ? 's' : ''}
        </span>
        <span className={`${styles.compteur} ${styles.cSur}`}>
          {surestimations} surestimé{surestimations > 1 ? 's' : ''}
        </span>
      </div>

      {lignes && lignes.length > 0 && (
        <ul className={styles.detail}>
          {lignes.map((l) => (
            <li key={l.id} className={styles.ligne}>
              <span className={styles.ligneLabel}>{l.label}</span>
              <span className={styles.ligneEcart}>
                <em>{l.gauche}</em> → <strong>{l.droite}</strong>
              </span>
            </li>
          ))}
        </ul>
      )}

      {note && <p className={styles.note}>{note}</p>}
    </section>
  );
}
