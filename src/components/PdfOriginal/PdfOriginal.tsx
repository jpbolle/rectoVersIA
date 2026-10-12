'use client';

// Le PDF d'origine d'une lecture de cours, dans le lecteur PDF de Chrome
// (plan du 2026-10-12) : l'élève garde ses repères (pages, images, mise en
// page). Le fichier est demandé AVEC les en-têtes d'authentification, puis
// montré depuis la mémoire du navigateur (adresse `blob:`) — un cadre ne sait
// pas envoyer ces en-têtes lui-même.

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import styles from './PdfOriginal.module.css';

interface Props {
  lectureId: string;
  titre: string;
}

export default function PdfOriginal({ lectureId, titre }: Props) {
  const { getAuthHeaders } = useAuth();
  const [adresse, setAdresse] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    let creee: string | null = null;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) throw new Error('Connexion perdue : reconnecte-toi.');
        const res = await fetch(`/api/fle/lectures/${lectureId}/pdf`, { headers });
        if (!res.ok) {
          const json = await res.json().catch(() => null);
          throw new Error(json?.message || 'PDF illisible pour le moment.');
        }
        const blob = await res.blob();
        if (annule) return;
        creee = URL.createObjectURL(blob);
        setAdresse(creee);
      } catch (err) {
        if (!annule) setErreur(err instanceof Error ? err.message : 'PDF illisible pour le moment.');
      }
    })();
    return () => {
      annule = true;
      if (creee) URL.revokeObjectURL(creee);
    };
  }, [lectureId, getAuthHeaders]);

  if (erreur) return <p className={styles.erreur}>{erreur} Le texte du cours est en dessous.</p>;
  if (!adresse) return <p className={styles.chargement}>Ouverture du PDF…</p>;

  return (
    <div className={styles.cadre}>
      <a className={styles.grand} href={adresse} target="_blank" rel="noopener noreferrer">
        Ouvrir en grand ↗
      </a>
      <iframe className={styles.pdf} src={adresse} title={`PDF du cours — ${titre}`} />
    </div>
  );
}
