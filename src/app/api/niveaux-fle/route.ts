import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { decryptFields, SENSITIVE_ELEVE_FIELDS } from '@/lib/crypto';
import { queryElevesByEmail } from '@/lib/eleve-lookup';
import { DEFAULT_DIDACTIQUE_FLE } from '@/types/didactique-fle';
import type { DidactiqueFleConfig } from '@/types/didactique-fle';
import { HISTORIQUE_MAX } from '@/types/niveaux-fle';
import type { NiveauxFle, ObjectifMois } from '@/types/niveaux-fle';

// Positionnement CECR d'un élève FLE (document niveauxFle/{eleveId}).
//
//  GET ?eleveId=   — un prof lit la fiche d'un de SES élèves
//  GET             — l'élève connecté lit son propre positionnement (+ prénom)
//  PUT             — un prof règle les curseurs / les objectifs du mois
//
// Même garde que /api/profil/* : l'élève doit appartenir à une classe du prof.

const COLL = 'niveauxFle';

function lire(id: string, data: FirebaseFirestore.DocumentData | undefined): NiveauxFle {
  return {
    eleveId: id,
    positionnement:
      data?.positionnement && typeof data.positionnement === 'object' ? data.positionnement : {},
    objectifsMois: Array.isArray(data?.objectifsMois) ? data.objectifsMois : [],
    historique: Array.isArray(data?.historique) ? data.historique : [],
    updatedAt: data?.updatedAt?.toDate?.()?.toISOString?.() || data?.updatedAt || '',
  };
}

// Le document vide d'un élève jamais positionné
function vide(eleveId: string): NiveauxFle {
  return { eleveId, positionnement: {}, objectifsMois: [], historique: [], updatedAt: '' };
}

// L'élève appartient-il à une classe de ce prof ? Renvoie la classe ou null.
async function classeDuProf(eleveId: string, profUid: string) {
  const eleveDoc = await adminDb.collection('eleves').doc(eleveId).get();
  if (!eleveDoc.exists) return null;
  const classeId = eleveDoc.data()?.classeId as string | undefined;
  if (!classeId) return null;
  const classeDoc = await adminDb.collection('classes').doc(classeId).get();
  if (!classeDoc.exists || classeDoc.data()?.profId !== profUid) return null;
  return classeDoc;
}

// Le référentiel FLE en vigueur — pour ne pas enregistrer un id inconnu
async function chargerReferentiel(): Promise<DidactiqueFleConfig> {
  const doc = await adminDb.collection('configuration').doc('didactique-fle').get();
  const stored = doc.exists ? (doc.data() as Partial<DidactiqueFleConfig>) : {};
  return {
    competences: stored.competences?.length ? stored.competences : DEFAULT_DIDACTIQUE_FLE.competences,
    niveaux: stored.niveaux?.length ? stored.niveaux : DEFAULT_DIDACTIQUE_FLE.niveaux,
    descripteurs: stored.descripteurs ?? [],
    typesModule: stored.typesModule ?? DEFAULT_DIDACTIQUE_FLE.typesModule,
  };
}

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 });

  const eleveId = new URL(request.url).searchParams.get('eleveId');

  try {
    // ── Un prof consulte un de ses élèves ──
    if (eleveId) {
      if (auth.role !== 'prof') {
        return NextResponse.json({ success: false, message: 'Accès réservé aux professeurs' }, { status: 403 });
      }
      const classe = await classeDuProf(eleveId, auth.uid);
      if (!classe) {
        return NextResponse.json({ success: false, message: 'Cet élève n’est pas dans vos classes' }, { status: 403 });
      }
      const doc = await adminDb.collection(COLL).doc(eleveId).get();
      return NextResponse.json({
        success: true,
        data: { niveaux: doc.exists ? lire(eleveId, doc.data()) : vide(eleveId), prenom: '' },
      });
    }

    // ── L'élève connecté lit son positionnement ──
    const [parUid, parEmail] = await Promise.all([
      adminDb.collection('eleves').where('firebaseUid', '==', auth.uid).get(),
      queryElevesByEmail(auth.email || ''),
    ]);
    const uniques = new Map([...parUid.docs, ...parEmail.docs].map((d) => [d.id, d]));
    if (uniques.size === 0) {
      return NextResponse.json({ success: true, data: { niveaux: null, prenom: '' } });
    }
    const premier = decryptFields([...uniques.values()][0].data(), SENSITIVE_ELEVE_FIELDS);
    const prenom = (premier.prenom as string) || '';

    // Plusieurs fiches élève (plusieurs classes) : le positionnement le plus récent
    const docs = await Promise.all(
      [...uniques.keys()].map((id) => adminDb.collection(COLL).doc(id).get())
    );
    const existants = docs.filter((d) => d.exists).map((d) => lire(d.id, d.data()));
    existants.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    const niveaux = existants[0] ?? vide([...uniques.keys()][0]);

    return NextResponse.json({ success: true, data: { niveaux, prenom } });
  } catch (error) {
    console.error('Erreur GET /api/niveaux-fle:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

// Nettoie les objectifs du mois : un texte par mois, borné
function sanitizeObjectifs(input: unknown): ObjectifMois[] {
  if (!Array.isArray(input)) return [];
  const vus = new Set<string>();
  const out: ObjectifMois[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const mois = typeof item.mois === 'string' && /^\d{4}-\d{2}$/.test(item.mois) ? item.mois : '';
    const texte = typeof item.texte === 'string' ? item.texte.trim().slice(0, 2000) : '';
    if (!mois || vus.has(mois)) continue;
    vus.add(mois);
    out.push({ mois, texte });
  }
  // Du plus récent au plus ancien ; un mois vidé disparaît
  return out.filter((o) => o.texte).sort((a, b) => b.mois.localeCompare(a.mois));
}

export async function PUT(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 });
  if (auth.role !== 'prof') {
    return NextResponse.json({ success: false, message: 'Accès réservé aux professeurs' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const eleveId = typeof body?.eleveId === 'string' ? body.eleveId : '';
    if (!eleveId) {
      return NextResponse.json({ success: false, message: 'eleveId requis' }, { status: 400 });
    }
    const classe = await classeDuProf(eleveId, auth.uid);
    if (!classe) {
      return NextResponse.json({ success: false, message: 'Cet élève n’est pas dans vos classes' }, { status: 403 });
    }

    const ref = adminDb.collection(COLL).doc(eleveId);
    const [doc, referentiel] = await Promise.all([ref.get(), chargerReferentiel()]);
    const actuel = doc.exists ? lire(eleveId, doc.data()) : vide(eleveId);

    // Positionnement : seules les paires (compétence connue, niveau connu) passent
    let positionnement = actuel.positionnement;
    if (body.positionnement && typeof body.positionnement === 'object') {
      const competences = new Set(referentiel.competences.map((c) => c.id));
      const niveaux = new Set(referentiel.niveaux.map((n) => n.id));
      positionnement = {};
      for (const [comp, niv] of Object.entries(body.positionnement as Record<string, unknown>)) {
        if (competences.has(comp) && typeof niv === 'string' && niveaux.has(niv)) {
          positionnement[comp] = niv;
        }
      }
    }

    const objectifsMois =
      body.objectifsMois !== undefined ? sanitizeObjectifs(body.objectifsMois) : actuel.objectifsMois;

    // L'historique ne bouge que si les curseurs ont bougé
    const aChange = JSON.stringify(positionnement) !== JSON.stringify(actuel.positionnement);
    const historique = aChange
      ? [
          { date: new Date().toISOString(), positionnement: actuel.positionnement },
          ...actuel.historique,
        ].slice(0, HISTORIQUE_MAX)
      : actuel.historique;

    const now = new Date();
    const suivant: NiveauxFle = {
      eleveId,
      positionnement,
      objectifsMois,
      historique,
      updatedAt: now.toISOString(),
    };
    await ref.set({ ...suivant, profId: auth.uid, updatedAt: now });

    return NextResponse.json({ success: true, data: { niveaux: suivant } });
  } catch (error) {
    console.error('Erreur PUT /api/niveaux-fle:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
