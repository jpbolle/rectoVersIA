'use client';

// Fiche élève (prof, classe FLE) : la liste de ses lectures de cours.
// Servie par GET /api/fle/lectures?eleveId= ; un clic ouvre la lecture en
// lecture seule dans un nouvel onglet (la fiche est une popup sur Mes Classes).

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { SECTIONS_ORDRE, libelleSource } from '@/types/lecture-cours';
import type { LectureCoursResume } from '@/types/lecture-cours';
import styles from './LecturesCoursEleve.module.css';

interface Props {
  eleveId: string;
}

export default function LecturesCoursEleve({ eleveId }: Props) {
  const { getAuthHeaders, isAuthenticated } = useAuth();
  const [lectures, setLectures] = useState<LectureCoursResume[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    let annule = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const res = await fetch(`/api/fle/lectures?eleveId=${encodeURIComponent(eleveId)}`, { headers });
        const json = await res.json();
        if (annule) return;
        if (json.success) setLectures(json.data as LectureCoursResume[]);
        else setErreur(json.message || 'Impossible de charger les lectures.');
      } catch {
        if (!annule) setErreur('Impossible de charger les lectures.');
      }
    })();
    return () => {
      annule = true;
    };
  }, [isAuthenticated, getAuthHeaders, eleveId]);

  if (erreur) return <p className={styles.vide}>{erreur}</p>;
  if (lectures === null) return <p className={styles.vide}>Chargement…</p>;
  if (lectures.length === 0) return <p className={styles.vide}>Aucune lecture de cours pour l’instant.</p>;

  return (
    <ul className={styles.liste}>
      {lectures.map((l) => (
        <li key={l.id}>
          <a
            className={styles.ligne}
            href={`/fle/lectures/${encodeURIComponent(l.id)}?eleveId=${encodeURIComponent(eleveId)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className={styles.picto} aria-hidden="true">📚</span>
            <span className={styles.texte}>
              <span className={styles.titre}>{l.titre}</span>
              <span className={styles.meta}>
                {[
                  libelleSource(l.source),
                  l.createdAt ? new Date(l.createdAt).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long' }) : '',
                  l.niveau ? l.niveau.toUpperCase() : '',
                  `${l.sectionsPretes}/${SECTIONS_ORDRE.length} sections`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
            <span className={styles.fleche} aria-hidden="true">↗</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
