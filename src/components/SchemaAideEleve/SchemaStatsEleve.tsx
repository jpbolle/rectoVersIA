'use client';

// Onglet Évaluation de l'élève (atelier de conceptualisation) : les
// statistiques de la correction de son professeur — ce qu'il a CONFIRMÉ — quand
// la copie lui est renvoyée pour réécriture (JP, 2026-10-11). Le serveur décide
// (`?stats=1`) : rien n'est envoyé dans les autres cas.

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { Compteur } from '@/lib/schema-comparaison';
import styles from './SchemaAideEleve.module.css';

export default function SchemaStatsEleve({ travailId, cle }: { travailId: string; cle?: string }) {
  const { getAuthHeaders } = useAuth();
  const [stats, setStats] = useState<Compteur[] | null>(null);

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const res = await fetch(`/api/ai/schema-comparaison?travailId=${encodeURIComponent(travailId)}&stats=1`, { headers });
        const json = await res.json();
        if (!annule) setStats(json.success ? (json.data as Compteur[] | null) : null);
      } catch {
        if (!annule) setStats(null);
      }
    })();
    return () => {
      annule = true;
    };
    // `cle` : relire quand l'état de la correction change
  }, [travailId, cle, getAuthHeaders]);

  if (!stats) return null;
  return (
    <div className={styles.stats}>
      <p className={styles.sousTitre}>La correction de ton professeur</p>
      <div className={styles.compteurs}>
        {stats.map((c) => (
          <div key={c.libelle} className={`${styles.compteur} ${c.ton === 'bon' ? styles.compteurBon : styles.compteurMauvais}`}>
            <span className={styles.compteurValeur}>{c.valeur}</span>
            <span className={styles.compteurLibelle}>{c.libelle}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
