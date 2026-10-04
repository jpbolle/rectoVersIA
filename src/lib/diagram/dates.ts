/**
 * Dates de la ligne du temps. On accepte ce qu'un élève tape : « 1815 », « 1815-06 »,
 * « 1815-06-18 », « 18/06/1815 », « -52 » (av. J.-C.), « 52 av. J.-C. ».
 * Une date devient un nombre d'années fractionnaire (`1815.46`) pour se placer sur l'axe.
 */

export type DatePrecision = 'year' | 'month' | 'day';

export interface ParsedDate {
  year: number; // négatif = avant J.-C. (pas d'année 0 : -1 = 1 av. J.-C.)
  month?: number; // 1–12
  day?: number; // 1–31
  precision: DatePrecision;
}

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export function parseDate(input: string | undefined): ParsedDate | null {
  if (!input) return null;
  let text = input.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!text) return null;
  let bc = false;
  if (/(av\.?\s*j\.?-?c\.?|avant j)/.test(text)) {
    bc = true;
    text = text.replace(/\s*(av\.?\s*j\.?-?c\.?|avant j[^ ]*)\s*/g, '').trim();
  }
  // 18/06/1815 ou 06/1815
  let m = text.match(/^(\d{1,2})\/(\d{1,2})\/(-?\d{1,4})$/);
  if (m) return build(Number(m[3]), Number(m[2]), Number(m[1]), bc);
  m = text.match(/^(\d{1,2})\/(-?\d{1,4})$/);
  if (m) return build(Number(m[2]), Number(m[1]), undefined, bc);
  // -52, 1815, 1815-06, 1815-06-18
  m = text.match(/^(-?\d{1,4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/);
  if (m) return build(Number(m[1]), m[2] ? Number(m[2]) : undefined, m[3] ? Number(m[3]) : undefined, bc);
  return null;
}

function build(year: number, month: number | undefined, day: number | undefined, bc: boolean): ParsedDate | null {
  if (!Number.isFinite(year)) return null;
  if (bc) year = -Math.abs(year);
  if (month !== undefined && (month < 1 || month > 12)) return null;
  if (day !== undefined && (day < 1 || day > 31)) return null;
  if (day !== undefined && month === undefined) return null;
  const precision: DatePrecision = day !== undefined ? 'day' : month !== undefined ? 'month' : 'year';
  const d: ParsedDate = { year, precision };
  if (month !== undefined) d.month = month;
  if (day !== undefined) d.day = day;
  return d;
}

/** Position sur l'axe : années fractionnaires (une année seule = son début). */
export function toYears(d: ParsedDate): number {
  const month = d.month ?? 1;
  const day = d.day ?? 1;
  return d.year + (month - 1) / 12 + (day - 1) / 372;
}

/** Forme canonique pour le Markdown et le stockage : `1815`, `1815-06`, `1815-06-18`, `-52`. */
export function toIso(d: ParsedDate): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  let s = String(d.year);
  if (d.month !== undefined) s += `-${pad(d.month)}`;
  if (d.day !== undefined) s += `-${pad(d.day)}`;
  return s;
}

/** Affichage en français : « 18 juin 1815 », « juin 1815 », « 1815 », « 52 av. J.-C. ». */
export function formatDate(d: ParsedDate): string {
  const year = d.year < 0 ? `${-d.year} av. J.-C.` : String(d.year);
  if (d.precision === 'day') return `${d.day === 1 ? '1er' : d.day} ${MONTHS[(d.month ?? 1) - 1]} ${year}`;
  if (d.precision === 'month') return `${MONTHS[(d.month ?? 1) - 1]} ${year}`;
  return year;
}

/** Affichage d'une année de graduation (entière ou fractionnaire pour les mois). */
export function formatTick(years: number, step: number): string {
  if (step >= 1) {
    const y = Math.round(years);
    return y < 0 ? `${-y} av. J.-C.` : String(y);
  }
  const year = Math.floor(years);
  const month = Math.round((years - year) * 12);
  const label = MONTHS[Math.min(11, Math.max(0, month))];
  return month === 0 ? String(year) : label.slice(0, 4) + (label.length > 4 ? '.' : '') + ' ' + year;
}

export function normalizeDateText(input: string | undefined): string | undefined {
  const d = parseDate(input);
  return d ? toIso(d) : undefined;
}
