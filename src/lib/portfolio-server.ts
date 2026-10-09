// Portfolio côté serveur : nettoyage de ce qui vient du client (étapes,
// dépôts, contenu d'une activité) et lecture d'une matrice Firestore.
// `undefined` est interdit en base : tout champ absent s'écrit vide ou null.

import { sanitizeRessources } from '@/lib/ressources-server';
import type { DevoirRessource } from '@/types/devoir';
import {
  generateDepotId,
  generateEtapePortfolioId,
  type PortfolioContenu,
  type PortfolioDepot,
  type PortfolioEtape,
  type PortfolioMatrice,
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
    depots.push({
      id,
      libelle: texte(item.libelle, 200),
      consigne: texte(item.consigne, 2000),
      exemple: texte(item.exemple, 2000),
      obligatoire: item.obligatoire !== false,
      type: item.type === 'groupe' ? 'groupe' : 'texte',
    });
  }
  return depots;
}

export function etapesPortfolioPourFirestore(
  input: unknown,
  options: { codeAutorise?: boolean } = {}
): PortfolioEtape[] {
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
      portee: item.portee === 'collective' ? 'collective' : 'personnelle',
      verrouille: item.verrouille === true,
      ressources: item.ressources ? sanitizeRessources(item.ressources, { codeAutorise: options.codeAutorise === true }) : null,
      depots: nature === 'etape' ? depotsPourFirestore(item.depots) : [],
    });
  }
  return etapes;
}

/** Le contenu d'une ACTIVITÉ portfolio (`Devoir.portfolio`), nettoyé. */
export function portfolioContenuPourFirestore(
  input: unknown,
  options: { codeAutorise?: boolean } = {}
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
    archive: data.archive === true,
    anneeScolaire: typeof data.anneeScolaire === 'string' ? data.anneeScolaire : '',
    createdAt: iso(data.createdAt),
    updatedAt: iso(data.updatedAt),
  };
}
