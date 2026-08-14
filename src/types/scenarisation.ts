// Scénarisation didactique — la colonne vertébrale d'un cours.
//
//   Parcours (= une scénarisation, un cours) > Chapitres > Modules > Activités
//
// Une activité de module n'est PAS forcément une activité Recto-versIA : un
// débat, une lecture à voix haute comptent dans le module sans passer par
// l'app. Quand elle en est une, `devoirId` fait la passerelle vers Mes
// Activités — dans les deux sens (le devoir porte `moduleRef` en retour).
//
// Tout tient dans UN document Firestore par scénarisation (chapitres et
// modules imbriqués) : l'écran les édite ensemble, et une année de cours pèse
// quelques dizaines de kilo-octets — très loin de la limite d'1 Mo.

// Les cinq périodes de l'année scolaire (FWB)
export const PERIODES_ANNEE = [
  { id: 'sept-oct', label: 'Sept — Oct', semainesDefaut: 9 },
  { id: 'nov-dec', label: 'Nov — Déc', semainesDefaut: 8 },
  { id: 'janv-fev', label: 'Janv — Fév', semainesDefaut: 8 },
  { id: 'mars-avril', label: 'Mars — Avril', semainesDefaut: 7 },
  { id: 'mai-juin', label: 'Mai — Juin', semainesDefaut: 6 },
] as const;

export type PeriodeAnnee = (typeof PERIODES_ANNEE)[number]['id'];

export const PERIODE_IDS: string[] = PERIODES_ANNEE.map((p) => p.id);

export function periodeLabel(id: string): string {
  return PERIODES_ANNEE.find((p) => p.id === id)?.label ?? id;
}

// Objectifs particuliers d'un module, en trois registres
export interface ObjectifsModule {
  concepts: string;   // concepts et connaissances
  habiletes: string;  // habiletés visées, formulées par le prof
  savoirEtre: string;
}

export interface ModuleActivite {
  id: string;
  titre: string;
  // Activité Recto-versIA rattachée. null = activité hors application.
  devoirId?: string | null;
  typeTravail?: string | null; // mémorisé pour l'affichage (pastille)
}

export interface ModuleDidactique {
  id: string;
  titre: string;
  periodeAnnee: PeriodeAnnee;
  periodes: number;        // en périodes de cours, jamais en heures
  methodes: string[];      // ids de configuration/didactique.methodes
  uaa: string[];
  habiletes: string[];     // ids d'habiletés (config didactique)
  outils: string;
  objectifs: ObjectifsModule;
  activites: ModuleActivite[];
}

export interface Certification {
  titre: string;
  grille?: string;          // nom de la grille utilisée
  periodeAnnee?: PeriodeAnnee;
  periodes: number;
  devoirId?: string | null; // l'activité certificative, si elle existe
}

export interface ChapitreDidactique {
  id: string;
  titre: string;
  objectifGeneral: string;
  certification?: Certification | null;
  modules: ModuleDidactique[];
}

export interface Scenarisation {
  id: string;               // SCN-YYYYMMDD-XXXX
  nom: string;              // « Français — 4e générale »
  objectifGeneral: string;
  certification?: Certification | null; // certification du parcours
  // Réglages horaires : la capacité d'une période de l'année s'en déduit
  // (semaines × heuresParSemaine ÷ dureePeriodeMin)
  dureePeriodeMin: number;  // 90
  heuresParSemaine: number; // 5
  semaines: Record<string, number>; // { 'sept-oct': 9, … }
  chapitres: ChapitreDidactique[];
  profId: string;
  anneeScolaire: string;
  archive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CreateScenarisationData = Pick<Scenarisation, 'nom'> &
  Partial<Pick<Scenarisation, 'objectifGeneral' | 'dureePeriodeMin' | 'heuresParSemaine'>>;

// ─── Calculs ───

export function semainesDe(scen: Scenarisation, periode: string): number {
  const stocke = scen.semaines?.[periode];
  if (typeof stocke === 'number' && stocke >= 0) return stocke;
  return PERIODES_ANNEE.find((p) => p.id === periode)?.semainesDefaut ?? 0;
}

// Capacité d'une période de l'année, en périodes de cours
export function capacitePeriode(scen: Scenarisation, periode: string): number {
  const heures = semainesDe(scen, periode) * (scen.heuresParSemaine || 0);
  const duree = (scen.dureePeriodeMin || 90) / 60;
  return duree > 0 ? Math.floor(heures / duree) : 0;
}

export function tousLesModules(scen: Scenarisation): ModuleDidactique[] {
  return scen.chapitres.flatMap((c) => c.modules);
}

// Périodes planifiées dans une période de l'année — certifications comprises
export function periodesPlanifiees(scen: Scenarisation, periode: string): number {
  let total = 0;
  scen.chapitres.forEach((c) => {
    c.modules.forEach((m) => {
      if (m.periodeAnnee === periode) total += m.periodes || 0;
    });
    if (c.certification?.periodeAnnee === periode) total += c.certification.periodes || 0;
  });
  if (scen.certification?.periodeAnnee === periode) total += scen.certification.periodes || 0;
  return total;
}

export function periodesChapitre(chapitre: ChapitreDidactique): number {
  return (
    chapitre.modules.reduce((s, m) => s + (m.periodes || 0), 0) +
    (chapitre.certification?.periodes || 0)
  );
}

// Durée lisible d'un nombre de périodes : « 4 h 30 »
export function formatDuree(periodes: number, dureePeriodeMin: number): string {
  const minutes = Math.round(periodes * (dureePeriodeMin || 90));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

// ─── Fabriques ───

function rid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function nouveauModule(periodeAnnee: PeriodeAnnee = 'sept-oct'): ModuleDidactique {
  return {
    id: rid('MOD'),
    titre: '',
    periodeAnnee,
    periodes: 2,
    methodes: [],
    uaa: [],
    habiletes: [],
    outils: '',
    objectifs: { concepts: '', habiletes: '', savoirEtre: '' },
    activites: [],
  };
}

export function nouveauChapitre(): ChapitreDidactique {
  return {
    id: rid('CHA'),
    titre: 'Nouveau chapitre',
    objectifGeneral: '',
    certification: null,
    modules: [],
  };
}

export function nouvelleActivite(titre = ''): ModuleActivite {
  return { id: rid('ACT'), titre, devoirId: null };
}

export function nouvelleCertification(): Certification {
  return { titre: 'Certification', periodes: 2, periodeAnnee: 'mai-juin', devoirId: null };
}
