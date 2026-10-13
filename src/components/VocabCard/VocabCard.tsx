'use client';

// Carte d'une liste de vocabulaire — sur le gabarit commun RessourceCard
// (plan 2026-10-11) : plus de ✏️, la carte s'ouvre au clic (éditeur pour les
// miennes, lecture pour celles des collègues).

import type { VocabulaireThemeSummary } from '@/hooks/useVocabulaireThemes';
import RessourceCard from '@/components/RessourceCard/RessourceCard';

interface VocabCardProps {
  theme: VocabulaireThemeSummary;
  onEdit?: (theme: VocabulaireThemeSummary) => void;
  onDelete?: (theme: VocabulaireThemeSummary) => void;
  onDuplicate: (theme: VocabulaireThemeSummary) => void;
  onView?: (theme: VocabulaireThemeSummary) => void;
  /** « Utiliser pour une classe » — absent = pas de bouton */
  onUtiliser?: (theme: VocabulaireThemeSummary) => void;
  readOnly?: boolean;
}

export default function VocabCard({ theme, onEdit, onDelete, onDuplicate, onView, onUtiliser, readOnly }: VocabCardProps) {
  // Clic sur la carte : ce que faisait ✏️ (miennes) ou l'œil (collègues)
  const ouvrir = !readOnly ? onEdit : onView;

  return (
    <RessourceCard
      icone="📝"
      titre={theme.name.charAt(0).toUpperCase() + theme.name.slice(1)}
      etiquettes={[
        `${theme.wordCount} mot${theme.wordCount > 1 ? 's' : ''}`,
        // Repère sur mes propres listes : celle-ci ne sort pas de chez moi
        ...(!readOnly && theme.prive ? ['🔒 Privé'] : []),
      ]}
      sousTitre={readOnly && theme.profName ? theme.profName : undefined}
      onOuvrir={ouvrir ? () => ouvrir(theme) : undefined}
      titreOuvrir={readOnly ? 'Voir la liste' : 'Modifier la liste'}
      onVoir={readOnly && onView ? () => onView(theme) : undefined}
      onDupliquer={() => onDuplicate(theme)}
      onSupprimer={!readOnly && onDelete ? () => onDelete(theme) : undefined}
      principale={!readOnly && onUtiliser ? { libelle: 'Utiliser pour une classe', onClick: () => onUtiliser(theme) } : undefined}
      lectureSeule={readOnly}
    />
  );
}
