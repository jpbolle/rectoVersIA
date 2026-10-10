'use client';

// Une activité ouverte DEPUIS un portfolio (`?portfolio=…&etape=…`, posé par
// le lien « Ouvrir l'activité » d'une étape-renvoi) : en tête de l'onglet
// Ressources, les valeurs attribuées au groupe que l'étape transmet — « Le
// sketch » dans le questionnaire de compréhension (phase 3 du plan
// 2026-10-10). Ouverte autrement, l'activité ne montre rien de plus.
//
// Les paramètres sont lus dans l'adresse au montage (pas de `useSearchParams` :
// il imposerait une frontière Suspense à toute la page).

import { useEffect, useState } from 'react';
import { useAuthContext } from '@/context/AuthContext';
import type { ValeurAffichee } from '@/types/portfolio';
import PortfolioValeur from './PortfolioValeur';
import styles from './Portfolio.module.css';

interface Props {
  devoirId: string;
}

export default function PortfolioValeursActivite({ devoirId }: Props) {
  const { getAuthHeaders } = useAuthContext();
  const [portfolioId, setPortfolioId] = useState<string | null>(null);
  const [valeurs, setValeurs] = useState<ValeurAffichee[]>([]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const portfolio = q.get('portfolio');
    const etape = q.get('etape');
    if (!portfolio || !etape) return;
    let annule = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const params = new URLSearchParams({ portfolio, etape, devoirId });
        const res = await fetch(`/api/portfolio/valeurs-etape?${params}`, { headers });
        const json = await res.json();
        if (!annule && json.success) {
          setPortfolioId(portfolio);
          setValeurs(json.data as ValeurAffichee[]);
        }
      } catch {
        // Rien de plus à montrer
      }
    })();
    return () => {
      annule = true;
    };
  }, [devoirId, getAuthHeaders]);

  if (!portfolioId || valeurs.length === 0) return null;
  return (
    <div className={styles.ressourcesEtape}>
      <p className={styles.ressourcesEtapeTitre}>De ton portfolio</p>
      {valeurs.map((v) => (
        <PortfolioValeur key={v.valeurId} valeur={v} devoirId={portfolioId} />
      ))}
      <p className={styles.ressourcesEtapeTitre}>Pour cette activité</p>
    </div>
  );
}
