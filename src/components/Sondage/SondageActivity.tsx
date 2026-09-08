'use client';

// ═══ Écran ÉLÈVE du SONDAGE en direct ═══
//
// Même mécanique que la compétition (`CompetitionActivity`) : l'élève ouvre
// son activité, sa CLASSE désigne la partie, il attend, la question surgit au
// même instant que chez ses camarades. Il compose librement, CONFIRME par le
// bouton « Envoyer ma réponse », et c'est figé.
//
// Ce qui change : rien n'est juste ou faux, rien n'est compté. Une fois la
// question close, il voit ce que la classe a répondu — sans un nom, le sien
// compris. Et à la fin, un merci : pas de score, pas de rang.

import { useCallback, useMemo, useState } from 'react';
import { AutoEvalReponse } from '@/components/AutoEvalActivity/AutoEvalActivity';
import SondageRepartition from './SondageRepartition';
import { useDirect } from '@/hooks/useDirect';
import type { AutoEvalAnswer } from '@/types/autoevaluation';
import type { SondageVue } from '@/types/manche';
import styles from '@/components/Competition/CompetitionActivity.module.css';
import propres from './SondageActivity.module.css';

interface Props {
  devoirId: string;
  intitule?: string;
}

export default function SondageActivity({ devoirId, intitule }: Props) {
  const { vue, demarree, reste, avantDepart, isLoading, repondre } = useDirect<SondageVue>({
    devoirId,
    base: '/api/sondage',
  });

  // Les réponses en cours de composition, RANGÉES PAR QUESTION — pas d'effet
  // de remise à zéro (cf. `CompetitionActivity`).
  const [brouillons, setBrouillons] = useState<Record<string, AutoEvalAnswer>>({});
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState<{ questionId: string; motif: string } | null>(null);
  const [confirme, setConfirme] = useState<string | null>(null);
  const questionId = vue?.question?.id ?? null;
  const brouillon = useMemo<AutoEvalAnswer>(
    () => (questionId && brouillons[questionId]) || {},
    [questionId, brouillons]
  );

  const poser = useCallback(
    (patch: Partial<AutoEvalAnswer>) => {
      if (!questionId) return;
      setBrouillons((b) => ({ ...b, [questionId]: { ...b[questionId], ...patch } }));
    },
    [questionId]
  );

  const envoyer = useCallback(async () => {
    if (!questionId) return;
    setEnvoi(true);
    setRefus(null);
    const { accepte, motif } = await repondre(questionId, brouillon);
    setEnvoi(false);
    if (accepte) setConfirme(questionId);
    else setRefus({ questionId, motif: motif ?? 'inconnu' });
  }, [questionId, brouillon, repondre]);

  if (isLoading) {
    return <div className={styles.attente}>Chargement…</div>;
  }

  if (!vue || vue.phase === 'salle') {
    return (
      <div className={styles.attente}>
        <p className={styles.attenteTitre}>{intitule || 'Sondage'}</p>
        <p>En attente de ton professeur…</p>
        <p className={propres.rassurance}>
          Tes réponses sont anonymes : personne ne saura ce que tu as répondu.
        </p>
      </div>
    );
  }

  if (vue.phase === 'finie') {
    return (
      <div className={styles.attente}>
        <p className={styles.attenteTitre}>Sondage terminé</p>
        <p>Merci d’avoir participé.</p>
      </div>
    );
  }

  if (avantDepart > 0) {
    return <div className={styles.rebours}>{avantDepart}</div>;
  }

  const q = vue.question;
  if (!q) {
    return <div className={styles.attente}>En attente de la question suivante…</div>;
  }

  const info = q.type === 'info';
  const dejaConfirme = vue.aRepondu === true || confirme === q.id;
  const ouverte = demarree && !envoi && !dejaConfirme && vue.phase === 'question';
  const close = vue.phase === 'resultat';
  // Une réponse sans contenu n'est pas une réponse : le bouton reste gris.
  const brouillonVide =
    !(typeof brouillon.choiceIndex === 'number') &&
    !(brouillon.choiceIndexes?.length) &&
    !(typeof brouillon.text === 'string' && brouillon.text.trim()) &&
    !brouillon.echelon &&
    !(typeof brouillon.likert === 'number' && brouillon.likert > 0) &&
    Object.keys(brouillon.matrice ?? {}).length === 0;
  const motifRefus = refus && refus.questionId === q.id ? refus.motif : null;

  return (
    <div className={styles.espace}>
      {demarree && vue.chronoSec > 0 && vue.phase === 'question' && (
        <div className={styles.chrono}>
          <span className={`${styles.chronoValeur} ${reste <= 10 ? styles.chronoUrgent : ''}`}>
            {reste}
          </span>
          <div className={styles.chronoBarre}>
            <i style={{ width: `${(reste / vue.chronoSec) * 100}%` }} />
          </div>
        </div>
      )}

      {info ? (
        <div className={propres.info}>{q.enonce}</div>
      ) : (
        <>
          <div className={propres.enonce}>
            {vue.numero > 0 && <span className={propres.numero}>{vue.numero}</span>}
            <p>{q.enonce}</p>
          </div>

          {close ? (
            <SondageRepartition question={q} data={vue.repartition} />
          ) : (
            <div className={propres.reponse}>
              <AutoEvalReponse question={q} answer={brouillon} onChange={poser} disabled={!ouverte} />
            </div>
          )}
        </>
      )}

      {dejaConfirme && vue.phase === 'question' && (
        <p className={styles.repondu}>Réponse envoyée ✓</p>
      )}
      {motifRefus && (
        <p className={styles.refus}>
          {motifRefus === 'phase'
            ? 'Trop tard : la question est fermée.'
            : motifRefus === 'vide'
            ? 'Ta réponse est vide.'
            : motifRefus === 'deja'
            ? 'Tu as déjà répondu à cette question.'
            : motifRefus === 'question'
            ? 'La question a changé — attends la suivante.'
            : 'Ta réponse n’a pas pu être envoyée.'}
        </p>
      )}

      {!info && ouverte && (
        <div className={styles.bottomActions}>
          <span className={styles.bottomActionsLine} />
          <div className={styles.bottomActionsRow}>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={envoyer}
              disabled={envoi || brouillonVide}
            >
              {envoi ? 'Envoi…' : 'Envoyer ma réponse'}
            </button>
          </div>
          <span className={styles.bottomActionsLine} />
        </div>
      )}
    </div>
  );
}
