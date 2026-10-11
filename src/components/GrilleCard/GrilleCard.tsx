'use client';

// Carte d'une grille d'évaluation — sur le gabarit commun RessourceCard
// (plan 2026-10-11) : plus de ✏️, la carte s'ouvre au clic (constructeur pour
// les miennes, lecture pour celles des collègues).

import type { Grille } from '@/types/grille';
import RessourceCard from '@/components/RessourceCard/RessourceCard';

interface GrilleCardProps {
  grille: Grille;
  onEdit?: (grille: Grille) => void;
  onDelete?: (grille: Grille) => void;
  onDuplicate: (grille: Grille) => void;
  onToggleShared?: (grille: Grille) => void;
  onView?: (grille: Grille) => void;
  /** « Utiliser pour une classe » — absent = pas de bouton */
  onUtiliser?: (grille: Grille) => void;
  readOnly?: boolean;
  isAdmin?: boolean;
}

export default function GrilleCard({
  grille,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleShared,
  onView,
  onUtiliser,
  readOnly,
  isAdmin,
}: GrilleCardProps) {
  const totalWeight = grille.criteria.reduce((sum, c) => sum + c.weight, 0);
  const nbCriteres = grille.criteria.length;

  // Clic sur la carte : ce que faisait ✏️ (miennes) ou l'œil (collègues)
  const ouvrir = !readOnly ? onEdit : onView;

  const etiquettes = [
    ...(grille.uaa ?? []).map((id) => `UAA ${id}`),
    `${nbCriteres} critère${nbCriteres > 1 ? 's' : ''}`,
    `${totalWeight} pts`,
  ];

  return (
    <RessourceCard
      icone="📋"
      titre={grille.name}
      etiquettes={etiquettes}
      sousTitre={readOnly && grille.profName ? grille.profName : undefined}
      description={grille.description}
      onOuvrir={ouvrir ? () => ouvrir(grille) : undefined}
      titreOuvrir={readOnly ? 'Voir la grille' : 'Modifier la grille'}
      onVoir={readOnly && onView ? () => onView(grille) : undefined}
      onPartager={!readOnly && isAdmin && onToggleShared ? () => onToggleShared(grille) : undefined}
      partagee={grille.shared}
      titrePartager={grille.shared ? 'Retirer des exemples' : 'Partager comme exemple'}
      onDupliquer={() => onDuplicate(grille)}
      onSupprimer={!readOnly && onDelete ? () => onDelete(grille) : undefined}
      principale={!readOnly && onUtiliser ? { libelle: 'Utiliser pour une classe', onClick: () => onUtiliser(grille) } : undefined}
      lectureSeule={readOnly}
    />
  );
}
