'use client';

// ═══ MATRICE ═══
//
// Plusieurs items qui partagent les MÊMES réponses : « Jamais / Parfois /
// Souvent » convient à huit affirmations d'affilée, et les répéter huit fois
// en huit QCM séparés est illisible pour l'élève comme pour le prof.
//
// Un seul composant pour les DEUX dispositifs :
//   · questionnaire de lecture   → il y a une colonne attendue, barème partiel
//   · questionnaire d'auto-évaluation → aucune colonne n'est « juste »
// D'où des props volontairement neutres (des chaînes, des index) plutôt que
// `LectureQuestion` : ce composant ne doit rien savoir du dispositif qui
// l'emploie, sinon il faudra le dupliquer au premier écart.

import styles from './QuestionInteractions.module.css';

interface Props {
  items: string[];
  colonnes: string[];
  /** index de ligne -> index de colonne */
  valeurs: Record<number, number>;
  onChange: (valeurs: Record<number, number>) => void;
  disabled?: boolean;
  /**
   * Colonne attendue par ligne (-1 = ligne hors barème).
   * Absent en auto-évaluation, et absent tant que le corrigé n'est pas rendu.
   */
  attendu?: number[] | null;
  /** Préfixe des groupes de boutons radio — doit être unique dans la page. */
  nomGroupe: string;
}

export default function MatriceField({
  items,
  colonnes,
  valeurs,
  onChange,
  disabled,
  attendu,
  nomGroupe,
}: Props) {
  const choisir = (ligne: number, colonne: number) => {
    if (disabled) return;
    onChange({ ...valeurs, [ligne]: colonne });
  };

  return (
    <div className={styles.matriceScroll}>
      <table className={styles.matrix}>
        <thead>
          <tr>
            <th />
            {colonnes.map((c, i) => (
              <th key={i} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, ligne) => {
            const attenduLigne = attendu?.[ligne];
            const notee = typeof attenduLigne === 'number' && attenduLigne >= 0;
            const faux = notee && valeurs[ligne] !== attenduLigne;
            return (
              <tr key={ligne} className={faux ? styles.ligneKo : ''}>
                <th scope="row">{item}</th>
                {colonnes.map((_, colonne) => (
                  <td
                    key={colonne}
                    // La colonne attendue se teinte en vert quand la
                    // correction est rendue — l'élève voit d'un coup d'œil
                    // les lignes qu'il a manquées, sans relire un bandeau.
                    className={notee && attenduLigne === colonne ? styles.attenduCell : ''}
                  >
                    <input
                      type="radio"
                      name={`${nomGroupe}-${ligne}`}
                      checked={valeurs[ligne] === colonne}
                      onChange={() => choisir(ligne, colonne)}
                      disabled={disabled}
                      aria-label={`${item} : ${colonnes[colonne]}`}
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
