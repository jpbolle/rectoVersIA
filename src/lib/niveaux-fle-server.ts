// Positionnement CECR — lecture côté serveur, partagée entre /api/niveaux-fle
// et la lecture de cours FLE (2026-10-08). SERVEUR UNIQUEMENT.

import { adminDb } from '@/lib/firebase/admin';
import { decrypt } from '@/lib/crypto';
import { DEFAULT_DIDACTIQUE_FLE } from '@/types/didactique-fle';
import type { DidactiqueFleConfig, NiveauCecr } from '@/types/didactique-fle';
import { niveauGlobal } from '@/types/niveaux-fle';
import type { NiveauxFle } from '@/types/niveaux-fle';

export const COLL_NIVEAUX_FLE = 'niveauxFle';

export function lireNiveauxFle(id: string, data: FirebaseFirestore.DocumentData | undefined): NiveauxFle {
  return {
    eleveId: id,
    // Chiffrée en base (indice d'origine) ; '' si jamais posée
    langueMaternelle: decrypt(typeof data?.langueMaternelle === 'string' ? data.langueMaternelle : ''),
    positionnement:
      data?.positionnement && typeof data.positionnement === 'object' ? data.positionnement : {},
    objectifsMois: Array.isArray(data?.objectifsMois) ? data.objectifsMois : [],
    historique: Array.isArray(data?.historique) ? data.historique : [],
    updatedAt: data?.updatedAt?.toDate?.()?.toISOString?.() || data?.updatedAt || '',
  };
}

// Le document vide d'un élève jamais positionné
export function niveauxFleVides(eleveId: string): NiveauxFle {
  return { eleveId, langueMaternelle: '', positionnement: {}, objectifsMois: [], historique: [], updatedAt: '' };
}

// Le référentiel FLE en vigueur — pour ne pas enregistrer un id inconnu
export async function chargerReferentielFle(): Promise<DidactiqueFleConfig> {
  const doc = await adminDb.collection('configuration').doc('didactique-fle').get();
  const stored = doc.exists ? (doc.data() as Partial<DidactiqueFleConfig>) : {};
  return {
    competences: stored.competences?.length ? stored.competences : DEFAULT_DIDACTIQUE_FLE.competences,
    niveaux: stored.niveaux?.length ? stored.niveaux : DEFAULT_DIDACTIQUE_FLE.niveaux,
    descripteurs: stored.descripteurs ?? [],
    typesModule: stored.typesModule ?? DEFAULT_DIDACTIQUE_FLE.typesModule,
  };
}

// Le niveau global, déduit du radar avec le référentiel en vigueur — calculé
// ici pour que la fiche prof, la page /fle et la lecture de cours lisent la
// même valeur
export function niveauGlobalDe(
  niveaux: NiveauxFle,
  referentiel: DidactiqueFleConfig
): Pick<NiveauCecr, 'id' | 'label'> | null {
  const n = niveauGlobal(niveaux.positionnement, referentiel.niveaux);
  return n ? { id: n.id, label: n.label } : null;
}

/** Le profil linguistique d'une fiche élève : langue (code ou '') et niveau (id CECR ou null). */
export async function profilLinguistique(
  eleveId: string
): Promise<{ langue: string; niveau: string | null; niveauLabel: string | null }> {
  const [doc, referentiel] = await Promise.all([
    adminDb.collection(COLL_NIVEAUX_FLE).doc(eleveId).get(),
    chargerReferentielFle(),
  ]);
  const niveaux = doc.exists ? lireNiveauxFle(eleveId, doc.data()) : niveauxFleVides(eleveId);
  const global = niveauGlobalDe(niveaux, referentiel);
  return { langue: niveaux.langueMaternelle, niveau: global?.id ?? null, niveauLabel: global?.label ?? null };
}
