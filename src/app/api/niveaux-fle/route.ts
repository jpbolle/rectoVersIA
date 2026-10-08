import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { accesClasseDepuisDoc, peutAgir } from '@/lib/classe-acces';
import { decrypt, decryptFields, encrypt, SENSITIVE_ELEVE_FIELDS } from '@/lib/crypto';
import {
  COLL_NIVEAUX_FLE as COLL,
  chargerReferentielFle as chargerReferentiel,
  lireNiveauxFle as lire,
  niveauGlobalDe as globalDe,
  niveauxFleVides as vide,
} from '@/lib/niveaux-fle-server';
import { queryElevesByEmail, uidParEmail } from '@/lib/eleve-lookup';
import { COLL_FLE } from '@/lib/daspalecte/mots';
import type { MotPersonnel } from '@/lib/daspalecte/mots';
import { HISTORIQUE_MAX, estLangueConnue } from '@/types/niveaux-fle';
import type { NiveauxFle, ObjectifMois } from '@/types/niveaux-fle';

// Positionnement CECR d'un élève FLE (document niveauxFle/{eleveId}).
//
//  GET ?eleveId=   — un prof lit la fiche d'un de SES élèves
//  GET             — l'élève connecté lit son propre positionnement (+ prénom)
//  PUT             — un prof règle les curseurs / les objectifs du mois
//
// Même garde que /api/profil/* : l'élève doit appartenir à une classe du prof.

// Langue suggérée quand aucune n'est posée : la plus fréquente parmi les mots
// que l'élève a cliqués dans l'extension Daspalecte (chacun porte sa langue)
async function langueSuggeree(eleve: { firebaseUid?: string; email?: string }): Promise<string> {
  try {
    const uid = eleve.firebaseUid || (await uidParEmail(decrypt(eleve.email)));
    if (!uid) return '';
    const doc = await adminDb.collection(COLL_FLE).doc(uid).get();
    const mots: MotPersonnel[] = Array.isArray(doc.data()?.words) ? doc.data()!.words : [];
    const compte = new Map<string, number>();
    mots.forEach((m) => {
      if (estLangueConnue(m.langue)) compte.set(m.langue, (compte.get(m.langue) ?? 0) + 1);
    });
    return [...compte.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  } catch {
    return '';
  }
}

// L'élève appartient-il à une classe de ce prof ? Renvoie la classe ou null.
// Depuis le 2026-10-04 : titulaire, ou coprofesseur — en écriture seulement
// quand `ecrire` est demandé (régler les curseurs).
async function classeDuProf(
  eleveId: string,
  auth: { uid: string; email?: string | null },
  ecrire = false
) {
  const eleveDoc = await adminDb.collection('eleves').doc(eleveId).get();
  if (!eleveDoc.exists) return null;
  const classeId = eleveDoc.data()?.classeId as string | undefined;
  if (!classeId) return null;
  const classeDoc = await adminDb.collection('classes').doc(classeId).get();
  const acces = classeDoc.exists ? accesClasseDepuisDoc(classeDoc.data(), auth) : null;
  if (!acces || (ecrire && !peutAgir(acces))) return null;
  return classeDoc;
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
      const classe = await classeDuProf(eleveId, auth);
      if (!classe) {
        return NextResponse.json({ success: false, message: 'Cet élève n’est pas dans vos classes' }, { status: 403 });
      }
      const [doc, referentiel, eleveDoc] = await Promise.all([
        adminDb.collection(COLL).doc(eleveId).get(),
        chargerReferentiel(),
        adminDb.collection('eleves').doc(eleveId).get(),
      ]);
      const niveaux = doc.exists ? lire(eleveId, doc.data()) : vide(eleveId);
      const suggestion = niveaux.langueMaternelle ? '' : await langueSuggeree(eleveDoc.data() ?? {});
      return NextResponse.json({
        success: true,
        data: {
          niveaux,
          niveauGlobal: globalDe(niveaux, referentiel),
          langueSuggeree: suggestion,
          prenom: '',
        },
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
    const referentiel = await chargerReferentiel();

    return NextResponse.json({
      success: true,
      data: { niveaux, niveauGlobal: globalDe(niveaux, referentiel), prenom },
    });
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
    const classe = await classeDuProf(eleveId, auth, true);
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

    // Langue maternelle : un code connu, ou '' pour effacer ; absent = inchangé
    let langueMaternelle = actuel.langueMaternelle;
    if (body.langueMaternelle !== undefined) {
      langueMaternelle = estLangueConnue(body.langueMaternelle) ? body.langueMaternelle : '';
    }

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
      langueMaternelle,
      positionnement,
      objectifsMois,
      historique,
      updatedAt: now.toISOString(),
    };
    await ref.set({
      ...suivant,
      langueMaternelle: encrypt(langueMaternelle),
      profId: auth.uid,
      updatedAt: now,
    });

    return NextResponse.json({
      success: true,
      data: { niveaux: suivant, niveauGlobal: globalDe(suivant, referentiel) },
    });
  } catch (error) {
    console.error('Erreur PUT /api/niveaux-fle:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
