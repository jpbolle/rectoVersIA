'use client';

// Point d'entrée du banc d'essai (étape 1) : la liste des activités de lecture
// du prof, et pour chacune ses sessions — une par classe.
//
// Provisoire par nature : quand le mode Compétition sera livré, on entrera
// dans une partie depuis la carte de l'activité, pas depuis une page à part.
// Il fallait néanmoins pouvoir lancer une manche sans composer une adresse à
// la main.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import styles from './[sessionId]/page.module.css';

interface DevoirLeger {
  id: string;
  intitule: string;
  typeTravail?: string;
}

interface SessionLegere {
  id: string;
  classeNom: string;
}

export default function DirectIndexPage() {
  const { getAuthHeaders, role, isLoading: authLoading } = useAuth();
  const [devoirs, setDevoirs] = useState<DevoirLeger[]>([]);
  const [sessions, setSessions] = useState<Record<string, SessionLegere[]>>({});
  const [ouvert, setOuvert] = useState<string | null>(null);

  useEffect(() => {
    if (role !== 'prof') return;
    (async () => {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch('/api/devoirs', { headers });
      const json = await res.json();
      if (!json.success) return;
      setDevoirs(
        (json.data as DevoirLeger[]).filter((d) => d.typeTravail === 'lire')
      );
    })();
  }, [role, getAuthHeaders]);

  const chargerSessions = useCallback(
    async (devoirId: string) => {
      setOuvert((o) => (o === devoirId ? null : devoirId));
      if (sessions[devoirId]) return;
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch(`/api/sessions?devoirId=${devoirId}`, { headers });
      const json = await res.json();
      if (json.success) {
        setSessions((s) => ({ ...s, [devoirId]: json.data as SessionLegere[] }));
      }
    },
    [sessions, getAuthHeaders]
  );

  if (authLoading) return <div className={styles.page}><p className={styles.attente}>Chargement…</p></div>;
  if (role !== 'prof') {
    return (
      <div className={styles.page}>
        <h1 className={styles.titre}>Compétition — banc d’essai</h1>
        <p className={styles.attente}>
          Réservé au professeur. Côté élève, ouvre directement l’adresse de la manche.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.titre}>Compétition — banc d’essai</h1>
      <p className={styles.attente}>
        Choisis une activité de lecture, puis la classe : c’est la session qui
        porte la manche.
      </p>

      {devoirs.length === 0 && (
        <p className={styles.attente}>Aucune activité de lecture.</p>
      )}

      <ul className={styles.choix}>
        {devoirs.map((d) => (
          <li key={d.id}>
            <button
              type="button"
              className={styles.choixBtn}
              onClick={() => chargerSessions(d.id)}
            >
              {d.intitule || d.id}
            </button>
            {ouvert === d.id && (
              <ul className={styles.choix} style={{ marginTop: 10, paddingLeft: 24 }}>
                {(sessions[d.id] ?? []).map((s) => (
                  <li key={s.id}>
                    <Link href={`/direct/${s.id}`} className={styles.choixBtn}>
                      {s.classeNom}
                    </Link>
                  </li>
                ))}
                {sessions[d.id]?.length === 0 && (
                  <li className={styles.attente}>
                    Aucune classe rattachée à cette activité.
                  </li>
                )}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
