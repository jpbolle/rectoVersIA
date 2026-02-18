/**
 * Genere un ID unique pour un travail
 * Format: TRV-{devoirId}-{studentId}
 */
export function generateTravailId(devoirId: string, studentId: string): string {
  return `TRV-${devoirId}-${studentId}`;
}

/**
 * Extrait l'ID du devoir depuis un ID de travail
 */
export function extractDevoirIdFromTravailId(travailId: string): string | null {
  const parts = travailId.split('-');
  if (parts.length >= 3 && parts[0] === 'TRV') {
    return parts[1];
  }
  return null;
}

/**
 * Extrait l'ID de l'etudiant depuis un ID de travail
 */
export function extractStudentIdFromTravailId(travailId: string): string | null {
  const parts = travailId.split('-');
  if (parts.length >= 3 && parts[0] === 'TRV') {
    return parts.slice(2).join('-');
  }
  return null;
}
