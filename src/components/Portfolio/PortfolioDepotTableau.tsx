'use client';

// La partie TABLEAU d'un dépôt de portfolio (plan 2026-10-10, séance b) : le
// prof fixe les colonnes (« Réplique · Didascalie »), l'élève ajoute les
// lignes. Les lignes sont stockées en JSON (`string[][]`) dans la clé
// `{etape}/{depot}/tableau` de la copie, comme n'importe quelle partie :
// même frappe différée, même fusion champ par champ côté serveur.
//
// Tableau PERSONNEL : la co-édition à plusieurs viendra avec les étapes
// collectives (étapes 2-3 du plan parent).
//
// Le même composant sert à la lecture de la copie par le prof (`lectureSeule`).

import AutoGrowTextarea from '@/components/AutoGrowTextarea';
import { lireTableau } from '@/lib/portfolio-etat';
import { MAX_LIGNES_TABLEAU } from '@/types/portfolio';
import styles from './Portfolio.module.css';

interface Props {
  valeur: string;
  colonnes: string[];
  onChange?: (valeur: string) => void;
  lectureSeule?: boolean;
}

export default function PortfolioDepotTableau({ valeur, colonnes, onChange, lectureSeule = false }: Props) {
  const nb = Math.max(1, colonnes.length);
  // Chaque ligne a exactement autant de cellules que de colonnes
  const ajuster = (l: string[]) => Array.from({ length: nb }, (_, i) => l[i] ?? '');
  const stockees = lireTableau(valeur).map(ajuster);
  // Lecture : on cache les lignes vides ; saisie : au moins une ligne à remplir
  const lignes = lectureSeule
    ? stockees.filter((l) => l.some((c) => c.trim()))
    : stockees.length > 0
      ? stockees
      : [ajuster([])];

  const ecrire = (suivantes: string[][]) => onChange?.(JSON.stringify(suivantes));
  const majCellule = (li: number, ci: number, texte: string) =>
    ecrire(lignes.map((l, i) => (i === li ? l.map((c, j) => (j === ci ? texte : c)) : l)));
  const ajouterLigne = () => ecrire([...lignes, ajuster([])]);
  const retirerLigne = (li: number) => ecrire(lignes.filter((_, i) => i !== li));

  if (lectureSeule && lignes.length === 0) return <p className={styles.lectureVide}>Tableau vide.</p>;

  return (
    <div className={styles.tableauDepot}>
      <div className={styles.tableauDefile}>
        <table className={styles.tableau}>
          <thead>
            <tr>
              {colonnes.map((c, i) => (
                <th key={i}>{c}</th>
              ))}
              {!lectureSeule && <th className={styles.tableauActionCol} aria-label="Retirer" />}
            </tr>
          </thead>
          <tbody>
            {lignes.map((ligne, li) => (
              <tr key={li}>
                {ligne.map((cellule, ci) => (
                  <td key={ci}>
                    {lectureSeule ? (
                      <span className={styles.tableauTexte}>{cellule}</span>
                    ) : (
                      <AutoGrowTextarea
                        className={styles.tableauCellule}
                        value={cellule}
                        onChange={(e) => majCellule(li, ci, e.target.value)}
                        minRows={1}
                        maxRows={8}
                        aria-label={`${colonnes[ci] || 'Colonne'}, ligne ${li + 1}`}
                      />
                    )}
                  </td>
                ))}
                {!lectureSeule && (
                  <td className={styles.tableauActionCol}>
                    {lignes.length > 1 && (
                      <button
                        type="button"
                        className={styles.depotSup}
                        onClick={() => retirerLigne(li)}
                        title="Retirer cette ligne"
                        aria-label={`Retirer la ligne ${li + 1}`}
                      >
                        ✕
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!lectureSeule && lignes.length < MAX_LIGNES_TABLEAU && (
        <button type="button" className={styles.tableauAjout} onClick={ajouterLigne}>
          + Ajouter une ligne
        </button>
      )}
    </div>
  );
}
