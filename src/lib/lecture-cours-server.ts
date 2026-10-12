// Lectures de cours FLE — accès Firestore côté serveur. SERVEUR UNIQUEMENT.

import { adminDb } from '@/lib/firebase/admin';
import { accesClasseDepuisDoc } from '@/lib/classe-acces';
import { queryElevesByEmail } from '@/lib/eleve-lookup';
import { SECTIONS_ORDRE, sectionsVides } from '@/types/lecture-cours';
import type {
  DocumentCours,
  DocumentCoursResume,
  LectureCours,
  LectureCoursResume,
  SectionCle,
  SectionLecture,
} from '@/types/lecture-cours';

export const COLL_LECTURES = 'lecturesCours';
export const COLL_DOCUMENTS = 'documentsCours';

function toISO(v: unknown): string {
  if (!v) return '';
  const d = v as { toDate?: () => Date };
  if (typeof d.toDate === 'function') return d.toDate().toISOString();
  return typeof v === 'string' ? v : '';
}

export function genererIdLecture(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `LEC-${ymd}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export function genererIdDocument(): string {
  return genererIdLecture().replace(/^LEC-/, 'DOC-');
}

function lireSection(raw: unknown): SectionLecture {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const statut = r.statut;
  return {
    statut:
      statut === 'prete' || statut === 'en-cours' || statut === 'erreur' ? statut : 'a-faire',
    contenu: r.contenu ?? null,
    generatedAt: toISO(r.generatedAt) || null,
    erreur: typeof r.erreur === 'string' ? r.erreur : null,
    usage: (r.usage as SectionLecture['usage']) ?? null,
  };
}

export function lireLecture(id: string, data: FirebaseFirestore.DocumentData): LectureCours {
  const sections = sectionsVides();
  const brutes = (data.sections && typeof data.sections === 'object' ? data.sections : {}) as Record<
    string,
    unknown
  >;
  SECTIONS_ORDRE.forEach((cle) => {
    if (brutes[cle]) sections[cle] = lireSection(brutes[cle]);
  });
  return {
    id,
    eleveUid: String(data.eleveUid ?? ''),
    eleveId: String(data.eleveId ?? ''),
    classeId: String(data.classeId ?? ''),
    titre: String(data.titre ?? ''),
    source: data.source && typeof data.source === 'object' ? data.source : { type: 'texte' },
    texte: String(data.texte ?? ''),
    langue: String(data.langue ?? ''),
    niveau: String(data.niveau ?? ''),
    sections,
    reponses: data.reponses && typeof data.reponses === 'object' ? data.reponses : {},
    createdAt: toISO(data.createdAt),
    updatedAt: toISO(data.updatedAt),
  };
}

export function resumeLecture(l: LectureCours): LectureCoursResume {
  return {
    id: l.id,
    titre: l.titre,
    source: l.source,
    niveau: l.niveau,
    langue: l.langue,
    sectionsPretes: SECTIONS_ORDRE.filter((c) => l.sections[c].statut === 'prete').length,
    createdAt: l.createdAt,
  };
}

/**
 * La fiche `eleves` de l'élève connecté dans une classe FLE active (la
 * première trouvée), avec cette classe. null = pas de classe FLE : la lecture
 * de cours lui est fermée.
 */
export async function ficheFleDeLEleve(
  uid: string,
  email: string
): Promise<{ eleveId: string; classeId: string } | null> {
  const [parUid, parEmail] = await Promise.all([
    adminDb.collection('eleves').where('firebaseUid', '==', uid).get(),
    queryElevesByEmail(email),
  ]);
  const fiches = new Map<string, string>();
  [...parUid.docs, ...parEmail.docs].forEach((d) => {
    const c = d.data().classeId;
    if (c) fiches.set(d.id, c);
  });
  for (const [eleveId, classeId] of fiches) {
    const classe = await adminDb.collection('classes').doc(classeId).get();
    if (classe.exists && classe.data()?.type === 'fle' && classe.data()?.archive !== true) {
      return { eleveId, classeId };
    }
  }
  return null;
}

/** Un prof peut-il lire les lectures de cette fiche ? (titulaire ou coprofesseur) */
export async function profPeutLire(
  auth: { uid: string; email?: string | null },
  eleveId: string
): Promise<boolean> {
  const eleveDoc = await adminDb.collection('eleves').doc(eleveId).get();
  const classeId = eleveDoc.data()?.classeId as string | undefined;
  if (!eleveDoc.exists || !classeId) return false;
  const classeDoc = await adminDb.collection('classes').doc(classeId).get();
  return classeDoc.exists && !!accesClasseDepuisDoc(classeDoc.data(), auth);
}

export async function chargerLecture(id: string): Promise<LectureCours | null> {
  const doc = await adminDb.collection(COLL_LECTURES).doc(id).get();
  return doc.exists ? lireLecture(doc.id, doc.data()!) : null;
}

export async function lecturesDe(champ: 'eleveUid' | 'eleveId', valeur: string): Promise<LectureCoursResume[]> {
  // Pas d'orderBy : il imposerait un index composite ; la liste est courte
  const snap = await adminDb.collection(COLL_LECTURES).where(champ, '==', valeur).get();
  return snap.docs
    .map((d) => resumeLecture(lireLecture(d.id, d.data())))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function estSectionCle(v: string): v is SectionCle {
  return (SECTIONS_ORDRE as string[]).includes(v);
}

/**
 * Accès à une lecture : son auteur (élève) ou un prof de sa classe FLE.
 * Partagé par les routes de `/api/fle/lectures/[id]`.
 */
export async function accesLecture(
  auth: { uid: string; email: string; role: 'prof' | 'eleve' },
  id: string
): Promise<{ lecture: LectureCours | null; statut: number; message?: string }> {
  const lecture = await chargerLecture(id);
  if (!lecture) return { lecture: null, statut: 404, message: 'Lecture introuvable' };
  if (auth.role === 'eleve') {
    if (lecture.eleveUid !== auth.uid) return { lecture: null, statut: 403, message: 'Cette lecture n’est pas la tienne' };
    return { lecture, statut: 200 };
  }
  if (!(await profPeutLire(auth, lecture.eleveId))) {
    return { lecture: null, statut: 403, message: 'Cet élève n’est pas dans vos classes' };
  }
  return { lecture, statut: 200 };
}

// ── Mes documents ──

export function lireDocument(id: string, data: FirebaseFirestore.DocumentData): DocumentCours {
  return {
    id,
    eleveUid: String(data.eleveUid ?? ''),
    eleveId: String(data.eleveId ?? ''),
    titre: String(data.titre ?? ''),
    nomFichier: String(data.nomFichier ?? ''),
    pages: Number(data.pages ?? 0),
    octets: Number(data.octets ?? 0),
    driveFileId: typeof data.driveFileId === 'string' ? data.driveFileId : null,
    texte: String(data.texte ?? ''),
    createdAt: toISO(data.createdAt),
  };
}

export async function chargerDocument(id: string): Promise<DocumentCours | null> {
  const doc = await adminDb.collection(COLL_DOCUMENTS).doc(id).get();
  return doc.exists ? lireDocument(doc.id, doc.data()!) : null;
}

export async function documentsDe(eleveUid: string): Promise<DocumentCoursResume[]> {
  // Pas d'orderBy : il imposerait un index composite ; la liste est courte
  const snap = await adminDb.collection(COLL_DOCUMENTS).where('eleveUid', '==', eleveUid).get();
  return snap.docs
    .map((d) => {
      const x = lireDocument(d.id, d.data());
      return {
        id: x.id,
        titre: x.titre,
        nomFichier: x.nomFichier,
        pages: x.pages,
        createdAt: x.createdAt,
        conserve: !!x.driveFileId,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
