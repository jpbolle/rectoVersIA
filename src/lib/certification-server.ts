// Certifications — accès serveur.
//
// La certification est déclarée dans la scénarisation (module de genre
// `certification`) ; seule la NOTE de chaque élève vit dans une collection à
// part, `certificationsEleves`. Ce module fait la jointure entre les deux.

import { adminDb } from '@/lib/firebase/admin';
import { decryptFields, SENSITIVE_ELEVE_FIELDS } from '@/lib/crypto';
import {
  certificationsDe,
  devoirCertificatif,
  genreDe,
  normaliserScenarisation,
  estCotee,
  ponderationDe,
  ponderationUaa,
  uaaCertifiees,
} from '@/types/scenarisation';
import {
  CEINTURE_DEPART,
  SEUIL_CERTIFICATION,
  ceintureLaPlusHaute,
  estEnReussite,
} from '@/types/ceintures';
import { UAA_LIST } from '@/types/grille';
import { copieCorrigee } from '@/lib/correction-etat';
import { quizDuDevoir } from '@/lib/questionnaire-lecture-server';
import type { LectureQuiz } from '@/types/lecture';
import type {
  CorrectionPourEtat,
  DevoirPourEtat,
  TravailPourEtat,
} from '@/lib/correction-etat';
import type { ModuleDidactique, Scenarisation } from '@/types/scenarisation';
import type { LigneNoteCertification, NoteCertification } from '@/types/certification';
import type {
  LigneCertification,
  ProfilCertifications,
  UaaCertifiee,
} from '@/types/profil';

export const COLLECTION_NOTES = 'certificationsEleves';

export function noteId(moduleId: string, eleveId: string): string {
  return `CRT-${moduleId}-${eleveId}`;
}

// ─── Retrouver une certification à partir de son seul id de module ───
//
// La certification n'a pas de document propre : elle est imbriquée dans une
// scénarisation. On parcourt donc celles du prof — il en a une par cours,
// quelques-unes au plus.
export interface CertificationTrouvee {
  scenarisation: Scenarisation;
  chapitreId: string;
  module: ModuleDidactique;
}

export async function trouverCertification(
  profId: string,
  moduleId: string
): Promise<CertificationTrouvee | null> {
  const snap = await adminDb.collection('scenarisations').where('profId', '==', profId).get();
  for (const doc of snap.docs) {
    const scen = normaliserScenarisation({ id: doc.id, ...doc.data() } as Scenarisation);
    for (const ch of scen.chapitres) {
      const module = ch.modules.find((m) => m.id === moduleId && genreDe(m) === 'certification');
      if (module) return { scenarisation: scen, chapitreId: ch.id, module };
    }
  }
  return null;
}

// ─── Les élèves concernés par une certification ───
//
// Le parcours désigne ses classes par NOM (comme devoirs.classes) : on les
// retrouve parmi les classes non archivées du prof. `classeId` restreint à une
// seule classe — c'est le cas quand la popup s'ouvre depuis Mes Classes.
interface EleveConcerne {
  eleveId: string;
  nom: string;
  prenom: string;
  classeId: string;
  classeNom: string;
  firebaseUid: string | null;
  // ⚠ Empreinte HMAC de l'email — la SEULE clé fiable pour rapprocher un élève
  // de sa copie. `firebaseUid` n'est posé qu'à la connexion suivant l'ajout en
  // classe : sur le parcours de français du 2026-09-20, 25 fiches sur 40 en
  // avaient un, contre 40 sur 40 pour l'empreinte. Ce n'est pas une donnée
  // sensible (c'est une empreinte), elle ne se déchiffre pas.
  emailHash: string | null;
}

export async function elevesConcernes(
  scen: Scenarisation,
  profId: string,
  classeId?: string | null
): Promise<EleveConcerne[]> {
  const classesSnap = await adminDb.collection('classes').where('profId', '==', profId).get();
  const noms = scen.classes ?? [];
  const classes = classesSnap.docs
    .filter((d) => !d.data().archive)
    .filter((d) => (noms.length ? noms.includes(d.data().nom) : false))
    .filter((d) => (classeId ? d.id === classeId : true));
  if (classes.length === 0) return [];

  const parClasse = await Promise.all(
    classes.map(async (c) => {
      const snap = await adminDb.collection('eleves').where('classeId', '==', c.id).get();
      return snap.docs.map((d) => {
        const data = decryptFields(d.data(), SENSITIVE_ELEVE_FIELDS);
        return {
          eleveId: d.id,
          nom: data.nom || '',
          prenom: data.prenom || '',
          classeId: c.id,
          classeNom: c.data().nom as string,
          firebaseUid: (data.firebaseUid as string) || null,
          emailHash: (data.emailHash as string) || null,
        };
      });
    })
  );

  return parClasse
    .flat()
    .sort((a, b) =>
      a.classeNom.localeCompare(b.classeNom) ||
      a.nom.localeCompare(b.nom) ||
      a.prenom.localeCompare(b.prenom)
    );
}

// ─── Les notes déjà saisies ───

export async function notesSaisies(moduleId: string): Promise<Map<string, NoteCertification>> {
  const snap = await adminDb.collection(COLLECTION_NOTES).where('moduleId', '==', moduleId).get();
  const out = new Map<string, NoteCertification>();
  snap.docs.forEach((d) => {
    const n = { id: d.id, ...d.data() } as NoteCertification;
    out.set(n.eleveId, n);
  });
  return out;
}

// ─── Les notes que l'application connaît déjà ───
//
// Quand la certification est rattachée à une activité Recto-versIA, sa note est
// déjà dans la correction : la ressaisir serait absurde. Elle ne sert que de
// valeur proposée — une saisie manuelle prime toujours (voir buildLignes).
export async function notesAutomatiques(
  devoirId: string | null,
  eleves: EleveConcerne[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!devoirId) return out;

  // Les corrections ne portent que l'uid ; c'est la COPIE qui porte aussi
  // l'empreinte d'email. On passe donc par elle pour retrouver l'élève.
  const [snap, travauxSnap] = await Promise.all([
    adminDb.collection('corrections').where('devoirId', '==', devoirId).get(),
    adminDb.collection('travaux').where('devoirId', '==', devoirId).get(),
  ]);
  const parUid = new Map<string, number>();
  snap.docs.forEach((d) => {
    const data = d.data();
    if (typeof data.score === 'number') parUid.set(data.studentId, data.score);
  });
  const parEmpreinte = new Map<string, number>();
  travauxSnap.docs.forEach((d) => {
    const t = d.data();
    const score = parUid.get(t.studentId);
    if (t.studentEmailHash && typeof score === 'number') {
      parEmpreinte.set(t.studentEmailHash as string, score);
    }
  });

  eleves.forEach((e) => {
    const score =
      (e.firebaseUid ? parUid.get(e.firebaseUid) : undefined) ??
      (e.emailHash ? parEmpreinte.get(e.emailHash) : undefined);
    if (typeof score === 'number') out.set(e.eleveId, Math.round(score));
  });
  return out;
}

// ─── Les copies corrigées d'une activité ───
//
// Renvoie la DATE de la copie corrigée, indexée SUR DEUX CLÉS : le compte
// Google de l'élève et l'empreinte de son email. La présence de la clé vaut
// « corrigée » ; la date sert à dater la certification déduite.
// ⚠ Les deux clés ne sont pas un luxe : `eleves.firebaseUid` n'est posé qu'à la
// connexion suivant l'ajout en classe, et manquait sur 15 fiches sur 40 le
// 2026-09-20 — d'où des élèves dont la copie était corrigée depuis longtemps et
// qui restaient « à faire ».
async function copiesCorrigeesParUid(devoirId: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();

  const devoirSnap = await adminDb.collection('devoirs').doc(devoirId).get();
  if (!devoirSnap.exists) return out;
  const devoir = devoirSnap.data() as Record<string, unknown>;

  const [travauxSnap, corrSnap, sessionsSnap] = await Promise.all([
    adminDb.collection('travaux').where('devoirId', '==', devoirId).get(),
    adminDb.collection('corrections').where('devoirId', '==', devoirId).get(),
    adminDb.collection('sessions').where('devoirId', '==', devoirId).get(),
  ]);

  const corrections = new Map<string, CorrectionPourEtat>();
  corrSnap.docs.forEach((d) => {
    const c = d.data();
    if (c.studentId) corrections.set(c.studentId, c as CorrectionPourEtat);
  });

  // ── Le questionnaire n'est PAS forcément sur l'activité ──
  // Il peut vivre dans la bibliothèque (`lectureQuizId`), ou dans la copie
  // figée par la session. Lire `devoir.lectureQuiz` en direct renvoyait alors
  // un questionnaire vide, et toutes les copies passaient pour non corrigées
  // (trouvé le 2026-09-20). C'est `quizDuDevoir` qui connaît les trois
  // chemins — et il sert à chaque session le questionnaire qu'elle a figé.
  const sessions = new Map(sessionsSnap.docs.map((d) => [d.id, d.data()]));
  const quizParSession = new Map<string, LectureQuiz | null>();
  const quizPour = async (sessionId: string | null | undefined) => {
    const cle = sessionId ?? '';
    if (!quizParSession.has(cle)) {
      const session = sessionId ? (sessions.get(sessionId) ?? null) : null;
      quizParSession.set(cle, await quizDuDevoir(devoir, session));
    }
    return quizParSession.get(cle) ?? null;
  };

  const estLecture = devoir.typeTravail === 'lire';

  for (const d of travauxSnap.docs) {
    const t = d.data();
    if (!t.studentId) continue;
    const pourEtat: DevoirPourEtat = {
      typeTravail: String(devoir.typeTravail ?? ''),
      lectureQuiz: estLecture ? await quizPour(t.sessionId as string | null) : null,
    };
    if (!copieCorrigee(pourEtat, t as TravailPourEtat, corrections.get(t.studentId))) continue;
    const date = String(t.submittedAt || t.updatedAt || '').slice(0, 10);
    out.set(t.studentId as string, date);
    if (t.studentEmailHash) out.set(t.studentEmailHash as string, date);
  }

  return out;
}

// ─── Les certifications « faites » que l'application déduit toute seule ───
//
// Une certification NON COTÉE rattachée à une activité est acquise dès que la
// copie de l'élève est corrigée : le prof n'a plus à aller cocher « fait »
// (décision du 2026-09-20, plan `harnais/plans/2026-09-20-certification-faite-automatique.md`).
//
// ⚠ Rien n'est écrit en base. La copie corrigée EST la preuve — la recopier
// créerait un second état à tenir d'accord, qui se périmerait au premier
// ajustement. Ce qui suit fabrique donc des notes VIRTUELLES, que l'appelant
// traite comme les autres.
//
// ⚠ Le rapprochement passe par le compte Google de l'élève : un élève jamais
// connecté reste hors d'atteinte, et se coche à la main.
export async function faitsAutomatiques(
  devoirId: string | null,
  eleves: EleveConcerne[]
): Promise<Set<string>> {
  const out = new Set<string>();
  if (!devoirId) return out;

  const corrigees = await copiesCorrigeesParUid(devoirId);
  eleves.forEach((e) => {
    const trouve =
      (e.firebaseUid && corrigees.has(e.firebaseUid)) ||
      (e.emailHash && corrigees.has(e.emailHash));
    if (trouve) out.add(e.eleveId);
  });
  return out;
}

export async function notesFaitesAuto(eleveIds: string[]): Promise<NoteCertification[]> {
  if (eleveIds.length === 0) return [];

  // 1. Les élèves : leur classe et leur compte Google
  const eleveDocs = await Promise.all(
    eleveIds.map((id) => adminDb.collection('eleves').doc(id).get())
  );
  const eleves = eleveDocs
    .filter((d) => d.exists)
    .map((d) => {
      const data = d.data()!;
      return {
        eleveId: d.id,
        classeId: String(data.classeId ?? ''),
        firebaseUid: (data.firebaseUid as string) || null,
        emailHash: (data.emailHash as string) || null,
      };
    })
    // Une des deux clés suffit — voir `copiesCorrigeesParUid`.
    .filter((e) => !!e.classeId && (!!e.firebaseUid || !!e.emailHash));
  if (eleves.length === 0) return [];

  // 2. Leurs classes — un parcours désigne les siennes par NOM
  const classeIds = [...new Set(eleves.map((e) => e.classeId))];
  const classes = new Map<string, { nom: string; profId: string }>();
  (await Promise.all(classeIds.map((id) => adminDb.collection('classes').doc(id).get()))).forEach(
    (d) => {
      if (!d.exists) return;
      const c = d.data()!;
      classes.set(d.id, { nom: String(c.nom ?? ''), profId: String(c.profId ?? '') });
    }
  );

  // 3. Les parcours des profs concernés
  const profIds = [...new Set([...classes.values()].map((c) => c.profId))].filter(Boolean);
  const scens = (
    await Promise.all(
      profIds.map(async (p) => {
        const snap = await adminDb.collection('scenarisations').where('profId', '==', p).get();
        return snap.docs.map((d) =>
          normaliserScenarisation({ id: d.id, ...d.data() } as Scenarisation)
        );
      })
    )
  ).flat();

  // 4. Les certifications non cotées rattachées à une activité
  const cibles = scens.flatMap((scen) =>
    certificationsDe(scen)
      .filter((c) => !estCotee(c.module))
      .map((c) => ({ scen, chapitreId: c.chapitreId, module: c.module, devoirId: devoirCertificatif(c.module) }))
      .filter((c): c is typeof c & { devoirId: string } => !!c.devoirId)
  );
  if (cibles.length === 0) return [];

  // 5. L'état des copies — une lecture par activité, même si deux
  //    certifications la partagent
  const etats = new Map<string, Map<string, string>>();
  await Promise.all(
    [...new Set(cibles.map((c) => c.devoirId))].map(async (devoirId) => {
      etats.set(devoirId, await copiesCorrigeesParUid(devoirId));
    })
  );

  // 6. Une note virtuelle par (certification, élève dont la copie est corrigée)
  const maintenant = new Date().toISOString();
  const out: NoteCertification[] = [];
  cibles.forEach(({ scen, chapitreId, module, devoirId }) => {
    const noms = scen.classes ?? [];
    eleves.forEach((e) => {
      const classe = classes.get(e.classeId);
      if (!classe || !noms.includes(classe.nom)) return;
      const corrigees = etats.get(devoirId);
      const date =
        (e.firebaseUid ? corrigees?.get(e.firebaseUid) : undefined) ??
        (e.emailHash ? corrigees?.get(e.emailHash) : undefined);
      if (date === undefined) return;
      out.push({
        id: noteId(module.id, e.eleveId),
        scenarisationId: scen.id,
        chapitreId,
        moduleId: module.id,
        eleveId: e.eleveId,
        profId: classe.profId,
        anneeScolaire: scen.anneeScolaire || '',
        percent: null,
        fait: true,
        date,
        updatedAt: maintenant,
      });
    });
  });
  return out;
}

export function buildLignes(
  eleves: EleveConcerne[],
  saisies: Map<string, NoteCertification>,
  autos: Map<string, number>,
  faitsAuto: Set<string> = new Set()
): LigneNoteCertification[] {
  return eleves.map((e) => ({
    eleveId: e.eleveId,
    nom: e.nom,
    prenom: e.prenom,
    classeId: e.classeId,
    classeNom: e.classeNom,
    percent: saisies.get(e.eleveId)?.percent ?? null,
    // Une certification non cotée est faite dès que la copie est corrigée —
    // la saisie du prof ne sert plus qu'aux élèves sans copie dans l'app.
    fait: saisies.get(e.eleveId)?.fait === true || faitsAuto.has(e.eleveId),
    faitAuto: faitsAuto.has(e.eleveId),
    commentaire: saisies.get(e.eleveId)?.commentaire ?? '',
    percentAuto: autos.get(e.eleveId) ?? null,
  }));
}

// La note retenue pour un élève : la saisie du prof, sinon celle de l'activité
export function noteRetenue(ligne: LigneNoteCertification): number | null {
  return ligne.percent ?? ligne.percentAuto;
}

// ─── Résumé d'une certification, pour les listes ───

export interface ResumeCertification {
  moduleId: string;
  chapitreId: string;
  chapitreTitre: string;
  scenarisationId: string;
  scenarisationNom: string;
  titre: string;
  uaa: string[];
  ceinture: string;
  ponderation: number;
  cotation: 'note' | 'fait';
  periodeAnnee: string;
  devoirId: string | null;
}

// Les libellés d'UAA — ceux que l'admin tient dans /admin, avec la liste du
// programme en repli si la configuration n'a jamais été ouverte.
export async function chargerLabelsUaa(): Promise<(uaa: string) => string> {
  const repli = new Map(UAA_LIST.map((u) => [String(u.id), u.label]));
  try {
    const doc = await adminDb.collection('configuration').doc('didactique').get();
    const items = (doc.data()?.uaa ?? []) as { id: string; label: string }[];
    items.forEach((u) => {
      if (u?.id && u?.label) repli.set(String(u.id), u.label);
    });
  } catch (error) {
    console.error('Erreur lecture configuration/didactique:', error);
  }
  return (uaa: string) => repli.get(uaa) ?? `UAA ${uaa}`;
}

// Le référentiel des UAA, dans l'ordre — celui que l'admin tient dans /admin,
// avec le programme en repli.
export async function chargerUaaReferentiel(): Promise<{ id: string; label: string }[]> {
  const repli = UAA_LIST.map((u) => ({ id: String(u.id), label: u.label }));
  try {
    const doc = await adminDb.collection('configuration').doc('didactique').get();
    const items = (doc.data()?.uaa ?? []) as { id: string; label: string; visible?: boolean }[];
    const visibles = items
      .filter((u) => u?.id && u?.label && u.visible !== false)
      .map((u) => ({ id: String(u.id), label: u.label }));
    if (visibles.length) return visibles;
  } catch (error) {
    console.error('Erreur lecture configuration/didactique:', error);
  }
  return repli;
}

// ─── La roue : TOUTES les UAA, toujours ───
//
// La ceinture blanche étant acquise dès l'entrée dans le parcours, aucune
// branche n'est jamais vide : la roue peut s'afficher dès le premier jour, et
// c'est même là qu'elle est le plus utile — elle annonce l'année à venir.
//
// C'est l'inverse du bloc du PROFIL, qui ne montre que les UAA effectivement
// certifiées : là, sept lignes de tableau vides n'apprendraient rien. Deux
// lectures, deux règles.
export function completerRoue(
  certifs: ProfilCertifications | null,
  referentiel: { id: string; label: string }[]
): UaaCertifiee[] {
  const parUaa = new Map((certifs?.uaa ?? []).map((u) => [u.uaa, u]));
  return referentiel.map(
    ({ id, label }) =>
      parUaa.get(id) ?? {
        uaa: id,
        label,
        percent: null,
        ceinture: CEINTURE_DEPART,
        badge: false,
        lignes: [],
        ponderationTotale: 0,
      }
  );
}

// ─── Le récapitulatif du profil élève ───
//
// Deux sources se croisent : les NOTES (collection `certificationsEleves`) et
// la DÉCLARATION de chaque certification (dans la scénarisation). Rien n'est
// recopié d'un côté à l'autre — une pondération corrigée après coup se
// répercute donc sur les profils déjà calculés.
//
// Règle : une certification qui vise deux UAA compte ENTIÈREMENT dans chacune,
// jamais divisée — c'est déjà la règle des habiletés dans l'onglet Lire.
export async function buildCertificationsProfil(
  eleveIds: string[],
  labelUaa: (uaa: string) => string
): Promise<ProfilCertifications | null> {
  if (eleveIds.length === 0) return null;

  // 1. Les notes de l'élève (lots de 30 : limite du `in` Firestore)
  const lots = Array.from({ length: Math.ceil(eleveIds.length / 30) }, (_, i) =>
    eleveIds.slice(i * 30, (i + 1) * 30)
  );
  const saisies: NoteCertification[] = (
    await Promise.all(
      lots.map(async (lot) => {
        const snap = await adminDb.collection(COLLECTION_NOTES).where('eleveId', 'in', lot).get();
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as NoteCertification);
      })
    )
  ).flat();

  // 1 bis. Les certifications « faites » déduites des copies corrigées. Une
  // saisie du prof sur la même certification l'emporte — elle est plus
  // ancienne et peut porter un commentaire.
  const dejaLa = new Set(saisies.map((n) => `${n.moduleId}|${n.eleveId}`));
  const notes = [
    ...saisies,
    ...(await notesFaitesAuto(eleveIds)).filter((a) => !dejaLa.has(`${a.moduleId}|${a.eleveId}`)),
  ];
  if (notes.length === 0) return null;

  // 2. Les scénarisations citées — chargées PAR ID, pas de jointure à faire
  const scenIds = [...new Set(notes.map((n) => n.scenarisationId))].filter(Boolean);
  const scens = new Map<string, Scenarisation>();
  await Promise.all(
    scenIds.map(async (id) => {
      const doc = await adminDb.collection('scenarisations').doc(id).get();
      if (doc.exists) {
        scens.set(id, normaliserScenarisation({ id: doc.id, ...doc.data() } as Scenarisation));
      }
    })
  );

  // 3. Chaque note retrouve sa déclaration, puis se range dans ses UAA
  const parUaa = new Map<string, LigneCertification[]>();
  const poids = new Map<string, number>();

  notes.forEach((note) => {
    const scen = scens.get(note.scenarisationId);
    if (!scen) return;
    const trouve = certificationsDe(scen).find((c) => c.module.id === note.moduleId);
    if (!trouve) return;

    const module = trouve.module;
    const cotee = estCotee(module);
    const ligne: LigneCertification = {
      moduleId: module.id,
      titre: module.titre || 'Certification',
      date: note.date || '',
      cotee,
      // Une certification non cotée n'a pas de pourcentage : elle est faite, ou
      // elle ne l'est pas. Lui prêter un 100 % gonflerait la moyenne de l'UAA.
      percent: cotee ? (note.percent ?? 0) : null,
      ponderation: ponderationDe(module),
      ceinture: module.ceinture || null,
      obtenue: cotee
        ? (note.percent ?? 0) >= SEUIL_CERTIFICATION
        : note.fait === true,
    };
    uaaCertifiees(module).forEach((u) => {
      parUaa.set(u, [...(parUaa.get(u) ?? []), ligne]);
      // Le total de référence est celui du PARCOURS, pas celui des seules
      // certifications déjà passées : c'est lui qui dit « il en reste ».
      if (!poids.has(`${scen.id}|${u}`)) poids.set(`${scen.id}|${u}`, ponderationUaa(scen, u));
    });
  });

  if (parUaa.size === 0) return null;

  const uaa: UaaCertifiee[] = [...parUaa.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
    .map(([id, lignes]) => {
      // Seules les certifications COTÉES font le pourcentage de l'UAA. Une UAA
      // dont toutes les certifications sont « faites » n'a donc pas de
      // pourcentage — et c'est juste : il n'y a rien à moyenner.
      const cotees = lignes.filter((l) => l.cotee);
      const sommePoids = cotees.reduce((s, l) => s + l.ponderation, 0);
      const percent =
        sommePoids > 0
          ? Math.round(
              cotees.reduce((s, l) => s + (l.percent ?? 0) * l.ponderation, 0) / sommePoids
            )
          : null;
      const ceinture = ceintureLaPlusHaute(
        lignes.filter((l) => l.obtenue).map((l) => l.ceinture)
      );
      const totale = [...poids.entries()]
        .filter(([cle]) => cle.endsWith(`|${id}`))
        .reduce((s, [, v]) => s + v, 0);
      return {
        uaa: id,
        label: labelUaa(id),
        percent,
        ceinture,
        badge: estEnReussite(ceinture),
        lignes: lignes.sort((a, b) => (a.date || '').localeCompare(b.date || '')),
        ponderationTotale: totale || sommePoids,
      };
    });

  return { uaa };
}

export function resumerCertifications(scen: Scenarisation): ResumeCertification[] {
  return certificationsDe(scen).map((c) => ({
    moduleId: c.module.id,
    chapitreId: c.chapitreId,
    chapitreTitre: c.chapitreTitre,
    scenarisationId: scen.id,
    scenarisationNom: scen.nom,
    titre: c.module.titre,
    uaa: uaaCertifiees(c.module),
    ceinture: c.module.ceinture || '',
    ponderation: ponderationDe(c.module),
    cotation: estCotee(c.module) ? ('note' as const) : ('fait' as const),
    periodeAnnee: c.module.periodeAnnee,
    devoirId: devoirCertificatif(c.module),
  }));
}
