'use client';

// Carte d'un point de théorie FLE — sur le gabarit commun RessourceCard (plan
// 2026-10-11) : plus de ✏️, la carte s'ouvre au clic (éditeur pour les miens,
// lecture sinon). L'archivage a son icône d'archive : la 🗑️ faisait croire à
// une suppression.

import { compterRessources, iconeTypeModule, introductionVide } from '@/types/module-fle';
import type { ModuleFle } from '@/types/module-fle';
import { useDidactiqueFle } from '@/hooks/useDidactiqueFle';
import { competenceLabel, niveauLabel, typeModuleLabel } from '@/types/didactique-fle';
import RessourceCard from '@/components/RessourceCard/RessourceCard';

interface Props {
  module: ModuleFle;
  mienne: boolean;
  isAdmin?: boolean;
  onEditer?: (m: ModuleFle) => void;
  onVoir?: (m: ModuleFle) => void;
  onDupliquer: (m: ModuleFle) => void;
  onArchiver?: (m: ModuleFle) => void;
  onTogglePartage?: (m: ModuleFle) => void;
}

export default function ModuleFleCard({
  module,
  mienne,
  isAdmin,
  onEditer,
  onVoir,
  onDupliquer,
  onArchiver,
  onTogglePartage,
}: Props) {
  const { config } = useDidactiqueFle();
  const editable = mienne && !module.archive;
  const nbRessources = compterRessources(module.ressources);

  const etiquettes = [
    ...(module.archive ? ['Archivé'] : []),
    ...(module.niveau ? [niveauLabel(config, module.niveau)] : []),
    ...module.competences.slice(0, 2).map((c) => competenceLabel(config, c)),
    ...(module.competences.length > 2
      ? [
          <span key="plus" title={module.competences.map((c) => competenceLabel(config, c)).join(', ')}>
            +{module.competences.length - 2}
          </span>,
        ]
      : []),
    introductionVide(module.introduction) ? 'sans introduction' : 'introduction',
    `${nbRessources} ressource${nbRessources > 1 ? 's' : ''}`,
  ];

  const sousTitre = [
    module.type ? typeModuleLabel(config, module.type) : null,
    !mienne && module.profName ? `de ${module.profName}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  // Clic : ce que faisait ✏️ (point éditable) ou l'œil (sinon)
  const ouvrir = editable && onEditer ? () => onEditer(module) : onVoir ? () => onVoir(module) : undefined;

  return (
    <RessourceCard
      icone={iconeTypeModule(module.type)}
      titre={module.titre}
      etiquettes={etiquettes}
      sousTitre={sousTitre || undefined}
      description={module.description}
      archivee={module.archive}
      onOuvrir={ouvrir}
      titreOuvrir={editable ? 'Modifier' : 'Voir'}
      onVoir={!editable && onVoir ? () => onVoir(module) : undefined}
      onPartager={mienne && isAdmin && onTogglePartage ? () => onTogglePartage(module) : undefined}
      partagee={module.shared}
      titrePartager={module.shared ? 'Retirer des exemples partagés' : 'Proposer comme exemple à tous'}
      onDupliquer={() => onDupliquer(module)}
      onArchiver={editable && onArchiver ? () => onArchiver(module) : undefined}
      // Point de théorie d'un collègue : Voir + « Dupliquer »
      lectureSeule={!mienne}
    />
  );
}
