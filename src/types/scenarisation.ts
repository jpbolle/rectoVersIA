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

// Objectifs particuliers d'un module, en trois registres.
//
// Deux d'entre eux ne sont plus du texte libre mais des GESTES pris dans la
// configuration didactique (/admin) : un geste englobe des habiletés, c'est le
// niveau auquel on planifie un cours.
export interface ObjectifsModule {
  concepts: string;           // concepts et connaissances — texte libre
  gestesCognitifs: string[];  // gestes de lecture, d'écriture, de parole, lexicaux
  gestesSavoirEtre: string[]; // gestes réflexifs et de savoir-être
  // Texte saisi avant le passage aux gestes (2026-08-14) : relu et affiché
  // tant qu'il n'est pas vide, pour ne rien perdre des encodages d'essai
  habiletesTexte?: string;
  savoirEtreTexte?: string;
}

// Une activité est une FICHE À PART ENTIÈRE : c'est elle qui porte la
// didactique fine (méthode, outils, UAA, gestes, durée), pas le module. Le
// module n'en est que la synthèse — décision de JP du 2026-08-14 : « sauf
// quand un module est égal à une activité, c'est dans les activités qu'il est
// intéressant de préciser la méthode, les outils, les UAA, les gestes, le
// nombre de périodes ».
export interface ModuleActivite {
  id: string;
  titre: string;
  // Activité Recto-versIA rattachée. null = activité hors application.
  devoirId?: string | null;
  typeTravail?: string | null; // mémorisé pour l'affichage (pastille)
  periodes: number;            // en périodes de cours, jamais en heures
  methodes: string[];          // ids de configuration/didactique.methodes
  uaa: string[];
  gestes: string[];            // libellés de gestes (config didactique)
  // Concepts et connaissances propres à CETTE activité — le module, lui, porte
  // les siens dans objectifs.concepts (fiche descriptive).
  concepts?: string;
  outils: string;
  // Avis du prof sur l'activité, écrit après coup : ce qui a marché, ce qui
  // serait à revoir. C'est la mémoire de l'année pour préparer la suivante.
  critique?: string;
}

// Ce qu'est une ligne de chapitre. Les trois genres ont EXACTEMENT le même
// comportement (mêmes colonnes, même réordonnancement) : une certification
// s'intercale donc entre deux modules, comme JP l'a demandé le 2026-08-14.
// Seules changent la couleur et la manière dont le temps est compté.
export type GenreModule = 'module' | 'certification' | 'suggestion';

export interface ModuleDidactique {
  id: string;
  titre: string;
  // Absent = 'module' (documents antérieurs au 2026-08-14)
  genre?: GenreModule;
  periodeAnnee: PeriodeAnnee;
  objectifs: ObjectifsModule;
  activites: ModuleActivite[];
  // ─── Valeurs HÉRITÉES ───
  // Saisies au module avant que la didactique ne descende sur l'activité. Plus
  // jamais éditées, mais relues : un module sans activité les affiche encore,
  // ce qui évite de vider les scénarisations déjà encodées.
  periodes?: number;
  methodes?: string[];
  uaa?: string[];
  habiletes?: string[];
  outils?: string;
}

export interface Certification {
  id?: string;
  titre: string;
  grille?: string;          // nom de la grille utilisée
  periodeAnnee?: PeriodeAnnee;
  periodes: number;
  devoirId?: string | null; // l'activité certificative, si elle existe
}

// Palette d'identité des chapitres. Toutes tiennent 4,5:1 avec du blanc :
// la couleur porte du texte dans les deux vues, elle ne peut pas être choisie
// au seul goût. (#b7950b — 2,87:1 — et #4a9a6a — 3,43:1 — ont été assombries
// le 2026-08-15 : elles rendaient trois chapitres sur six illisibles.)
export const COULEURS_CHAPITRE = [
  '#2d6a5a', // vert Classica
  '#4a7ba6', // bleu
  '#a6674a', // terre
  '#7c5fa6', // violet
  '#8a6f08', // ocre  (était #b7950b)
  '#3d7d55', // vert clair (était #4a9a6a)
];

export interface ChapitreDidactique {
  id: string;
  titre: string;
  // Identité visuelle du chapitre. Elle était déduite de la POSITION dans la
  // liste : déplacer un chapitre changeait sa couleur, et donc le repère que
  // le prof s'était construit. Elle est désormais posée à la création et suit
  // le chapitre. Absente = repli sur la position (documents antérieurs).
  couleur?: string;
  // Plusieurs objectifs généraux possibles — un chapitre en vise rarement un seul
  objectifsGeneraux: string[];
  // Modules et certifications vivent dans la MÊME liste : c'est ce qui leur
  // permet de s'intercaler librement (cf. GenreModule)
  modules: ModuleDidactique[];
  // SUGGESTIONS — des idées pour l'année prochaine, rien de plus. Ce ne sont
  // ni des modules ni des certifications : elles ne durent pas, ne s'évaluent
  // pas, ne se placent pas dans une période. Les glisser dans la suite des
  // modules leur donnait un poids qu'elles n'ont pas ; elles vivent donc à
  // part, sous une icône du bandeau de chapitre (décision JP, 2026-08-15).
  suggestions?: string[];
  // Champs d'avant le 2026-08-14, relus une fois puis convertis en modules
  objectifGeneral?: string;
  certification?: Certification | null;
  certifications?: Certification[];
}

export interface Scenarisation {
  id: string;               // SCN-YYYYMMDD-XXXX
  nom: string;              // « Français — 4e générale »
  // Ni objectif général ni certification au niveau du parcours : trop général
  // pour vouloir dire quelque chose — ils vivent dans les chapitres et les
  // modules (décision de JP, 2026-08-14).
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
  Partial<Pick<Scenarisation, 'dureePeriodeMin' | 'heuresParSemaine'>>;

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

// ─── Le module, synthèse de ses activités ───
//
// La didactique se saisit sur les activités ; le module l'affiche en résumé.
// Tant qu'un module n'a aucune activité, on retombe sur ce qui avait été saisi
// à son niveau avant le 2026-08-14 : rien ne disparaît de l'écran.

// Durée d'un module : la somme de ses activités
export function modulePeriodes(m: ModuleDidactique): number {
  if (m.activites.length) return m.activites.reduce((s, a) => s + (a.periodes || 0), 0);
  return m.periodes || 0;
}

function union(listes: (string[] | undefined)[], heritees?: string[]): string[] {
  const out: string[] = [];
  listes.forEach((l) =>
    (l ?? []).forEach((v) => {
      if (v && !out.includes(v)) out.push(v);
    })
  );
  if (!out.length && heritees?.length) return [...heritees];
  return out;
}

export function moduleMethodes(m: ModuleDidactique): string[] {
  return union(m.activites.map((a) => a.methodes), m.methodes);
}

export function moduleUaa(m: ModuleDidactique): string[] {
  return union(m.activites.map((a) => a.uaa), m.uaa);
}

export function moduleGestes(m: ModuleDidactique): string[] {
  return union(m.activites.map((a) => a.gestes), m.habiletes);
}

export function moduleOutils(m: ModuleDidactique): string[] {
  return union(
    m.activites.map((a) =>
      a.outils ? a.outils.split(',').map((o) => o.trim()).filter(Boolean) : []
    ),
    m.outils ? m.outils.split(',').map((o) => o.trim()).filter(Boolean) : []
  );
}

export function genreDe(m: ModuleDidactique): GenreModule {
  return m.genre ?? 'module';
}

// Une SUGGESTION est une note pour l'année suivante : elle ne consomme aucune
// période de l'année en cours. Modules et certifications, eux, prennent du
// temps de cours et se comptent.
export function comptePourLAnnee(m: ModuleDidactique): boolean {
  return genreDe(m) !== 'suggestion';
}

// Les objectifs généraux d'un chapitre, ancien champ unique compris
export function objectifsDe(chapitre: ChapitreDidactique): string[] {
  if (chapitre.objectifsGeneraux?.length) return chapitre.objectifsGeneraux;
  return chapitre.objectifGeneral?.trim() ? [chapitre.objectifGeneral.trim()] : [];
}

// Périodes planifiées dans une période de l'année — suggestions exclues
export function periodesPlanifiees(scen: Scenarisation, periode: string): number {
  let total = 0;
  scen.chapitres.forEach((c) => {
    c.modules.forEach((m) => {
      if (m.periodeAnnee === periode && comptePourLAnnee(m)) total += modulePeriodes(m);
    });
  });
  return total;
}

export function periodesChapitre(chapitre: ChapitreDidactique): number {
  return chapitre.modules
    .filter(comptePourLAnnee)
    .reduce((s, m) => s + modulePeriodes(m), 0);
}

// ─── Conversion des documents d'avant le 2026-08-14 ───
//
// Les certifications vivaient à part (`certification`, puis `certifications`).
// Elles deviennent des modules de genre « certification », ajoutés à la fin du
// chapitre — le prof les déplacera où il veut. Appliquée à la LECTURE, cette
// conversion fait que l'écran n'a jamais qu'un seul modèle à connaître.
export function normaliserScenarisation(scen: Scenarisation): Scenarisation {
  return {
    ...scen,
    chapitres: (scen.chapitres ?? []).map((c, ci) => {
      const anciennes: Certification[] = c.certifications?.length
        ? c.certifications
        : c.certification
          ? [c.certification]
          : [];
      const converties: ModuleDidactique[] = anciennes.map((cert, i) => ({
        id: cert.id || `MOD-CERT-${c.id}-${i}`,
        titre: cert.titre,
        genre: 'certification',
        periodeAnnee: (cert.periodeAnnee ?? 'mai-juin') as PeriodeAnnee,
        objectifs: { concepts: '', gestesCognitifs: [], gestesSavoirEtre: [] },
        activites: cert.devoirId
          ? [{ ...nouvelleActivite(cert.titre), devoirId: cert.devoirId, periodes: cert.periodes || 0 }]
          : [],
        periodes: cert.periodes || 0,
      }));
      // Les suggestions encodées comme modules (avant le 2026-08-15) sortent
      // de la liste et redeviennent ce qu'elles ont toujours été : du texte.
      const modules = [...(c.modules ?? []), ...converties];
      const ancienneSuggestions = modules
        .filter((m) => m.genre === 'suggestion')
        .map((m) => m.titre.trim())
        .filter(Boolean);

      return {
        ...c,
        objectifsGeneraux: objectifsDe(c),
        objectifGeneral: undefined,
        certification: null,
        certifications: undefined,
        // La couleur se fige à la première lecture : celle qu'affichait le
        // chapitre jusqu'ici devient la sienne pour de bon.
        couleur: c.couleur || COULEURS_CHAPITRE[ci % COULEURS_CHAPITRE.length],
        modules: modules.filter((m) => m.genre !== 'suggestion'),
        suggestions: [...(c.suggestions ?? []), ...ancienneSuggestions],
      };
    }),
  };
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

export function nouveauModule(
  periodeAnnee: PeriodeAnnee = 'sept-oct',
  genre: GenreModule = 'module'
): ModuleDidactique {
  return {
    id: rid('MOD'),
    titre: '',
    genre,
    periodeAnnee,
    objectifs: { concepts: '', gestesCognitifs: [], gestesSavoirEtre: [] },
    activites: [],
  };
}

// Libellés des trois genres — l'emoji ouvre la ligne dans le tableau
export const GENRES: Record<GenreModule, { label: string; icone: string; ajouter: string }> = {
  module: { label: 'Module', icone: '', ajouter: '＋ Module' },
  certification: { label: 'Certification', icone: '⭐', ajouter: '⭐ Certification' },
  // Conservée pour relire les documents d'avant le 2026-08-15 ; plus jamais
  // proposée à la création (voir GENRES_AJOUTABLES).
  suggestion: { label: 'Suggestion', icone: '💡', ajouter: '💡 Suggestion' },
};

// Ce qu'on peut réellement ajouter à un chapitre aujourd'hui
export const GENRES_AJOUTABLES: GenreModule[] = ['module', 'certification'];

export function couleurDeChapitre(chapitre: ChapitreDidactique, index: number): string {
  return chapitre.couleur || COULEURS_CHAPITRE[index % COULEURS_CHAPITRE.length];
}

export function nouveauChapitre(rang = 0): ChapitreDidactique {
  return {
    id: rid('CHA'),
    titre: 'Nouveau chapitre',
    couleur: COULEURS_CHAPITRE[rang % COULEURS_CHAPITRE.length],
    objectifsGeneraux: [],
    modules: [],
    suggestions: [],
  };
}

export function nouvelleActivite(titre = ''): ModuleActivite {
  return {
    id: rid('ACT'),
    titre,
    devoirId: null,
    periodes: 2,
    methodes: [],
    uaa: [],
    gestes: [],
    outils: '',
    critique: '',
  };
}
