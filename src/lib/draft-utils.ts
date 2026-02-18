import type { Grille } from '@/types/grille';
import type { DraftType, DraftContent, PlanItem, CrcPoint, CrcArgument } from '@/types/travail';

/**
 * Determine le type de brouillon en fonction de la grille de correction.
 *
 * - CRC (Compte Rendu Critique) → 2 colonnes : points positifs / negatifs
 * - Contraction / Resume → plan hierarchique d'idees
 * - Autre → brouillon libre (notes)
 */
export function getDraftType(grille: Grille | null): DraftType {
  if (!grille) return 'brouillon';

  const name = grille.name.toLowerCase();

  // Detection CRC
  if (
    name.includes('crc') ||
    name.includes('compte rendu critique') ||
    name.includes('compte-rendu critique')
  ) {
    return 'crc';
  }

  // Detection contraction / resume
  if (
    name.includes('contraction') ||
    name.includes('résumé') ||
    name.includes('resume') ||
    name.includes('synthèse') ||
    name.includes('synthese')
  ) {
    return 'plan';
  }

  // Detection par UAA
  if (grille.uaa?.includes(2)) {
    // UAA 2 = Reduire, resumer, comparer et synthetiser
    return 'plan';
  }

  return 'brouillon';
}

/**
 * Cree un brouillon vide du type donne.
 */
export function createEmptyDraft(type: DraftType): DraftContent {
  switch (type) {
    case 'crc':
      return { type: 'crc', positifs: [createCrcPoint()], negatifs: [createCrcPoint()], crcPlan: [] };
    case 'plan':
      return {
        type: 'plan',
        plan: [createPlanItem()],
      };
    case 'brouillon':
    default:
      return { type: 'brouillon', notes: '' };
  }
}

/**
 * Cree un CrcPoint vide.
 */
export function createCrcPoint(): CrcPoint {
  return {
    id: `crc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    text: '',
    arguments: [{ explication: '', illustration: '' }],
  };
}

export function createCrcArgument(): CrcArgument {
  return { explication: '', illustration: '' };
}

/**
 * Genere un identifiant unique pour un PlanItem.
 */
export function generatePlanItemId(): string {
  return `plan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Cree un PlanItem vide.
 */
export function createPlanItem(): PlanItem {
  return {
    id: generatePlanItemId(),
    text: '',
    children: [],
  };
}

/**
 * Retourne le label utilisateur pour le type de brouillon.
 */
export function getDraftLabel(type: DraftType): string {
  switch (type) {
    case 'crc':
      return 'Points positifs / négatifs';
    case 'plan':
      return 'Plan du texte';
    case 'brouillon':
    default:
      return 'Brouillon';
  }
}

/**
 * Retourne l'icone pour le type de brouillon.
 */
export function getDraftIcon(type: DraftType): string {
  switch (type) {
    case 'crc':
      return '⚖️';
    case 'plan':
      return '🗂️';
    case 'brouillon':
    default:
      return '📝';
  }
}
