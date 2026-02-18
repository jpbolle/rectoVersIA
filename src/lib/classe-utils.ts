/**
 * Génère un ID unique pour une classe
 */
export function generateClasseId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `CLS-${timestamp}-${random}`;
}

/**
 * Génère un ID unique pour un élève
 */
export function generateEleveId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `ELV-${timestamp}-${random}`;
}

/**
 * Obtient l'année scolaire actuelle (format: "2024-2025")
 */
export function getCurrentAnneeScolaire(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 0-indexed

  // L'année scolaire commence en septembre
  if (month >= 9) {
    return `${year}-${year + 1}`;
  } else {
    return `${year - 1}-${year}`;
  }
}
