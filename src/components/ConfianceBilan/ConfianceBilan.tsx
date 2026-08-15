'use client';

// Adaptateur : traduit un bilan de DEGRÉ D'ASSURANCE (lecture, recherche) dans
// la présentation partagée des bilans de lucidité. Il ne porte que le
// vocabulaire propre à ce dispositif — smileys annoncés, tranche obtenue.

import { echelonConfiance } from '@/types/confiance';
import { phraseLucidite } from '@/lib/confiance-scoring';
import type { BilanConfiance } from '@/lib/confiance-scoring';
import LuciditeBilan from '@/components/LuciditeBilan';

interface Props {
  bilan: BilanConfiance;
  isProfessorView?: boolean;
}

export default function ConfianceBilan({ bilan, isProfessorView }: Props) {
  return (
    <LuciditeBilan
      titre="Ce que tu pensais de tes réponses"
      tendance={bilan.tendance}
      comparees={bilan.comparees}
      justes={bilan.justes}
      sousEstimations={bilan.sousEstimations}
      surestimations={bilan.surestimations}
      unite="question"
      phrase={phraseLucidite(bilan)}
      // Seuls les décalages nets : un cran d'écart est une nuance
      lignes={bilan.ecarts
        .filter((e) => e.net)
        .map((e) => ({
          id: e.questionId,
          label: e.enonce,
          gauche: echelonConfiance(e.annonce).emoji,
          droite: `${e.percent} %`,
        }))}
      note={
        bilan.sansSmiley > 0
          ? `${bilan.sansSmiley} question${bilan.sansSmiley > 1 ? 's' : ''} notée${
              bilan.sansSmiley > 1 ? 's' : ''
            } sans smiley — hors de cette comparaison.`
          : undefined
      }
      isProfessorView={isProfessorView}
    />
  );
}
