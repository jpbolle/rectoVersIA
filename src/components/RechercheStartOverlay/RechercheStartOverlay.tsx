'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './RechercheStartOverlay.module.css';

interface RechercheStartOverlayProps {
  /** Identifiant du questionnaire — transmis à l'extension pour l'ouvrir directement */
  questionnaireId: string;
  /** Aperçu prof : le bouton n'ouvre rien */
  previewMode?: boolean;
}

// Le script de contenu de NavigKid! est injecté sur toutes les pages, y compris
// celle-ci : on lui parle par `window.postMessage`, il relaie vers l'extension.
const CANAL_PAGE = 'rectoversia-navigkid';
const CANAL_EXTENSION = 'navigkid-extension';
const DELAI_REPONSE_MS = 2500;

type Etat = 'idle' | 'attente' | 'ouvert' | 'manuel' | 'introuvable';

export default function RechercheStartOverlay({
  questionnaireId,
  previewMode = false,
}: RechercheStartOverlayProps) {
  const [etat, setEtat] = useState<Etat>('idle');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleStart = useCallback(() => {
    if (previewMode) return;
    setEtat('attente');

    const onReponse = (event: MessageEvent) => {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || data.source !== CANAL_EXTENSION || data.type !== 'DEMARRAGE_RESULTAT') return;
      window.removeEventListener('message', onReponse);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      // Chrome refuse parfois d'ouvrir le panneau depuis un relais : l'extension
      // affiche alors un bandeau sur la page Google et nous le signale ici.
      setEtat(data.panneauOuvert ? 'ouvert' : 'manuel');
    };

    window.addEventListener('message', onReponse);
    timeoutRef.current = setTimeout(() => {
      window.removeEventListener('message', onReponse);
      setEtat('introuvable');
    }, DELAI_REPONSE_MS);

    window.postMessage(
      { source: CANAL_PAGE, type: 'DEMARRER_RECHERCHE', questionnaireId },
      window.location.origin,
    );
  }, [previewMode, questionnaireId]);

  return (
    <div className={styles.overlay} role="dialog" aria-modal="false">
      <div className={styles.card}>
        <div className={styles.icon} aria-hidden="true">🔍</div>
        <h3 className={styles.title}>Cette activité se déroule dans NavigKid!</h3>
        <p className={styles.text}>
          L&apos;activité se déroule à partir du moteur de recherche et de l&apos;extension{' '}
          <strong>NavigKid!</strong>, qui se trouve parmi les extensions de ton navigateur.
          Quand tu te sens prêt, clique sur le bouton ci-dessous : il ouvrira une page Google
          ainsi que le panneau latéral de l&apos;extension. Ta recherche commencera
          immédiatement — <strong>tout ce que tu écriras sera enregistré</strong>.
          <span className={styles.warning}>
            Tes réponses s&apos;afficheront ici une fois que tu les auras envoyées depuis
            l&apos;extension.
          </span>
        </p>

        <button
          type="button"
          className={styles.button}
          onClick={handleStart}
          disabled={previewMode || etat === 'attente'}
          title={previewMode ? 'Indisponible en aperçu' : undefined}
        >
          {etat === 'attente' ? 'Ouverture…' : 'Commencer ma recherche'}
        </button>

        {etat === 'ouvert' && (
          <p className={`${styles.feedback} ${styles.feedbackInfo}`}>
            C&apos;est parti ! Ta recherche s&apos;est ouverte dans un nouvel onglet, avec le
            panneau NavigKid! sur le côté. Reviens sur cette page après avoir envoyé tes réponses.
          </p>
        )}

        {etat === 'manuel' && (
          <p className={`${styles.feedback} ${styles.feedbackManuel}`}>
            La page Google est ouverte, mais le panneau ne s&apos;est pas affiché tout seul.
            Dans le nouvel onglet, clique sur l&apos;icône <strong>NavigKid!</strong> (en haut à
            droite du navigateur), puis sur « Ouvrir le questionnaire ».
          </p>
        )}

        {etat === 'introuvable' && (
          <p className={`${styles.feedback} ${styles.feedbackErreur}`}>
            Je ne trouve pas l&apos;extension NavigKid! dans ce navigateur. Vérifie qu&apos;elle
            est bien installée et activée, puis réessaie.
            <button type="button" className={styles.retry} onClick={handleStart}>
              Réessayer
            </button>
          </p>
        )}

        {previewMode && (
          <p className={`${styles.feedback} ${styles.feedbackInfo}`}>
            Aperçu professeur : le bouton est désactivé, c&apos;est ce voile que voit
            l&apos;élève tant qu&apos;il n&apos;a pas envoyé ses réponses.
          </p>
        )}
      </div>
    </div>
  );
}
