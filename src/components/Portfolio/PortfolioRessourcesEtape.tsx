'use client';

// Les RESSOURCES DE L'ÉTAPE OUVERTE, en tête de l'onglet Ressources du rail :
// les mêmes volets que celles de l'activité (`RessourcesTab` ne lit que
// `ressources` et `id` du devoir), et les VALEURS attribuées au groupe que
// l'étape affiche « dans l'onglet Ressources » (« Le sketch », plan
// 2026-10-10). Rien si l'étape ne porte ni l'un ni l'autre.

import RessourcesTab from '@/components/RessourcesTab';
import type { PortfolioEleve } from '@/hooks/usePortfolioEleve';
import type { Devoir } from '@/types/devoir';
import { valeursAffichees } from '@/types/portfolio';
import PortfolioValeur from './PortfolioValeur';
import styles from './Portfolio.module.css';

interface Props {
  devoir: Devoir;
  eleve: PortfolioEleve;
}

export default function PortfolioRessourcesEtape({ devoir, eleve }: Props) {
  const etape = eleve.etape;
  if (!etape) return null;
  const valeurs = valeursAffichees(eleve.etapes, etape, eleve.contenu.suivi, 'ressources');
  if (!etape.ressources && valeurs.length === 0) return null;
  return (
    <div className={styles.ressourcesEtape}>
      <p className={styles.ressourcesEtapeTitre}>Pour l’étape « {etape.titre} »</p>
      {valeurs.map((v) => (
        <PortfolioValeur key={v.valeurId} valeur={v} devoirId={devoir.id} />
      ))}
      {etape.ressources && <RessourcesTab devoir={{ ...devoir, id: etape.id, ressources: etape.ressources }} />}
      <p className={styles.ressourcesEtapeTitre}>Pour tout le portfolio</p>
    </div>
  );
}
