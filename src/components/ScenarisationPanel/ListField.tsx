'use client';

// Liste de textes libres, éditables sur place — les objectifs généraux d'un
// chapitre. Un chapitre en vise rarement un seul : chacun est une ligne qu'on
// modifie directement, et la croix la retire. Aucune icône crayon (règle de
// l'écran d'encodage).

import AutoTextarea from './AutoTextarea';
import styles from './ScenarisationPanel.module.css';

interface Props {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  ajouterLabel?: string;
  // Enregistrement immédiat pour l'ajout et le retrait, différé pour la frappe
  onStructuralChange?: (values: string[]) => void;
}

export default function ListField({
  values,
  onChange,
  placeholder = 'Objectif…',
  ajouterLabel = '＋ objectif',
  onStructuralChange,
}: Props) {
  const structurel = onStructuralChange ?? onChange;

  return (
    <div className={styles.listField}>
      {values.map((v, i) => (
        <div key={i} className={styles.listRow}>
          <span className={styles.listPuce}>•</span>
          <AutoTextarea
            className={styles.listInput}
            value={v}
            placeholder={placeholder}
            onChange={(t) => onChange(values.map((x, j) => (j === i ? t : x)))}
          />
          <button
            type="button"
            className={styles.listDel}
            title="Retirer"
            onClick={() => structurel(values.filter((_, j) => j !== i))}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        className={styles.listAdd}
        onClick={() => structurel([...values, ''])}
      >
        {ajouterLabel}
      </button>
    </div>
  );
}
