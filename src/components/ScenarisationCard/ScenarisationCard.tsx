'use client';

// La carte d'un parcours (une scénarisation = un cours), sur le gabarit commun
// RessourceCard (plan 2026-10-11). Le ✏️ a disparu : il ouvrait le parcours,
// exactement comme le clic sur la carte (le nom se change ensuite sur place,
// dans le bandeau du parcours).
//
// Ce qu'elle annonce est ce qui distingue un parcours d'un autre : les classes
// qui le suivent, son volume, et le nombre de certifications qu'il porte.

import {
  certificationsDe,
  capacitePeriode,
  periodesPlanifiees,
  PERIODES_ANNEE,
} from '@/types/scenarisation';
import type { Scenarisation } from '@/types/scenarisation';
import RessourceCard from '@/components/RessourceCard/RessourceCard';

interface Props {
  scenarisation: Scenarisation;
  onOpen: (scen: Scenarisation) => void;
  onDuplicate: (scen: Scenarisation) => void;
  onDelete: (scen: Scenarisation) => void;
}

export default function ScenarisationCard({
  scenarisation,
  onOpen,
  onDuplicate,
  onDelete,
}: Props) {
  const modules = scenarisation.chapitres.reduce((s, c) => s + c.modules.length, 0);
  const certifs = certificationsDe(scenarisation).length;
  const planifie = PERIODES_ANNEE.reduce((s, p) => s + periodesPlanifiees(scenarisation, p.id), 0);
  const capacite = PERIODES_ANNEE.reduce((s, p) => s + capacitePeriode(scenarisation, p.id), 0);
  const classes = scenarisation.classes ?? [];
  const nbChapitres = scenarisation.chapitres.length;

  return (
    <RessourceCard
      icone="🧭"
      titre={scenarisation.nom}
      // Les classes : le repère qui distingue deux parcours au même nom
      etiquettes={classes}
      // « Français — 4e générale » revient chaque année : c'est l'année qui
      // distingue deux cartes de même nom
      sousTitre={scenarisation.anneeScolaire}
      description={[
        `${nbChapitres} chapitre${nbChapitres > 1 ? 's' : ''}`,
        `${modules} module${modules > 1 ? 's' : ''}`,
        `⏱ ${planifie}/${capacite} pér.`,
        `⭐ ${certifs} certification${certifs > 1 ? 's' : ''}`,
      ].join(' · ')}
      onOuvrir={() => onOpen(scenarisation)}
      titreOuvrir="Ouvrir ce parcours"
      onDupliquer={() => onDuplicate(scenarisation)}
      onSupprimer={() => onDelete(scenarisation)}
    />
  );
}
