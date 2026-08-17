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

  const snap = await adminDb.collection('corrections').where('devoirId', '==', devoirId).get();
  const parUid = new Map<string, number>();
  snap.docs.forEach((d) => {
    const data = d.data();
    if (typeof data.score === 'number') parUid.set(data.studentId, data.score);
  });

  eleves.forEach((e) => {
    if (!e.firebaseUid) return;
    const score = parUid.get(e.firebaseUid);
    if (typeof score === 'number') out.set(e.eleveId, Math.round(score));
  });
  return out;
}

export function buildLignes(
  eleves: EleveConcerne[],
  saisies: Map<string, NoteCertification>,
  autos: Map<string, number>
): LigneNoteCertification[] {
  return eleves.map((e) => ({
    eleveId: e.eleveId,
    nom: e.nom,
    prenom: e.prenom,
    classeId: e.classeId,
    classeNom: e.classeNom,
    percent: saisies.get(e.eleveId)?.percent ?? null,
    fait: saisies.get(e.eleveId)?.fait === true,
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
  const notes: NoteCertification[] = (
    await Promise.all(
      lots.map(async (lot) => {
        const snap = await adminDb.collection(COLLECTION_NOTES).where('eleveId', 'in', lot).get();
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as NoteCertification);
      })
    )
  ).flat();
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
