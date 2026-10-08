'use client';

// ═══ Écran ÉLÈVE du SONDAGE ANONYME AU RYTHME DE L'ÉLÈVE (manche « libre ») ═══
//
// Le questionnaire entier, comme une auto-évaluation — c'est d'ailleurs le
// même écran (`AutoEvalActivity`) — mais les réponses ne vont PAS dans la
// copie : elles partent en une fois dans la manche libre de sa classe
// (`/api/sondage/libre`), où personne ne saura qui a répondu quoi. Pas de
// brouillon enregistré : tant qu'il n'a pas envoyé, rien n'a quitté l'écran.
// Après l'envoi, un merci — et plus rien à modifier.

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import AutoEvalActivity from '@/components/AutoEvalActivity/AutoEvalActivity';
import { parseAutoEvalAnswers } from '@/types/autoevaluation';
import type { AutoEvalQuestionnaire } from '@/types/autoevaluation';
import styles from '@/components/Competition/CompetitionActivity.module.css';
import propres from './SondageActivity.module.css';

interface Props {
  devoirId: string;
  quiz: AutoEvalQuestionnaire;
  /** Prof en aperçu : il voit le questionnaire, rien ne part */
  previewMode?: boolean;
}

type Etat = 'chargement' | 'ouvert' | 'envoye' | 'ferme';

export default function SondageLibreActivity({ devoirId, quiz, previewMode = false }: Props) {
  const { getAuthHeaders } = useAuth();
  const [etat, setEtat] = useState<Etat>('chargement');
  const [content, setContent] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Où en est-il ? (déjà envoyé, sondage clos)
  useEffect(() => {
    let annule = false;
    (async () => {
      if (previewMode) {
        setEtat('ouvert');
        return;
      }
      try {
        const headers = await getAuthHeaders();
        if (!headers) {
          if (!annule) setEtat('ouvert');
          return;
        }
        const res = await fetch(`/api/sondage/libre?devoirId=${encodeURIComponent(devoirId)}`, {
          headers,
          cache: 'no-store',
        });
        const json = await res.json();
        if (annule) return;
        const d = json.success ? (json.data as { aRepondu?: boolean; ferme?: boolean }) : {};
        setEtat(d.aRepondu ? 'envoye' : d.ferme ? 'ferme' : 'ouvert');
      } catch {
        if (!annule) setEtat('ouvert');
      }
    })();
    return () => {
      annule = true;
    };
  }, [devoirId, previewMode, getAuthHeaders]);

  const envoyer = useCallback(async () => {
    if (previewMode) return;
    const answers = parseAutoEvalAnswers(content)?.answers ?? {};
    setEnvoi(true);
    setErreur(null);
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch('/api/sondage/libre', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ devoirId, answers }),
      });
      const json = await res.json();
      if (json.success && json.data?.ok === true) {
        setEtat('envoye');
        return;
      }
      const motif = json.data?.motif as string | undefined;
      if (motif === 'deja') setEtat('envoye');
      else if (motif === 'phase') setEtat('ferme');
      else if (motif === 'vide') setErreur('Réponds au moins à une question avant d’envoyer.');
      else setErreur(json.message || 'Tes réponses n’ont pas pu être envoyées.');
    } catch {
      setErreur('Tes réponses n’ont pas pu être envoyées. Réessaie.');
    } finally {
      setEnvoi(false);
    }
  }, [content, devoirId, previewMode, getAuthHeaders]);

  if (etat === 'chargement') {
    return <div className={styles.attente}>Chargement…</div>;
  }

  if (etat === 'envoye') {
    return (
      <div className={styles.attente}>
        <p className={styles.attenteTitre}>Réponses envoyées</p>
        <p>Merci d’avoir participé.</p>
        <p className={propres.rassurance}>
          Tes réponses sont anonymes : personne ne saura ce que tu as répondu.
        </p>
      </div>
    );
  }

  if (etat === 'ferme') {
    return (
      <div className={styles.attente}>
        <p className={styles.attenteTitre}>Sondage clos</p>
        <p>Ton professeur a fermé ce sondage.</p>
      </div>
    );
  }

  return (
    <div className={propres.libre}>
      <p className={propres.rassurance}>
        Tes réponses sont anonymes : personne ne saura ce que tu as répondu. Tu envoies tout en une
        fois, et tu ne pourras plus les modifier ensuite.
      </p>
      <AutoEvalActivity
        quiz={quiz}
        content={content}
        onChange={setContent}
        readOnly={previewMode}
        onSubmit={previewMode ? undefined : envoyer}
        isSubmitting={envoi}
      />
      {erreur && <p className={styles.refus}>{erreur}</p>}
    </div>
  );
}
