// Lecture d'une œuvre — une œuvre est une RESSOURCE RÉUTILISABLE, pas le
// contenu d'une activité. On l'encode une fois (Molière : 5 classes de 4ᵉ
// depuis 5 ans), on la donne à autant de classes qu'on veut, et un autre prof
// peut la dupliquer pour la remanier — même modèle de partage que les grilles
// (profId / profName / shared, cf. src/app/api/grilles/route.ts).
//
//   Œuvre > Chapitres > Sections
//   Le Tartuffe (chapitre) > Acte I, scène 4 (section)
//
// L'ACTE n'est PAS un niveau d'imbrication : c'est une étiquette portée par la
// section (`groupe`), dont le sommaire se sert pour regrouper. Décision de JP
// du 2026-08-15 : « chapitre = 1 pièce et section = une scène (conserver les
// actes à titre informatif) ».
//
// ─── Pourquoi deux documents Firestore et pas un ───
// Le sommaire vit dans `oeuvres/{id}` (léger : des titres et un ordre), le
// contenu dans la sous-collection `oeuvres/{id}/sections/{sectionId}`, chargée
// À LA DEMANDE. Tout mettre dans un seul document ferait retélécharger 150 à
// 300 Ko à chaque élève à chaque ouverture, et une sauvegarde du prof
// réécrirait l'ensemble — ce qui a déjà coûté une perte de données sur la
// scénarisation.
//
// ─── Le dispositif reste `lire` ───
// Une œuvre n'ouvre pas une sixième machinerie : les vérifications de lecture
// sont des LectureQuestion, exactement celles du questionnaire de lecture
// (src/types/lecture.ts). Ce qui change, c'est l'enveloppe : un parcours
// paginé au lieu d'une page unique.

import type { LectureQuestion } from './lecture';

// ─── Les blocs qui composent une section ───
//
// Une section n'est pas un bloc de texte unique : le prof intercale une image
// ou une vidéo OÙ IL VEUT dans la scène. D'où une liste ordonnée de blocs
// plutôt qu'un champ `contenu` + des médias en annexe.

export type OeuvreBlocType = 'texte' | 'vers' | 'video' | 'image';

export interface OeuvreBloc {
  id: string;
  type: OeuvreBlocType;
  // texte : HTML (Tiptap) — chapeau, analyse, prose
  // vers  : texte brut, une ligne = un vers (jamais justifié, jamais coupé)
  contenu?: string;
  // Nom du personnage qui parle, au-dessus des vers — le théâtre en vit
  locuteur?: string;
  // video : identifiant YouTube, ou lien Drive (le site de JP mêle les deux)
  videoId?: string;
  videoUrl?: string;
  // image : même stockage que les questionnaires (base64 dans ressourceImages,
  // servi par /api/ressources/image/[id]) — jamais d'URL externe
  imageUrl?: string;
  imageFileId?: string;
  legende?: string;
}

// ─── Une section = un écran de la liseuse ───

export interface OeuvreSection {
  id: string;
  chapitreId: string;
  titre: string;          // « Scène 4 — Orgon & Dorine »
  groupe?: string;        // « Acte I » — informatif, sert au regroupement
  chapeau?: string;       // présentation courte, en italique avant le texte
  // Le texte peut se lire en deux colonnes sans rien perdre (demande de JP) :
  // vrai par défaut sur les longues scènes, à la main du prof.
  colonnes?: 1 | 2;
  blocs: OeuvreBloc[];
  // Vérification de lecture — mêmes questions que le questionnaire de lecture.
  // Vide = section sans formulaire : elle se lit, elle ne se vérifie pas.
  questions: LectureQuestion[];
}

// Ce que le sommaire connaît d'une section : de quoi l'afficher et y aller,
// sans charger son contenu.
export interface OeuvreSectionRef {
  id: string;
  titre: string;
  groupe?: string;
  aQuestions: boolean;
}

export interface OeuvreChapitre {
  id: string;
  titre: string;          // « Le Tartuffe »
  sousTitre?: string;     // « 1664-1669 »
  sections: OeuvreSectionRef[];
}

export interface Oeuvre {
  id: string;             // OEU-YYYYMMDD-XXXX
  titre: string;          // « Molière — Anthologie comique »
  auteur?: string;
  description?: string;
  chapitres: OeuvreChapitre[];
  // Partage, calqué sur les grilles : chacun voit les œuvres des autres et
  // peut les dupliquer ; seul l'admin marque une œuvre comme exemple partagé.
  profId: string;
  profName?: string;
  shared: boolean;
  archive: boolean;
  anneeScolaire: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Ce que l'élève dépose en travaillant ───
//
// Stocké en JSON dans travail.content, comme les réponses de lecture. Deux
// choses seulement, puisque rien n'est noté (décision de JP) : la FRÉQUENCE DE
// LECTURE et les VÉRIFICATIONS COMPLÉTÉES.

export interface OeuvreSectionEtat {
  // Horodatage de la première ouverture — sert au « lu »
  vueLe?: string;
  // Réponses aux questions de la section (clé = LectureQuestion.id).
  // Le type réutilise LectureAnswer : c'est le même questionnaire.
  reponses?: Record<string, unknown>;
  // Vérification considérée comme complétée — c'est ELLE qui compte dans le
  // total, pas l'ouverture de la page
  termineLe?: string;
}

export interface OeuvreProgression {
  type: 'oeuvre';
  sections: Record<string, OeuvreSectionEtat>;
  // Jours où l'élève a ouvert l'œuvre (AAAA-MM-JJ, sans doublon) : c'est la
  // « fréquence de lecture » de l'onglet Lire. Un jour, pas un horodatage —
  // on veut savoir s'il lit régulièrement, pas à quelle heure.
  jours: string[];
}

export function parseOeuvreProgression(content: string | undefined | null): OeuvreProgression | null {
  if (!content) return null;
  try {
    const parsed = JSON.parse(content);
    if (parsed && parsed.type === 'oeuvre' && parsed.sections) {
      return { type: 'oeuvre', sections: parsed.sections, jours: parsed.jours || [] };
    }
    return null;
  } catch {
    return null;
  }
}

export function emptyProgression(): OeuvreProgression {
  return { type: 'oeuvre', sections: {}, jours: [] };
}

// Nombre de vérifications complétées — le seul compteur qui fasse foi
export function nbVerificationsFaites(p: OeuvreProgression | null): number {
  if (!p) return 0;
  return Object.values(p.sections).filter((s) => !!s.termineLe).length;
}

// ─── Le rythme de lecture ───
//
// Le prof pose une ÉCHÉANCE (pas une remise : rien ne se remet) et un nombre
// minimum de vérifications. Le rythme attendu s'en déduit — 20 formulaires
// pour dans 40 jours, c'est un tous les deux jours.
//
// Ce calcul sert à trois endroits : la notification (5ᵉ type, calculée à la
// lecture comme les quatre autres — aucune tâche planifiée sur le VPS), le
// rappel de l'onglet Général, et le suivi de classe côté prof.

export type EtatLecture = 'sansEcheance' | 'pasEntamee' | 'enRetard' | 'dansLesTemps' | 'termine';

export interface RythmeLecture {
  etat: EtatLecture;
  faites: number;
  minimum: number;
  attendu: number;        // là où l'élève devrait en être aujourd'hui
  retard: number;         // attendu - faites, jamais négatif
  joursRestants: number;
}

// Seuils — volontairement tolérants : la notification doit inviter à lire, pas
// harceler pour un jour de décalage.
const MARGE_RETARD = 2;       // vérifications sous l'attendu avant d'alerter
const DELAI_PAS_ENTAMEE = 7;  // jours sans rien faire avant « pas entamée »

export function calculerRythme(
  faites: number,
  minimum: number,
  debut: string | null | undefined,
  echeance: string | null | undefined,
  maintenant: Date = new Date()
): RythmeLecture {
  const base = { faites, minimum, attendu: 0, retard: 0, joursRestants: 0 };
  if (!minimum || !echeance) return { ...base, etat: 'sansEcheance' };
  if (faites >= minimum) return { ...base, attendu: minimum, etat: 'termine' };

  const fin = new Date(echeance);
  const depart = debut ? new Date(debut) : maintenant;
  const jour = 86_400_000;
  const total = Math.max(1, Math.round((fin.getTime() - depart.getTime()) / jour));
  const ecoules = Math.max(0, Math.round((maintenant.getTime() - depart.getTime()) / jour));
  const joursRestants = Math.max(0, Math.round((fin.getTime() - maintenant.getTime()) / jour));

  const attendu = Math.min(minimum, Math.round((minimum * ecoules) / total));
  const retard = Math.max(0, attendu - faites);

  let etat: EtatLecture = 'dansLesTemps';
  if (faites === 0 && ecoules >= DELAI_PAS_ENTAMEE) etat = 'pasEntamee';
  else if (retard >= MARGE_RETARD) etat = 'enRetard';

  return { etat, faites, minimum, attendu, retard, joursRestants };
}

// ─── Identifiants ───

function suffixe(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

function horodatage(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

export function generateOeuvreId(): string {
  return `OEU-${horodatage()}-${suffixe()}`;
}

export function generateChapitreId(): string {
  return `CH-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function generateSectionId(): string {
  return `SEC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function generateBlocId(): string {
  return `BL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// Toutes les sections d'une œuvre, à plat et dans l'ordre du sommaire —
// la liseuse navigue linéairement (scène précédente / suivante), pas par
// chapitre.
export function sectionsAPlat(oeuvre: Oeuvre): { chapitre: OeuvreChapitre; section: OeuvreSectionRef }[] {
  const out: { chapitre: OeuvreChapitre; section: OeuvreSectionRef }[] = [];
  oeuvre.chapitres.forEach((c) => c.sections.forEach((s) => out.push({ chapitre: c, section: s })));
  return out;
}
