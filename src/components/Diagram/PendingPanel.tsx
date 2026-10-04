'use client';

/**
 * Onglet « À placer » : les éléments qu'une transformation n'a pas su caser, sous forme
 * de tags à glisser sur une boîte du schéma. On peut aussi en retirer un.
 */
import { setTagData } from '@/lib/diagram/tag-drop';
import styles from './PendingPanel.module.css';

interface Props {
  tags: string[];
  onRemove: (tag: string) => void;
}

export function PendingPanel({ tags, onRemove }: Props) {
  if (!tags.length) {
    return <p className={styles.empty}>Rien à placer : tout a trouvé sa place dans le schéma.</p>;
  }
  return (
    <div className={styles.panel}>
      <p className={styles.hint}>Glisse un tag sur une boîte du schéma : il devient une idée (ou un concept) rattaché.</p>
      <ul className={styles.list}>
        {tags.map((tag, i) => (
          <li key={`${tag}-${i}`} className={styles.tag} draggable onDragStart={(e) => setTagData(e, tag)} title="Glisser sur une boîte">
            <span className={styles.grip} aria-hidden>
              ⠿
            </span>
            <span className={styles.text}>{tag}</span>
            <button type="button" className={styles.remove} onClick={() => onRemove(tag)} aria-label={`Retirer « ${tag} »`}>
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
