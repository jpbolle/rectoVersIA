'use client';

// Bloc « Activités » du détail d'une classe.
//
// Deuxième porte d'entrée vers les mêmes sessions : le prof pense tantôt à son
// activité (« où en est ce diagnostic ? »), tantôt à sa classe (« qu'est-ce que
// la 4C a en cours ? »). Comme le bloc Certifications juste au-dessus, ce n'est
// qu'une VUE — rien ne se déclare ici, tout se pilote depuis Mes Activités.
//
// Une classe sans session ne voit rien, et le dit.

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import styles from './ClasseActivites.module.css';

interface ActiviteDeClasse {
  sessionId: string;
  devoirId: string;
  intitule: string;
  typeTravail: string;
  anneeScolaire: string;
  disponible: boolean;
  corrigeDisponible: boolean;
  archive: boolean;
  remises: number;
  total: number;
}

const ICONE: Record<string, string> = {
  ecrire: '✏️',
  lire: '📖',
  rechercher: '🔎',
  vocabulaire: '📚',
  autoevaluation: '🪞',
};

export default function ClasseActivites({ classeId }: { classeId: string }) {
  const { isAuthenticated, getAuthHeaders } = useAuth();
  const router = useRouter();
  const [activites, setActivites] = useState<ActiviteDeClasse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const charger = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch(`/api/sessions?classeId=${encodeURIComponent(classeId)}`, {
        headers,
      });
      const json = await res.json();
      if (json.success) setActivites(json.data);
    } catch (err) {
      console.error('Erreur chargement des activités de la classe:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, getAuthHeaders, classeId]);

  useEffect(() => {
    charger();
  }, [charger]);

  if (isLoading) {
    return (
      <section className={styles.section}>
        <h3 className={styles.title}>Activités</h3>
        <p className={styles.dim}>Chargement…</p>
      </section>
    );
  }

  // Les archivées passent derrière : on vient ici pour ce qui est en cours.
  const enCours = activites.filter((a) => !a.archive);
  const rangees = activites.filter((a) => a.archive);

  return (
    <section className={styles.section}>
      <h3 className={styles.title}>
        Activités <span className={styles.compteur}>{activites.length}</span>
      </h3>

      {activites.length === 0 ? (
        <p className={styles.dim}>
          Aucune activité ne vise cette classe. Ajoutez-la à une activité depuis Mes
          Activités : elle y recevra sa propre ouverture et son propre corrigé.
        </p>
      ) : (
        <>
          {[...enCours, ...rangees].map((a) => (
            <button
              key={a.sessionId}
              type="button"
              className={`${styles.ligne} ${a.archive ? styles.archivee : ''}`}
              onClick={() => router.push(`/dashboard/travaux/${a.devoirId}`)}
            >
              <span className={styles.icone}>{ICONE[a.typeTravail] ?? '📄'}</span>
              <span className={styles.intitule}>{a.intitule}</span>
              <span className={styles.compte}>
                {a.total === 0
                  ? 'aucun élève'
                  : `${a.remises}/${a.total} remise${a.remises > 1 ? 's' : ''}`}
              </span>
              <span className={styles.etats}>
                {a.disponible && <span className={`${styles.pastille} ${styles.ouverte}`}>Ouverte</span>}
                {a.corrigeDisponible && (
                  <span className={`${styles.pastille} ${styles.corrige}`}>Corrigé rendu</span>
                )}
                {a.archive && <span className={styles.pastille}>Archivée</span>}
              </span>
              <span className={styles.chevron} aria-hidden="true">›</span>
            </button>
          ))}
        </>
      )}
    </section>
  );
}
