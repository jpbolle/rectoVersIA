'use client';

// ═══ Le PODIUM — projeté au tableau, à la révélation ou en fin de partie ═══
//
// Il ne montre que la TÊTE du classement : 1, 3, 5 ou 10 lignes, au choix du
// professeur (règle du plan : le bas du classement ne s'affiche jamais devant
// la classe — ce sont des mineurs, devant leurs camarades). Le classement
// complet vit dans l'onglet Statistiques, que seul le prof lit.
//
// Il sert aux ÉLÈVES comme aux ÉQUIPES : une ligne, c'est un nom, des points,
// et éventuellement une série (élève) ou des membres (équipe). L'appelant
// prépare les lignes ; le podium ne sait pas ce qu'il classe.
//
// Lisible depuis le fond de la classe : gros chiffres, une ligne par entrée,
// rien d'autre. Les trois premiers portent une médaille ; c'est le seul
// ornement.

import styles from './Podium.module.css';

const MEDAILLES = ['🥇', '🥈', '🥉'];

export interface PodiumLigne {
  id: string;
  rang: number;
  nom: string;
  total: number;
  /** Élève : bonnes réponses consécutives */
  serie?: number;
  /** Équipe : ses membres, en petit sous le nom */
  sous?: string;
  /** Équipe : sa teinte, en pastille devant le nom */
  teinte?: string;
}

interface PodiumProps {
  lignes: PodiumLigne[];
  /** Nombre de lignes projetées */
  taille: number;
  titre?: string;
}

export default function Podium({ lignes, taille, titre }: PodiumProps) {
  // Une entrée à zéro n'a pas sa place sur un podium — sauf si personne n'a
  // marqué, auquel cas on montre quand même la tête, sinon l'écran est vide.
  const marques = lignes.filter((l) => l.total > 0);
  const visibles = (marques.length > 0 ? marques : lignes).slice(0, taille);

  return (
    <div className={styles.podium}>
      <h3 className={styles.titre}>{titre ?? 'Podium'}</h3>
      {visibles.length === 0 ? (
        <p className={styles.vide}>Personne n’a encore marqué.</p>
      ) : (
        <ol className={styles.liste}>
          {visibles.map((l, i) => (
            <li
              key={l.id}
              className={`${styles.ligne} ${i < 3 ? styles[`place${i + 1}`] : ''}`}
            >
              <span className={styles.rang} aria-label={`${l.rang}e`}>
                {i < 3 ? MEDAILLES[i] : l.rang}
              </span>
              <span className={styles.identite}>
                <span className={styles.nom}>
                  {l.teinte && <i className={styles.teinte} style={{ background: l.teinte }} />}
                  {l.nom}
                </span>
                {l.sous && <span className={styles.sous}>{l.sous}</span>}
              </span>
              {(l.serie ?? 0) >= 2 && (
                <span className={styles.serie} title="Bonnes réponses consécutives">
                  🔥 {l.serie}
                </span>
              )}
              <span className={styles.points}>{l.total.toLocaleString('fr-BE')}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
