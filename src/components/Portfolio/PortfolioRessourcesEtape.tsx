'use client';

// Les RESSOURCES DU PORTFOLIO dans l'onglet Ressources du rail, APRÈS celles
// de l'activité (JP, 2026-10-11 : d'abord ce qui vaut pour tout le portfolio,
// puis ce qui est lié à la section) :
//  1. « Pour tout le portfolio » : les ressources de l'INTRODUCTION — elle
//     porte les informations générales, ses ressources valent pour tout le
//     portfolio et restent visibles quelle que soit l'étape ouverte. L'intitulé
//     n'est répété que si l'activité n'en a pas déjà posé un (ses propres
//     ressources, au-dessus, portent déjà « Pour tout le portfolio ») ;
//  2. « Pour l'étape … » : les ressources de l'étape ouverte (hors
//     introduction) et les VALEURS attribuées au groupe que l'étape affiche
//     « dans l'onglet Ressources » (« Le sketch », plan 2026-10-10).
// Mêmes volets que celles de l'activité (`RessourcesTab` ne lit que
// `ressources` et `id` du devoir).

import RessourcesTab from '@/components/RessourcesTab';
import type { PortfolioEleve } from '@/hooks/usePortfolioEleve';
import { ressourcesPresentes } from '@/lib/ressources-presentes';
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
  const intro = eleve.etapes.find((e) => e.introduction) ?? null;
  const ressourcesIntro = intro && ressourcesPresentes(intro.ressources) ? intro.ressources! : null;
  const valeurs = etape ? valeursAffichees(eleve.etapes, etape, eleve.contenu.suivi, 'ressources') : [];
  const ressourcesEtape = etape && !etape.introduction && ressourcesPresentes(etape.ressources) ? etape.ressources! : null;
  const titreDejaPose = ressourcesPresentes(devoir.ressources);

  if (!ressourcesIntro && !ressourcesEtape && valeurs.length === 0) return null;
  return (
    <>
      {ressourcesIntro && (
        <div className={styles.ressourcesGenerales}>
          {!titreDejaPose && <p className={styles.ressourcesEtapeTitre}>Pour tout le portfolio</p>}
          <RessourcesTab devoir={{ ...devoir, id: intro!.id, ressources: ressourcesIntro }} />
        </div>
      )}
      {etape && (ressourcesEtape || valeurs.length > 0) && (
        <div className={styles.ressourcesEtape}>
          <p className={styles.ressourcesEtapeTitre}>Pour l’étape « {etape.titre} »</p>
          {valeurs.map((v) => (
            <PortfolioValeur key={v.valeurId} valeur={v} devoirId={devoir.id} />
          ))}
          {ressourcesEtape && <RessourcesTab devoir={{ ...devoir, id: etape.id, ressources: ressourcesEtape }} />}
        </div>
      )}
    </>
  );
}
