import { calculateSchoolYear } from '@/lib/auth-utils';

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
/**
 * ⚠️ DEUX RÈGLES D'ANNÉE SCOLAIRE COEXISTAIENT, ET ELLES SE CONTREDISAIENT.
 *
 * Celle-ci faisait commencer l'année au 1er septembre ; `calculateSchoolYear`
 * (auth-utils), qui sert aux activités, aux grilles, aux œuvres et aux
 * parcours, la fait commencer le 25 août. Résultat, une classe créée le
 * 31 août 2026 était étiquetée « 2025-2026 » pendant qu'une activité créée le
 * même jour portait « 2026-2027 » — et rien ne regroupait plus.
 *
 * Il n'y a désormais qu'une règle, celle d'`auth-utils`. Cette fonction reste
 * pour ses deux appelants, mais elle n'a plus de calcul à elle.
 * *(constaté le 2026-09-01 sur les classes de la rentrée)*
 */
export function getCurrentAnneeScolaire(): string {
  return calculateSchoolYear();
}
