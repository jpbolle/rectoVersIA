/**
 * Module de chiffrement applicatif — SERVEUR UNIQUEMENT
 * Ne jamais importer ce module côté client (composants React, hooks).
 * Utilise AES-256-GCM avec un IV aléatoire par chiffrement.
 *
 * Périmètre Recto-versIA (décision 2026-08-10) : pseudonymisation — on chiffre les
 * champs d'IDENTITÉ des élèves (nom, prénom, email), pas les contenus (productions,
 * audio). Les requêtes Firestore qui filtraient sur l'email passent par une empreinte
 * HMAC-SHA256 (hashEmail) stockée à côté du champ chiffré.
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY manquante ou invalide (doit être 64 caractères hex = 32 bytes)"
    );
  }
  return Buffer.from(key, "hex");
}

/**
 * Chiffre une chaîne de caractères.
 * @returns Format "iv:tag:données" encodé en hex. Retourne "" si plaintext est vide/null.
 */
export function encrypt(plaintext: string | null | undefined): string {
  if (!plaintext) return "";
  const key = getKey();
  const iv = crypto.randomBytes(12); // 96 bits recommandé pour GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag(); // 128 bits, garantit l'intégrité
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Déchiffre une chaîne chiffrée par encrypt().
 * @returns La valeur originale, ou la valeur telle quelle si non chiffrée
 * (données non encore migrées).
 */
export function decrypt(ciphertext: string | null | undefined): string {
  if (!ciphertext) return "";
  if (!isEncrypted(ciphertext)) return ciphertext;
  const key = getKey();
  const parts = ciphertext.split(":");
  if (parts.length !== 3) return ciphertext;
  const [ivHex, tagHex, dataHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/**
 * Détecte si une valeur est déjà chiffrée (format iv:tag:données).
 */
export function isEncrypted(value: string): boolean {
  const parts = value.split(":");
  // iv = 24 hex, tag = 32 hex, données = variable
  return parts.length === 3 && parts[0].length === 24 && parts[1].length === 32;
}

/**
 * Empreinte HMAC-SHA256 d'un email, pour les requêtes Firestore d'identification
 * (where("emailHash", "==", hashEmail(email))). À sens unique : sans la clé,
 * impossible de retrouver l'email, même par dictionnaire.
 * L'email est normalisé (minuscules, trim) pour que l'empreinte soit stable.
 */
export function hashEmail(email: string | null | undefined): string {
  if (!email) return "";
  return crypto
    .createHmac("sha256", getKey())
    .update(email.trim().toLowerCase())
    .digest("hex");
}

/**
 * Chiffre un sous-ensemble de champs d'un objet.
 * Les champs absents ou vides sont ignorés.
 */
export function encryptFields<T extends Record<string, unknown>>(
  obj: T,
  fields: readonly string[]
): T {
  const result = { ...obj };
  for (const field of fields) {
    const value = (result as Record<string, unknown>)[field];
    if (typeof value === "string" && value.length > 0) {
      (result as Record<string, unknown>)[field] = encrypt(value);
    }
  }
  return result;
}

/**
 * Déchiffre un sous-ensemble de champs d'un objet.
 * Les champs absents ou vides sont ignorés.
 */
export function decryptFields<T extends Record<string, unknown>>(
  obj: T,
  fields: readonly string[]
): T {
  const result = { ...obj };
  for (const field of fields) {
    const value = (result as Record<string, unknown>)[field];
    if (typeof value === "string" && value.length > 0) {
      (result as Record<string, unknown>)[field] = decrypt(value);
    }
  }
  return result;
}

/**
 * Champs d'identité chiffrés, par collection.
 * Toute modification ici doit être accompagnée d'une migration des données existantes
 * (scripts/encrypt-existing-identities.ts).
 *
 * RÈGLE : ne jamais chiffrer un champ utilisé dans un where() Firestore.
 * L'email chiffré est doublé d'un champ d'empreinte (emailHash / studentEmailHash)
 * qui porte les requêtes d'identification.
 */
export const SENSITIVE_ELEVE_FIELDS = ["nom", "prenom", "email"] as const;
export const SENSITIVE_TRAVAIL_FIELDS = ["studentName", "studentEmail"] as const;
export const SENSITIVE_USER_FIELDS = ["email", "displayName"] as const;
export const SENSITIVE_VOCAB_PERSONNEL_FIELDS = ["studentEmail"] as const;
// NavigKid : depuis 2026-08-10 l'extension passe par les routes serveur
// (/api/navigkid/reponse et /recherches), qui chiffrent ces champs.
export const SENSITIVE_NAVIGKID_REPONSE_FIELDS = ["eleveNom", "eleveEmail"] as const;
export const SENSITIVE_NAVIGKID_RECHERCHE_FIELDS = ["eleveNom"] as const;
