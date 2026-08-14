'use client';

// Aperçu d'un questionnaire de recherche — tel que l'élève le lira dans le
// panneau de l'extension NavigKid!.
//
// Pourquoi une popup plutôt que la vraie page élève : sur une activité de
// recherche, la page élève est volontairement voilée tant que rien n'a été
// envoyé (RechercheStartOverlay). Le prof n'y verrait donc jamais ses questions.
// Ici, rien du corrigé n'apparaît : ni bonnes réponses, ni réponse attendue,
// ni références.

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { NavigKidQuestion } from '@/types/navigkid';
import styles from './QuestionnairePreviewModal.module.css';

interface Props {
  titre: string;
  consignes?: string;
  questions: NavigKidQuestion[];
  onClose: () => void;
}

export default function QuestionnairePreviewModal({ titre, consignes, questions, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  const totalReponses = questions.reduce((s, q) => s + (q.points || 0), 0);
  const totalDemarche = questions.reduce((s, q) => s + (q.pointsDemarche ?? q.nbSources ?? 0), 0);

  return createPortal(
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.head}>
          <div>
            <h2 className={styles.title}>{titre || 'Questionnaire sans titre'}</h2>
            <p className={styles.subtitle}>
              Aperçu — ce que l&apos;élève lit dans le panneau NavigKid!
            </p>
          </div>
          <button type="button" className={styles.close} onClick={onClose} title="Fermer">
            ✕
          </button>
        </div>

        <div className={styles.body}>
          {consignes && <div className={styles.consignes}>{consignes}</div>}

          {questions.length === 0 ? (
            <p className={styles.empty}>Aucune question dans ce questionnaire.</p>
          ) : (
            questions.map((q, i) => (
              <div key={i} className={styles.qCard}>
                <div className={styles.qHead}>
                  <span className={styles.qNum}>{i + 1}</span>
                  <span className={styles.qTexte}>{q.texte || <em>Énoncé vide</em>}</span>
                </div>

                {q.document && <div className={styles.qDoc}>{q.document}</div>}

                {q.type === 'qcm' ? (
                  <div className={styles.options}>
                    {(q.options || []).map((opt, j) => (
                      <label key={j} className={styles.option}>
                        <input type="radio" disabled />
                        <span>{opt || <em>Option vide</em>}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className={styles.fauxChamp}>Zone de réponse de l&apos;élève</div>
                )}

                <div className={styles.qFoot}>
                  <span className={styles.chip}>
                    🔗 {q.nbSources} source{q.nbSources > 1 ? 's' : ''} à collecter
                  </span>
                  {(q.points || 0) > 0 && <span className={styles.chip}>Réponse : {q.points} pts</span>}
                  <span className={`${styles.chip} ${styles.chipDemarche}`}>
                    Démarche : {q.pointsDemarche ?? q.nbSources} pts
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className={styles.foot}>
          <span className={styles.totals}>
            {questions.length} question{questions.length > 1 ? 's' : ''} · Réponses {totalReponses} pts ·
            Démarche {totalDemarche} pts
          </span>
          <button type="button" className={styles.btnClose} onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
