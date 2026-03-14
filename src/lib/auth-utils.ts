const PROF_EMAIL = 'jeanphilippe.bolle@cnddinant.be';
const ADMIN_EMAIL = PROF_EMAIL;
const AUTHORIZED_DOMAIN = 'cnddinant.be';

export function getUserRole(email: string): 'prof' | 'eleve' | null {
  const emailLower = email.toLowerCase().trim();
  if (emailLower === PROF_EMAIL) return 'prof';
  // Tout utilisateur connecté peut entrer comme élève
  return 'eleve';
}

export function isAuthorizedDomain(email: string): boolean {
  return email.toLowerCase().trim().endsWith(`@${AUTHORIZED_DOMAIN}`);
}

export function isAdmin(email: string): boolean {
  return email.toLowerCase().trim() === ADMIN_EMAIL;
}

export function calculateSchoolYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  let startYear: number;

  if (month >= 8 && (month > 8 || day >= 25)) {
    // Apres le 25 aout : annee scolaire commence cette annee
    startYear = year;
  } else if (month <= 7 && (month < 7 || day <= 5)) {
    // Avant le 5 juillet : annee scolaire a commence l'annee precedente
    startYear = year - 1;
  } else {
    // 6 juillet - 24 aout : periode de transition (nouvelle annee scolaire)
    startYear = year;
  }

  return `${startYear}-${startYear + 1}`;
}
