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

import { matriceColonnes } from '@/types/lecture';
import styles from './QuestionInteractions.module.css';

interface Props {
  items: string[];
  colonnes: string[];
  /** index de ligne -> la ou les colonnes cochées */
  valeurs: Record<number, number | number[]>;
  onChange: (valeurs: Record<number, number | number[]>) => void;
  disabled?: boolean;
  /**
   * Plusieurs colonnes cochables par ligne — comme le `multiple` du QCM.
   * Les boutons radio deviennent alors des cases à cocher : une radio ne sait
   * pas se décocher, ce qui rendrait une erreur irrattrapable.
   */
  multiple?: boolean;
  /**
   * Ce qui est attendu par ligne (-1 ou tableau vide = ligne hors barème).
   * Absent en auto-évaluation, et absent tant que le corrigé n'est pas rendu.
   */
  attendu?: (number | number[])[] | null;
  /** Préfixe des groupes de boutons radio — doit être unique dans la page. */
  nomGroupe: string;
  /**
   * L'ordre dans lequel les LIGNES s'affichent — des index d'origine
   * (`ordre[position] = ligne chez le prof`). Absent = l'ordre de saisie.
   *
   * Les colonnes, elles, ne se mélangent jamais : elles forment une échelle
   * partagée (Vrai/Faux, Toujours→Jamais) qu'un désordre rendrait illisible.
   *
   * ⚠️ `ligne` reste partout l'index D'ORIGINE : réponses, corrigé et nom de
   * groupe s'y réfèrent. Ce champ ne change que l'ordre de la boucle.
   */
  ordre?: number[] | null;
}

export default function MatriceField({
  items,
  colonnes,
  valeurs,
  onChange,
  disabled,
  multiple,
  attendu,
  nomGroupe,
  ordre,
}: Props) {
  const rangs = ordre && ordre.length === items.length ? ordre : items.map((_, i) => i);
  const choisir = (ligne: number, colonne: number) => {
    if (disabled) return;
    if (!multiple) {
      onChange({ ...valeurs, [ligne]: colonne });
      return;
    }
    const deja = matriceColonnes(valeurs[ligne]);
    const suivantes = deja.includes(colonne)
      ? deja.filter((c) => c !== colonne)
      : [...deja, colonne].sort((a, b) => a - b);
    onChange({ ...valeurs, [ligne]: suivantes });
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
          {rangs.map((ligne) => {
            const item = items[ligne];
            const attenduLigne = matriceColonnes(attendu?.[ligne]);
            const notee = attenduLigne.length > 0;
            const cochees = matriceColonnes(valeurs[ligne]);
            // Juste = EXACTEMENT ce qui est attendu, ni plus ni moins
            const faux =
              notee &&
              (cochees.length !== attenduLigne.length ||
                !attenduLigne.every((c) => cochees.includes(c)));
            return (
              <tr key={ligne} className={faux ? styles.ligneKo : ''}>
                <th scope="row">{item}</th>
                {colonnes.map((_, colonne) => (
                  <td
                    key={colonne}
                    // La colonne attendue se teinte en vert quand la
                    // correction est rendue — l'élève voit d'un coup d'œil
                    // les lignes qu'il a manquées, sans relire un bandeau.
                    className={notee && attenduLigne.includes(colonne) ? styles.attenduCell : ''}
                  >
                    <input
                      type={multiple ? 'checkbox' : 'radio'}
                      name={multiple ? undefined : `${nomGroupe}-${ligne}`}
                      checked={cochees.includes(colonne)}
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
