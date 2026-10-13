// Portfolio côté serveur : nettoyage de ce qui vient du client (étapes,
// dépôts, contenu d'une activité) et lecture d'une matrice Firestore.
// `undefined` est interdit en base : tout champ absent s'écrit vide ou null.

import { adminDb } from '@/lib/firebase/admin';
import { activitesDePortfolio } from '@/lib/devoir-utils';
import { sanitizeRessources } from '@/lib/ressources-server';
import type { DevoirRessource } from '@/types/devoir';
import {
  generateDepotId,
  generateEtapePortfolioId,
  generateValeurId,
  MAX_COLONNES_TABLEAU,
  avecIntroduction,
  cadrageBorne,
  ordonnerIntroduction,
  typesDuDepot,
  type PortfolioContenu,
  type PortfolioDepot,
  type PortfolioEtape,
  type PortfolioMatrice,
  type TypeDepot,
  type AffichageValeur,
  type GenreValeur,
  type ValeurDeclaree,
  type ValidationEtape,
} from '@/types/portfolio';

type Doc = FirebaseFirestore.DocumentSnapshot | FirebaseFirestore.QueryDocumentSnapshot;

const MAX_ETAPES = 60;
const MAX_DEPOTS = 12;
const MAX_OBJECTIFS = 10;

function texte(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function iso(v: unknown): string {
  const d = v as { toDate?: () => Date } | string | undefined;
  if (d && typeof d === 'object' && typeof d.toDate === 'function') return d.toDate().toISOString();
  return typeof d === 'string' ? d : '';
}

function depotsPourFirestore(input: unknown): PortfolioDepot[] {
  if (!Array.isArray(input)) return [];
  const depots: PortfolioDepot[] = [];
  const vus = new Set<string>();
  for (const d of input.slice(0, MAX_DEPOTS)) {
    if (!d || typeof d !== 'object') continue;
    const item = d as Record<string, unknown>;
    let id = texte(item.id, 40) || generateDepotId();
    while (vus.has(id)) id = generateDepotId();
    vus.add(id);
    const types = typesDuDepot({
      types: Array.isArray(item.types) ? (item.types as TypeDepot[]) : undefined,
      type: typeof item.type === 'string' ? (item.type as TypeDepot) : undefined,
    });
    const colonnes = Array.isArray(item.colonnes)
      ? item.colonnes.map((c) => texte(c, 80)).filter(Boolean).slice(0, MAX_COLONNES_TABLEAU)
      : [];
    depots.push({
      id,
      libelle: texte(item.libelle, 200),
      consigne: texte(item.consigne, 2000),
      exemple: texte(item.exemple, 2000),
      obligatoire: item.obligatoire !== false,
      // Ancienne forme (`type` seul) convertie ici : ce qui sort du serveur
      // porte toujours `types`.
      types,
      // Un tableau sans colonne nommée en garde une, pour qu'il s'affiche
      ...(types.includes('tableau') ? { colonnes: colonnes.length > 0 ? colonnes : ['Réponse'] } : {}),
      // Scène d'une œuvre : l'œuvre fixée par le prof (vide tant qu'il ne l'a pas choisie)
      ...(types.includes('scene') ? { oeuvreId: texte(item.oeuvreId, 60) } : {}),
    });
  }
  return depots;
}

const GENRES_VALEUR: GenreValeur[] = ['oeuvre', 'lien', 'video', 'integration'];

function validationPourFirestore(input: unknown): ValidationEtape | null {
  if (!input || typeof input !== 'object') return null;
  const v = input as Record<string, unknown>;
  const vus = new Set<string>();
  const attribue: ValeurDeclaree[] = [];
  for (const a of Array.isArray(v.attribue) ? v.attribue.slice(0, 6) : []) {
    if (!a || typeof a !== 'object') continue;
    const item = a as Record<string, unknown>;
    const nom = texte(item.nom, 80);
    if (!nom) continue;
    let id = texte(item.id, 40) || generateValeurId();
    while (vus.has(id)) id = generateValeurId();
    vus.add(id);
    const genre = GENRES_VALEUR.includes(item.genre as GenreValeur) ? (item.genre as GenreValeur) : 'lien';
    attribue.push({ id, nom, genre });
  }
  const bloquante = v.bloquante === true;
  // Rien de réglé : pas d'objet (l'étape se soumet quand même, sans bloquer)
  return bloquante || attribue.length > 0 ? { bloquante, attribue } : null;
}

function affichePourFirestore(input: unknown): AffichageValeur[] {
  if (!Array.isArray(input)) return [];
  const vus = new Set<string>();
  const affiche: AffichageValeur[] = [];
  for (const a of input.slice(0, 12)) {
    if (!a || typeof a !== 'object') continue;
    const item = a as Record<string, unknown>;
    const valeurId = texte(item.valeurId, 40);
    if (!valeurId || vus.has(valeurId)) continue;
    vus.add(valeurId);
    affiche.push({ valeurId, place: item.place === 'ressources' ? 'ressources' : 'travail' });
  }
  return affiche;
}

// `assurerIntroduction` (ÉCRITURE seulement) : crée l'introduction si elle
// manque. Jamais à la lecture — une introduction inventée à chaque lecture
// changerait d'id, et l'élève qui l'a ouverte la verrait « à faire ».
export function etapesPortfolioPourFirestore(
  input: unknown,
  options: { codeAutorise?: boolean; assurerIntroduction?: boolean } = {}
): PortfolioEtape[] {
  const etapes = lireEtapes(input, options);
  return options.assurerIntroduction ? avecIntroduction(etapes) : ordonnerIntroduction(etapes);
}

function lireEtapes(input: unknown, options: { codeAutorise?: boolean }): PortfolioEtape[] {
  if (!Array.isArray(input)) return [];
  const etapes: PortfolioEtape[] = [];
  const vus = new Set<string>();
  for (const e of input.slice(0, MAX_ETAPES)) {
    if (!e || typeof e !== 'object') continue;
    const item = e as Record<string, unknown>;
    const nature = item.nature === 'activite' ? 'activite' : 'etape';
    const devoirId = texte(item.devoirId, 60);
    if (nature === 'activite' && !devoirId) continue;
    let id = texte(item.id, 40) || generateEtapePortfolioId();
    while (vus.has(id)) id = generateEtapePortfolioId();
    vus.add(id);
    const ia = item.ia === 'libre' || item.ia === 'partielle' || item.ia === 'aucune' ? item.ia : null;
    const echeance = texte(item.echeance, 10);
    etapes.push({
      id,
      nature,
      devoirId,
      atelier: texte(item.atelier, 60),
      typeTravail: texte(item.typeTravail, 40),
      section: texte(item.section, 120),
      titre: texte(item.titre, 200),
      objectifs: Array.isArray(item.objectifs)
        ? item.objectifs.map((o) => texte(o, 300)).filter(Boolean).slice(0, MAX_OBJECTIFS)
        : [],
      consigne: typeof item.consigne === 'string' ? item.consigne.slice(0, 5000) : '',
      echeance: /^\d{4}-\d{2}-\d{2}$/.test(echeance) ? echeance : null,
      ia,
      // Seulement pour « Aide de l'IA »
      iaPrecision: ia === 'partielle' ? texte(item.iaPrecision, 500) : '',
      portee: item.portee === 'collective' ? 'collective' : 'personnelle',
      verrouille: item.verrouille === true,
      ressources: item.ressources ? sanitizeRessources(item.ressources, { codeAutorise: options.codeAutorise === true }) : null,
      depots: nature === 'etape' ? depotsPourFirestore(item.depots) : [],
      validation: validationPourFirestore(item.validation),
      affiche: affichePourFirestore(item.affiche),
      introduction: item.introduction === true,
      couverture: item.introduction === true && /^[A-Za-z0-9_-]{1,60}$/.test(texte(item.couverture, 60)) ? texte(item.couverture, 60) : null,
      couvertureCadrage: item.introduction === true && item.couvertureCadrage ? cadrageBorne(item.couvertureCadrage) : null,
    });
  }
  return etapes;
}

/** Le contenu d'une ACTIVITÉ portfolio (`Devoir.portfolio`), nettoyé. */
export function portfolioContenuPourFirestore(
  input: unknown,
  options: { codeAutorise?: boolean; assurerIntroduction?: boolean } = {}
): PortfolioContenu {
  const raw = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  return {
    portfolioId: texte(raw.portfolioId, 60) || null,
    tacheFinale: texte(raw.tacheFinale, 2000),
    etapes: etapesPortfolioPourFirestore(raw.etapes, options),
  };
}

/** Lecture tolérante d'un document d'activité (champ absent = portfolio vide). */
export function lirePortfolioContenu(data: unknown): PortfolioContenu {
  return portfolioContenuPourFirestore(data ?? {});
}

export function docToPortfolioMatrice(doc: Doc): PortfolioMatrice {
  const data = doc.data() ?? {};
  return {
    id: doc.id,
    titre: typeof data.titre === 'string' ? data.titre : '',
    description: typeof data.description === 'string' ? data.description : '',
    tacheFinale: typeof data.tacheFinale === 'string' ? data.tacheFinale : '',
    consignes: typeof data.consignes === 'string' ? data.consignes : '',
    ressources: data.ressources && typeof data.ressources === 'object' ? (data.ressources as DevoirRessource) : null,
    etapes: etapesPortfolioPourFirestore(data.etapes, { codeAutorise: true }),
    profId: typeof data.profId === 'string' ? data.profId : '',
    prive: data.prive === true,
    archive: data.archive === true,
    anneeScolaire: typeof data.anneeScolaire === 'string' ? data.anneeScolaire : '',
    createdAt: iso(data.createdAt),
    updatedAt: iso(data.updatedAt),
  };
}

/**
 * Les activités INTÉGRÉES à un portfolio — donné (activité de type portfolio)
 * ou matrice de Mes Ressources : la même règle que le tableau de bord du prof.
 * Une telle activité n'a plus de vie autonome (JP, 2026-10-11) : l'accueil du
 * prof n'en montre ni l'échéance ni les retards, même si elle garde des
 * classes, une échéance ou des sessions d'avant son intégration — rien n'est
 * effacé en base.
 */
export async function activitesIntegreesAUnPortfolio(): Promise<Set<string>> {
  const [portfoliosDonnes, matrices] = await Promise.all([
    adminDb.collection('devoirs').where('typeTravail', '==', 'portfolio').get(),
    adminDb.collection('portfolios').get(),
  ]);
  const etapesDe = (raw: unknown) =>
    (Array.isArray(raw) ? raw : []) as { nature: string; devoirId?: string }[];
  return activitesDePortfolio([
    ...portfoliosDonnes.docs.map((d) => ({
      typeTravail: 'portfolio',
      portfolio: { etapes: etapesDe(d.data().portfolio?.etapes) },
    })),
    ...matrices.docs.map((d) => ({ typeTravail: 'portfolio', portfolio: { etapes: etapesDe(d.data().etapes) } })),
  ]);
}

/**
 * Le portfolio (donné, non archivé) qui contient cette activité dans une de ses
 * étapes — côté prof, pour que la copie et la liste des copies d'une activité
 * de portfolio ramènent au portfolio (JP, 2026-10-11). `null` : activité autonome.
 */
export async function portfolioParent(devoirId: string): Promise<{ id: string; intitule: string } | null> {
  const snap = await adminDb.collection('devoirs').where('typeTravail', '==', 'portfolio').get();
  for (const d of snap.docs) {
    const data = d.data();
    if (data.archive === true) continue;
    if (lirePortfolioContenu(data.portfolio).etapes.some((e) => e.nature === 'activite' && e.devoirId === devoirId)) {
      return { id: String(data.id || d.id), intitule: String(data.intitule || 'Portfolio') };
    }
  }
  return null;
}

/**
 * Parmi ces activités, celles qui n'ont RIEN à faire : une lecture sans
 * questionnaire (ni de la bibliothèque, ni sur mesure) et sans œuvre. Leur
 * étape de portfolio compte comme faite (JP, 2026-10-11 : « je ne veux pas que
 * l'élève soit bloqué à cause d'un manque de professionnalisme du prof »).
 */
export function activiteVide(data: FirebaseFirestore.DocumentData | undefined): boolean {
  if (!data || data.typeTravail !== 'lire') return false;
  if (data.oeuvreId) return false;
  if (typeof data.lectureQuizId === 'string' && data.lectureQuizId) return false;
  const questions = (data.lectureQuiz as { questions?: unknown[] } | null | undefined)?.questions;
  return !(Array.isArray(questions) && questions.length > 0);
}

export async function activitesVides(devoirIds: string[]): Promise<Set<string>> {
  const ids = [...new Set(devoirIds.filter(Boolean))];
  if (ids.length === 0) return new Set();
  const docs = await adminDb.getAll(...ids.map((d) => adminDb.collection('devoirs').doc(d)));
  return new Set(docs.filter((d) => d.exists && activiteVide(d.data())).map((d) => d.id));
}
