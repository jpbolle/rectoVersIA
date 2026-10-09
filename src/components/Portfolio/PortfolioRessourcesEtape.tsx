'use client';

// Les RESSOURCES DE L'ÉTAPE OUVERTE, en tête de l'onglet Ressources du rail :
// les mêmes volets que celles de l'activité (`RessourcesTab` ne lit que
// `ressources` et `id` du devoir). Rien si l'étape n'en porte pas.

import RessourcesTab from '@/components/RessourcesTab';
import type { PortfolioEleve } from '@/hooks/usePortfolioEleve';
import type { Devoir } from '@/types/devoir';
import styles from './Portfolio.module.css';

interface Props {
  devoir: Devoir;
  eleve: PortfolioEleve;
}

export default function PortfolioRessourcesEtape({ devoir, eleve }: Props) {
  const etape = eleve.etape;
  if (!etape?.ressources) return null;
  return (
    <div className={styles.ressourcesEtape}>
      <p className={styles.ressourcesEtapeTitre}>Pour l’étape « {etape.titre} »</p>
      <RessourcesTab devoir={{ ...devoir, id: etape.id, ressources: etape.ressources }} />
      <p className={styles.ressourcesEtapeTitre}>Pour tout le portfolio</p>
    </div>
  );
}
