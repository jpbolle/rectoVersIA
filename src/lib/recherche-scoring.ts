// Notation d'une activité de recherche (NavigKid), et agrégation par habileté.
//
// Deux notes par question, volontairement séparées :
//  - RÉPONSE   : ce que l'élève a trouvé. QCM comptés automatiquement (jamais
//                stockés, recalculés à chaque lecture pour rester justes si le
//                prof corrige le questionnaire après coup) ; le prof peut
//                contredire l'ordinateur, sa note est alors stockée et gagne.
//  - DÉMARCHE  : comment il l'a cherché (mots-clés + sites retenus). Toujours
//                saisie par le prof, jamais automatique.
//
// Les deux ne se mélangent pas : « mal cherché » et « mal répondu » ne veulent
// pas dire la même chose, ni pour l'élève ni pour le profil.
//
// Une note absente est HORS TOTAL (ni numérateur, ni dénominateur) : sinon un
// travail à moitié corrigé afficherait un score faux.
//
// Agrégation par habileté — même règle que la lecture : une question portant
// deux habiletés compte ENTIÈREMENT dans chacune, jamais divisée. La somme des
// lignes ne retombe donc pas sur le total, et c'est voulu.
//
// Utilisable côté serveur (profil) comme côté client (onglet Évaluation).

import type {
  NavigKidQuestion,
  NavigKidQuestionData,
  NavigKidReponse,
  RechercheQuestionScore,
} from '@/types/navigkid';
import type { HabileteScore } from './lecture-scoring';

export interface RechercheQuestionResult {
  index: number;
  // Réponse
  reponsePoints: number | null;   // note retenue (prof si posée, sinon automatique)
  reponseMax: number;
  reponseAuto: number | null;     // ce que l'ordinateur a calculé (null = pas corrigeable)
  reponseOverride: boolean;       // le prof a contredit l'ordinateur
  // Démarche
  demarchePoints: number | null;
  demarcheMax: number;
}

export interface RechercheStats {
  motsCles: number;
  sites: number;
  sitesPertinents: number;
  fiabiliteMoyenne: number | null; // sur les sites que l'élève a évalués
  tempsTotalMs: number;
  passages: number;
  questionsRepondues: number;
  questionsTotal: number;
}

export interface RechercheVolet {
  points: number;
  max: number;
  percent: number | null;
  aNoter: number;
}

export interface RechercheScore {
  reponses: RechercheVolet;
  demarche: RechercheVolet;
  parQuestion: RechercheQuestionResult[];
  parHabilete: HabileteScore[];
  stats: RechercheStats;
}

// Une question porte son corrigé QCM seulement si le serveur a accepté de
// l'envoyer (voir src/lib/navigkid-server.ts) : sans lui, pas d'automatisme.
function autoScoreQcm(question: NavigKidQuestion, donnee: string | undefined): number | null {
  if (question.type !== 'qcm') return null;
  if (!Array.isArray(question.options) || !Array.isArray(question.correctes)) return null;
  if (question.correctes.length === 0) return null;
  if (!donnee) return 0;
  // L'extension enregistre le TEXTE de l'option choisie, pas son indice.
  const index = question.options.findIndex((opt) => opt === donnee);
  return index !== -1 && question.correctes.includes(index) ? (question.points || 0) : 0;
}

function borne(valeur: number, max: number): number {
  return Math.max(0, Math.min(max, valeur));
}

function volet(parQuestion: RechercheQuestionResult[], champ: 'reponse' | 'demarche'): RechercheVolet {
  let points = 0;
  let max = 0;
  let aNoter = 0;
  parQuestion.forEach((q) => {
    const note = champ === 'reponse' ? q.reponsePoints : q.demarchePoints;
    const bareme = champ === 'reponse' ? q.reponseMax : q.demarcheMax;
    if (bareme <= 0) return;
    if (note === null) {
      aNoter++;
      return;
    }
    points += note;
    max += bareme;
  });
  return {
    points: Math.round(points * 10) / 10,
    max,
    percent: max > 0 ? Math.round((points / max) * 100) : null,
    aNoter,
  };
}

export function scoreRecherche(
  questions: NavigKidQuestion[] | null | undefined,
  reponse: NavigKidReponse | null | undefined,
  scores?: Record<string, RechercheQuestionScore>
): RechercheScore {
  const liste = questions ?? [];
  const donnees: NavigKidQuestionData[] = reponse?.questions ?? [];

  const parQuestion: RechercheQuestionResult[] = liste.map((question, index) => {
    const donnee = donnees.find((d) => d.questionIndex === index);
    const saisi = scores?.[String(index)];

    const reponseMax = question.points || 0;
    const auto = autoScoreQcm(question, donnee?.reponse);
    const saisiReponse = typeof saisi?.reponse === 'number' ? borne(saisi.reponse, reponseMax) : null;

    // Démarche : 1 point par source demandée. Le prof fixe le nombre de
    // sources, le barème en découle — il n'y a rien à saisir.
    const demarcheMax = question.pointsDemarche ?? question.nbSources ?? 0;
    const saisiDemarche =
      typeof saisi?.demarche === 'number' ? borne(saisi.demarche, demarcheMax) : null;

    return {
      index,
      reponsePoints: saisiReponse ?? auto,
      reponseMax,
      reponseAuto: auto,
      reponseOverride: saisiReponse !== null && auto !== null && saisiReponse !== auto,
      demarchePoints: saisiDemarche,
      demarcheMax,
    };
  });

  // Agrégation par habileté : les deux volets d'une question versent leurs
  // points en entier à chacune de ses habiletés
  const parHabilete = new Map<string, HabileteScore>();
  liste.forEach((question, i) => {
    const q = parQuestion[i];
    let points = 0;
    let max = 0;
    if (q.reponseMax > 0 && q.reponsePoints !== null) {
      points += q.reponsePoints;
      max += q.reponseMax;
    }
    if (q.demarcheMax > 0 && q.demarchePoints !== null) {
      points += q.demarchePoints;
      max += q.demarcheMax;
    }
    if (max === 0) return;
    (question.competences ?? []).forEach((id) => {
      const cur = parHabilete.get(id) ?? { habileteId: id, points: 0, max: 0, questions: 0 };
      cur.points += points;
      cur.max += max;
      cur.questions += 1;
      parHabilete.set(id, cur);
    });
  });

  // Statistiques de recherche : elles disent COMMENT l'élève a cherché
  const sites = donnees.flatMap((d) => d.sitesConsultes ?? []);
  const evalues = sites.filter((s) => s.fiabilite > 0);
  const stats: RechercheStats = {
    motsCles: donnees.reduce((s, d) => s + (d.motsCles?.length ?? 0), 0),
    sites: sites.length,
    sitesPertinents: sites.filter((s) => s.pertinence).length,
    fiabiliteMoyenne: evalues.length
      ? Math.round((evalues.reduce((s, x) => s + x.fiabilite, 0) / evalues.length) * 10) / 10
      : null,
    tempsTotalMs: sites.reduce((s, x) => s + (x.tempsPasse || 0), 0),
    passages: donnees.reduce((s, d) => s + (d.passages?.length ?? 0), 0),
    questionsRepondues: donnees.filter((d) => (d.reponse || '').trim().length > 0).length,
    questionsTotal: liste.length,
  };

  return {
    reponses: volet(parQuestion, 'reponse'),
    demarche: volet(parQuestion, 'demarche'),
    parQuestion,
    parHabilete: [...parHabilete.values()],
    stats,
  };
}

// Pourcentage d'ensemble, les deux volets réunis — ce qu'affiche le bandeau
// de correction. Il est PARTIEL tant que des questions attendent leur note :
// celles-ci restent hors total (cf. `volet`), si bien que le pourcentage porte
// sur ce qui est déjà corrigé. C'est volontairement plus parlant qu'un 0 %,
// qui laisserait croire à un travail nul alors qu'il n'est pas encore lu.
// `null` quand rien n'est notable : aucun barème, ou rien de corrigé.
export function percentGlobalRecherche(score: RechercheScore): number | null {
  const points = score.reponses.points + score.demarche.points;
  const max = score.reponses.max + score.demarche.max;
  if (max === 0) return null;
  return Math.round((points / max) * 100);
}

// Reste-t-il des questions à noter, l'un ou l'autre volet confondu ?
export function resteANoter(score: RechercheScore): number {
  return score.reponses.aNoter + score.demarche.aNoter;
}

// Affichage : 2,5 plutôt que 2.5
export function formatPoints(n: number): string {
  return String(Math.round(n * 10) / 10).replace('.', ',');
}
