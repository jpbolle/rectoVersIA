// Côté serveur des modules FLE : lecture d'un document Firestore, nettoyage
// de ce qui vient du client, nom du prof.

import { adminDb } from '@/lib/firebase/admin';
import type { ModuleFle } from '@/types/module-fle';
import type { DevoirRessource } from '@/types/devoir';

type Doc = FirebaseFirestore.DocumentSnapshot | FirebaseFirestore.QueryDocumentSnapshot;

function iso(v: unknown): string {
  const d = v as { toDate?: () => Date } | string | undefined;
  if (d && typeof d === 'object' && typeof d.toDate === 'function') return d.toDate().toISOString();
  return typeof d === 'string' ? d : '';
}

export function docToModuleFle(doc: Doc): ModuleFle {
  const data = doc.data() ?? {};
  return {
    id: doc.id,
    titre: typeof data.titre === 'string' ? data.titre : '',
    description: typeof data.description === 'string' ? data.description : '',
    type: typeof data.type === 'string' ? data.type : '',
    niveau: typeof data.niveau === 'string' ? data.niveau : '',
    competences: Array.isArray(data.competences)
      ? data.competences.filter((c: unknown): c is string => typeof c === 'string')
      : [],
    introduction: typeof data.introduction === 'string' ? data.introduction : '',
    ressources: data.ressources && typeof data.ressources === 'object' ? (data.ressources as DevoirRessource) : null,
    profId: typeof data.profId === 'string' ? data.profId : '',
    profName: typeof data.profName === 'string' ? data.profName : undefined,
    shared: data.shared === true,
    archive: data.archive === true,
    anneeScolaire: typeof data.anneeScolaire === 'string' ? data.anneeScolaire : '',
    createdAt: iso(data.createdAt),
    updatedAt: iso(data.updatedAt),
  };
}

// Liste d'ids bornée et dédoublonnée (compétences)
export function idsPourFirestore(input: unknown, max = 20): string[] {
  if (!Array.isArray(input)) return [];
  return [
    ...new Set(
      input
        .filter((x): x is string => typeof x === 'string')
        .map((x) => x.trim().slice(0, 60))
        .filter(Boolean)
    ),
  ].slice(0, max);
}

// « Prénom Nom » du prof connecté, à défaut son email — même repli que les œuvres
export async function nomDuProf(auth: { email: string }): Promise<string> {
  const profDoc = await adminDb.collection('professeurs').doc(auth.email.toLowerCase()).get();
  const profData = profDoc.exists ? profDoc.data() : null;
  return profData ? `${profData.prenom || ''} ${profData.nom || ''}`.trim() || auth.email : auth.email;
}
