'use client';

/** Onglet « Markdown » : le texte du schéma en direct ; on le modifie et on l'applique. */
import buttons from '@/components/Diagram/ui/buttons.module.css';
import styles from './MarkdownPanel.module.css';

interface Props {
  text: string;
  dirty: boolean;
  withPositions: boolean;
  onWithPositions: (v: boolean) => void;
  onEdit: (text: string) => void;
  onCancel: () => void;
  onApply: () => void;
  onCopy: () => void;
}

export function MarkdownPanel({ text, dirty, withPositions, onWithPositions, onEdit, onCancel, onApply, onCopy }: Props) {
  return (
    <div className={styles.panel}>
      <div className={styles.bar}>
        <label className={styles.check}>
          <input type="checkbox" checked={withPositions} onChange={(e) => onWithPositions(e.target.checked)} />
          avec positions
        </label>
        <span className={styles.spacer} />
        {dirty && (
          <button type="button" className={`${buttons.button} ${buttons.small}`} onClick={onCancel}>
            Annuler
          </button>
        )}
        <button type="button" className={`${buttons.button} ${buttons.small}`} onClick={onCopy}>
          Copier
        </button>
        <button type="button" className={`${buttons.button} ${buttons.small} ${buttons.primary}`} onClick={onApply} disabled={!dirty}>
          Appliquer
        </button>
      </div>
      <textarea className={styles.markdown} value={text} spellCheck={false} onChange={(e) => onEdit(e.target.value)} />
    </div>
  );
}
