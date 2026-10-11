// ═══ Atelier de conceptualisation — comparaison IA du schéma de l'élève avec
// le corrigé du prof (étape 4 du plan 2026-10-11) ═══
//
// Partagé par la route /api/ai/schema-comparaison (serveur) et le panneau
// « Aide IA » du prof (client) : rien ici n'importe de code serveur.
//
// Une LIGNE du tableau = un concept ou un lien, avec son statut. Le prof
// l'accepte (✓ : elle pose la pastille correspondante sur le schéma) ou la
// refuse (✗ : elle disparaît et ne compte plus).

import type { Diagram, DiagramType } from '@/types/diagram';
import type { MarqueSchema, SchemaMarques } from '@/types/correction';

export type StatutConcept = 'present' | 'absent' | 'en_trop';
export type StatutLien = 'juste' | 'faux' | 'absent';

export interface LigneComparaison {
  id: string; // l1, l2… (stable pour les décisions)
  genre: 'concept' | 'lien';
  statut: StatutConcept | StatutLien;
  /** Ce que dit le corrigé (absent si l'élément n'existe que chez l'élève) */
  corrige: string | null;
  /** Ce qu'a fait l'élève (absent si l'élément manque) */
  eleve: string | null;
  /** L'élément du schéma de l'élève visé : id de boîte ou de lien */
  cibleId: string | null;
  commentaire: string;
}

export type Decision = 'accepte' | 'refuse';

export interface ComparaisonSchema {
  travailId: string;
  devoirId: string;
  type: DiagramType;
  lignes: LigneComparaison[];
  synthese: string;
  /** Totaux du corrigé, pour les compteurs « x / total » */
  totalConceptsCorrige: number;
  totalLiensCorrige: number;
  decisions: Record<string, Decision>;
  createdAt: string;
  modele: string;
  /** L'élève a utilisé son aide IA (sa seule demande), à cette date */
  demandeParEleve?: string;
}

/** La colonne de gauche (présent) ou de droite (absent, en trop, erroné). */
export function estPresente(l: LigneComparaison): boolean {
  return l.statut === 'present' || l.statut === 'juste';
}

/** Les arbres : le « lien » d'une idée est son rattachement au parent. */
export function estArbre(type: DiagramType): boolean {
  return type === 'mindmap' || type === 'hierarchy';
}

/** L'identifiant de pastille d'un rattachement (cf. BrancheEdge). */
export const idRattachement = (nodeId: string) => `t_${nodeId}`;

const nettoyer = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

/**
 * Le schéma en texte, pour le modèle. Avec `ids`, chaque boîte et chaque lien
 * porte son identifiant entre crochets — pour que le modèle désigne
 * précisément l'élément visé (et que ✓ pose la bonne pastille).
 */
export function decrireSchema(d: Diagram, ids: boolean): string {
  const label = new Map(d.nodes.map((n) => [n.id, nettoyer(n.label) || '(boîte vide)']));
  const tag = (id: string) => (ids ? `[${id}] ` : '');
  const lignes: string[] = [`Type : ${d.type}. Titre : ${nettoyer(d.title) || '(sans titre)'}.`];

  lignes.push('BOÎTES :');
  for (const n of d.nodes) {
    const date = d.type === 'timeline' && n.date ? ` (date : ${n.date}${n.endDate ? ` → ${n.endDate}` : ''})` : '';
    lignes.push(`- ${tag(n.id)}${label.get(n.id)}${date}`);
  }

  if (estArbre(d.type)) {
    lignes.push('RATTACHEMENTS (parent → idée) :');
    for (const n of d.nodes.filter((x) => x.parentId)) {
      lignes.push(`- ${tag(idRattachement(n.id))}${label.get(n.parentId!) ?? '?'} → ${label.get(n.id)}`);
    }
  } else if (d.type !== 'timeline') {
    lignes.push('LIENS (origine —mot de liaison→ destination) :');
    for (const e of d.edges) {
      const mot = nettoyer(e.label);
      lignes.push(`- ${tag(e.id)}${label.get(e.source) ?? '?'} —${mot ? ` ${mot} ` : ''}→ ${label.get(e.target) ?? '?'}`);
    }
  }
  return lignes.join('\n');
}

/** Combien de concepts et de liens compte le corrigé. */
export function totauxCorrige(d: Diagram): { concepts: number; liens: number } {
  const liens = estArbre(d.type)
    ? d.nodes.filter((n) => n.parentId).length
    : d.type === 'timeline'
      ? d.nodes.length // ligne du temps : le « lien » est la place de l'événement
      : d.edges.length;
  return { concepts: d.nodes.length, liens };
}

/**
 * La pastille qu'une ligne ACCEPTÉE pose sur le schéma de l'élève (ou rien :
 * un élément absent n'a pas de boîte où se poser). Ligne du temps : la place
 * d'un événement se marque sur sa boîte.
 */
export function marqueDeLigne(
  l: LigneComparaison,
  type: DiagramType
): { genre: 'boites' | 'liens'; id: string; valeur: MarqueSchema } | null {
  if (!l.cibleId || l.statut === 'absent') return null;
  const valeur: MarqueSchema = estPresente(l) ? 'ok' : 'faux';
  if (l.genre === 'concept') return { genre: 'boites', id: l.cibleId, valeur };
  return { genre: type === 'timeline' ? 'boites' : 'liens', id: l.cibleId, valeur };
}

export interface Compteur {
  libelle: string;
  valeur: string;
  /** Combien sont déjà confirmés par le prof (✓ ou pastille posée à la main) */
  confirmes: number;
  ton?: 'bon' | 'mauvais';
}

/**
 * Les compteurs au-dessus du tableau, selon le type de schéma. Ils lisent les
 * lignes NON refusées (un ✗ les fait baisser), plus les pastilles posées à la
 * main sur des éléments que le tableau ne cite pas ; `confirmes` dit combien
 * le prof a déjà validés. Les « bons » liens se comptent sur le nombre de liens
 * du corrigé.
 */
export function compteurs(c: ComparaisonSchema, marques: SchemaMarques | undefined): Compteur[] {
  const lignes = c.lignes.filter((l) => c.decisions[l.id] !== 'refuse');
  const cites = new Set(lignes.map((l) => l.cibleId).filter(Boolean) as string[]);
  const aLaMain = (dico: Record<string, MarqueSchema> | undefined, v: MarqueSchema) =>
    Object.entries(dico ?? {}).filter(([id, m]) => m === v && !cites.has(id)).length;
  // Total et confirmés d'une catégorie
  const cat = (genre: 'concept' | 'lien', statut: string, main = 0) => {
    const ls = lignes.filter((l) => l.genre === genre && l.statut === statut);
    return { n: ls.length + main, ok: ls.filter((l) => c.decisions[l.id] === 'accepte').length + main };
  };
  const liensMain = c.type !== 'timeline';
  const conceptsOk = cat('concept', 'present', aLaMain(marques?.boites, 'ok'));
  const conceptsTrop = cat('concept', 'en_trop', aLaMain(marques?.boites, 'faux'));
  const conceptsAbsents = cat('concept', 'absent');
  const liensOk = cat('lien', 'juste', liensMain ? aLaMain(marques?.liens, 'ok') : 0);
  const liensFaux = cat('lien', 'faux', liensMain ? aLaMain(marques?.liens, 'faux') : 0);
  const liensAbsents = cat('lien', 'absent');

  const sur = (x: { n: number }, total: number) => `${x.n} / ${total}`;
  const k = (libelle: string, x: { n: number; ok: number }, ton: 'bon' | 'mauvais', valeur?: string): Compteur => ({
    libelle,
    valeur: valeur ?? String(x.n),
    confirmes: x.ok,
    ton,
  });

  if (estArbre(c.type)) {
    return [
      k('Idées présentes', conceptsOk, 'bon', sur(conceptsOk, c.totalConceptsCorrige)),
      k('Bien rattachées', liensOk, 'bon', sur(liensOk, c.totalLiensCorrige)),
      k('Mal rattachées', liensFaux, 'mauvais'),
      k('Idées absentes', conceptsAbsents, 'mauvais'),
      k('Idées en trop', conceptsTrop, 'mauvais'),
    ];
  }
  if (c.type === 'timeline') {
    return [
      k('Événements présents', conceptsOk, 'bon', sur(conceptsOk, c.totalConceptsCorrige)),
      k('Bien placés', liensOk, 'bon', sur(liensOk, c.totalLiensCorrige)),
      k('Mal placés', liensFaux, 'mauvais'),
      k('Événements absents', conceptsAbsents, 'mauvais'),
      k('En trop', conceptsTrop, 'mauvais'),
    ];
  }
  return [
    k('Concepts présents', conceptsOk, 'bon', sur(conceptsOk, c.totalConceptsCorrige)),
    k('Liens justes', liensOk, 'bon', sur(liensOk, c.totalLiensCorrige)),
    k('Liens faux', liensFaux, 'mauvais'),
    k('Liens absents', liensAbsents, 'mauvais'),
    k('Concepts absents', conceptsAbsents, 'mauvais'),
    k('Concepts en trop', conceptsTrop, 'mauvais'),
  ];
}

/** Ce que le modèle doit renvoyer (avant numérotation des lignes). */
export interface ReponseModele {
  concepts?: { statut?: string; corrige?: string | null; eleve?: string | null; id?: string | null; commentaire?: string }[];
  liens?: { statut?: string; corrige?: string | null; eleve?: string | null; id?: string | null; commentaire?: string }[];
  synthese?: string;
}

/** La réponse du modèle, contrôlée : statuts connus, identifiants existants. */
export function lignesDepuisModele(r: ReponseModele, eleve: Diagram): LigneComparaison[] {
  const boites = new Set(eleve.nodes.map((n) => n.id));
  const liens = new Set(
    estArbre(eleve.type)
      ? eleve.nodes.filter((n) => n.parentId).map((n) => idRattachement(n.id))
      : eleve.type === 'timeline'
        ? eleve.nodes.map((n) => n.id)
        : eleve.edges.map((e) => e.id)
  );
  const texte = (s: unknown) => (typeof s === 'string' && s.trim() ? s.trim().slice(0, 200) : null);
  const out: LigneComparaison[] = [];
  let i = 0;
  for (const c of r.concepts ?? []) {
    const statut = c.statut === 'present' || c.statut === 'absent' || c.statut === 'en_trop' ? c.statut : null;
    if (!statut) continue;
    const cible = typeof c.id === 'string' && boites.has(c.id) ? c.id : null;
    out.push({ id: `l${++i}`, genre: 'concept', statut, corrige: texte(c.corrige), eleve: texte(c.eleve), cibleId: statut === 'absent' ? null : cible, commentaire: texte(c.commentaire) ?? '' });
  }
  for (const l of r.liens ?? []) {
    const statut = l.statut === 'juste' || l.statut === 'faux' || l.statut === 'absent' ? l.statut : null;
    if (!statut) continue;
    const cible = typeof l.id === 'string' && liens.has(l.id) ? l.id : null;
    out.push({ id: `l${++i}`, genre: 'lien', statut, corrige: texte(l.corrige), eleve: texte(l.eleve), cibleId: statut === 'absent' ? null : cible, commentaire: texte(l.commentaire) ?? '' });
  }
  return out.slice(0, 120);
}

// ═══ Vue ÉLÈVE (étape 5) : une aide, pas une réponse ═══
// L'élève voit ce qu'il a TROUVÉ (ses propres mots, rien du corrigé) et, pour
// le reste, seulement des NOMBRES. Construite côté serveur : les lignes
// « absent / en trop / faux » ne quittent jamais le serveur (sinon on les
// lirait dans l'onglet Réseau de la console).

export interface VueEleveComparaison {
  type: DiagramType;
  trouves: { concepts: string[]; liens: string[] };
  nombres: {
    conceptsAbsents: number;
    conceptsEnTrop: number;
    liensFaux: number;
    liensAbsents: number;
  };
  totalConceptsCorrige: number;
  totalLiensCorrige: number;
  demandeLe: string;
}

export function vueEleve(c: ComparaisonSchema, demandeLe: string): VueEleveComparaison {
  const n = (genre: 'concept' | 'lien', statut: string) => c.lignes.filter((l) => l.genre === genre && l.statut === statut).length;
  const trouves = (genre: 'concept' | 'lien', statut: string) =>
    c.lignes.filter((l) => l.genre === genre && l.statut === statut && l.eleve).map((l) => l.eleve as string);
  return {
    type: c.type,
    trouves: { concepts: trouves('concept', 'present'), liens: trouves('lien', 'juste') },
    nombres: {
      conceptsAbsents: n('concept', 'absent'),
      conceptsEnTrop: n('concept', 'en_trop'),
      liensFaux: n('lien', 'faux'),
      liensAbsents: n('lien', 'absent'),
    },
    totalConceptsCorrige: c.totalConceptsCorrige,
    totalLiensCorrige: c.totalLiensCorrige,
    demandeLe,
  };
}

/**
 * Les statistiques de la CORRECTION DU PROF, telles que l'élève les voit
 * (onglet Évaluation, copie renvoyée pour réécriture — JP, 2026-10-11) : rien
 * que ce que le prof a CONFIRMÉ — lignes validées (✓) et pastilles posées à la
 * main —, jamais les propositions de l'IA qu'il n'a pas relues.
 */
export function statsCorrection(
  type: DiagramType,
  totaux: { concepts: number; liens: number },
  c: ComparaisonSchema | null,
  marques: SchemaMarques | undefined
): Compteur[] {
  const lignes = (c?.lignes ?? []).filter((l) => c?.decisions[l.id] === 'accepte');
  const confirmee: ComparaisonSchema = {
    travailId: c?.travailId ?? '',
    devoirId: c?.devoirId ?? '',
    type,
    lignes,
    synthese: '',
    totalConceptsCorrige: totaux.concepts,
    totalLiensCorrige: totaux.liens,
    decisions: Object.fromEntries(lignes.map((l) => [l.id, 'accepte' as const])),
    createdAt: '',
    modele: '',
  };
  return compteurs(confirmee, marques);
}
