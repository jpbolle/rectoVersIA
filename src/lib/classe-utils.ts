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
 * Alphabet réduit pour les codes de classe (sans 0/O, 1/I/L pour éviter la confusion)
 */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Génère un code de classe partageable au format "AB1-CD2-EF3"
 */
export function generateClasseCode(): string {
  let code = '';
  for (let i = 0; i < 9; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return `${code.slice(0, 3)}-${code.slice(3, 6)}-${code.slice(6, 9)}`;
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
