'use client';

// Onglet « Évaluation » d'un atelier de conceptualisation : pas de grille ni
// de note en v1 (décision JP 2026-10-04, option O5-A du plan) — le prof lit le
// schéma et laisse un commentaire général (texte, audio), que l'élève voit ici
// une fois la correction rendue visible.

import type { Correction } from '@/types/correction';
import styles from './SchemaEvaluation.module.css';

interface Props {
  correction?: Partial<Correction> | null;
  isProfessorView?: boolean;
}

export default function SchemaEvaluation({ correction, isProfessorView = false }: Props) {
  const visible = isProfessorView || correction?.visibleParEleve === true;
  const aCommentaire = !!(correction?.commentaireGeneral || correction?.commentaireGeneralAudio);

  return (
    <div className={styles.panel}>
      <p className={styles.note}>
        Un schéma ne se note pas sur une grille : le professeur le lit et le commente.
      </p>
      {isProfessorView && (
        <p className={styles.hint}>Le commentaire général se rédige sous le schéma, dans la page de correction.</p>
      )}
      {!isProfessorView && !visible && (
        <p className={styles.hint}>Le commentaire du professeur apparaîtra ici quand il aura corrigé ton schéma.</p>
      )}
      {visible && aCommentaire && (
        <div className={styles.commentaire}>
          <h4 className={styles.titre}>Commentaire du professeur</h4>
          {correction?.commentaireGeneralAudio && (
            <audio controls src={correction.commentaireGeneralAudio} className={styles.audio} />
          )}
          {correction?.commentaireGeneral && <p className={styles.texte}>{correction.commentaireGeneral}</p>}
        </div>
      )}
      {visible && !aCommentaire && !isProfessorView && (
        <p className={styles.hint}>Le professeur n’a pas laissé de commentaire.</p>
      )}
    </div>
  );
}
