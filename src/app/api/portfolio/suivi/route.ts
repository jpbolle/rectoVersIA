import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { accesDevoir } from '@/lib/classe-acces';
import { poserAnnonce } from '@/lib/annonce-server';
import { lirePortfolioContenu } from '@/lib/portfolio-server';
import { groupeDe, profPeutGerer } from '@/lib/portfolio-groupe-server';
import { cibleSuivi, lireSuivi, retourPropre, suiviDe, valeurPropre } from '@/lib/portfolio-suivi-server';
import { identiteEleve, sequenceOuverteA } from '@/lib/sequence-server';
import { etatEtape, lireContenuEleve, prete, type EtapePortfolioVue } from '@/lib/portfolio-etat';
import { etapeASoumettre, type ValeurAttribuee } from '@/types/portfolio';
import type { EtatActiviteParcours } from '@/types/sequence-fle';

// Le SUIVI d'un portfolio (plan 2026-10-10-portfolio-validation-variables) :
//  GET   : l'élève lit le sien ; le prof celui d'un élève (`?eleve={uid}`)
//  POST  : l'élève SOUMET une étape au professeur (`{ devoirId, etapeId }`)
//  PATCH : le prof donne son RETOUR — ✓ / ✗, appréciation, commentaire,
//          valeurs attribuées (`{ devoirId, eleve, etapeId, decision, … }`)
// Un groupe accepté partage un seul suivi (voir `portfolio-suivi-server.ts`).

function etatDe(status: unknown): EtatActiviteParcours {
  if (status === 'submitted') return 'fait';
  if (status === 'draft') return 'en-cours';
  return 'a-faire';
}

async function devoirPortfolio(devoirId: string) {
  if (!devoirId) return null;
  const snap = await adminDb.collection('devoirs').doc(devoirId).get();
  if (!snap.exists || snap.data()?.typeTravail !== 'portfolio') return null;
  return { id: devoirId, ...snap.data()! } as { id: string; [k: string]: unknown };
}

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

  try {
    const params = request.nextUrl.searchParams;
    const devoirId = params.get('devoirId') || '';
    const devoir = await devoirPortfolio(devoirId);
    if (!devoir) return NextResponse.json({ success: false, message: 'Portfolio introuvable' }, { status: 404 });

    let uid = auth.uid;
    let email = auth.email;
    if (auth.role === 'prof') {
      if (!auth.isAdmin && !(await accesDevoir(devoirId, auth))) {
        return NextResponse.json({ success: false, message: 'Acces refuse' }, { status: 403 });
      }
      uid = params.get('eleve') || '';
      email = '';
      if (!uid) return NextResponse.json({ success: false, message: 'Élève manquant' }, { status: 400 });
    } else {
      const identite = await identiteEleve(auth.uid, auth.email);
      if (!(await sequenceOuverteA(devoir, identite))) {
        return NextResponse.json({ success: false, message: 'Devoir non disponible' }, { status: 403 });
      }
    }
    const cible = await cibleSuivi(devoirId, uid, email);
    const suivi = await suiviDe(cible.cle);
    return NextResponse.json({ success: true, data: { suivi, groupe: cible.groupeId !== null } });
  } catch (error) {
    console.error('Erreur GET /api/portfolio/suivi:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

/** L'élève soumet une étape au professeur. */
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  if (auth.role !== 'eleve') return NextResponse.json({ success: false, message: 'Réservé aux élèves' }, { status: 403 });

  try {
    const body = await request.json();
    const devoirId = typeof body.devoirId === 'string' ? body.devoirId : '';
    const etapeId = typeof body.etapeId === 'string' ? body.etapeId : '';
    const devoir = await devoirPortfolio(devoirId);
    if (!devoir) return NextResponse.json({ success: false, message: 'Portfolio introuvable' }, { status: 404 });
    const identite = await identiteEleve(auth.uid, auth.email);
    if (!(await sequenceOuverteA(devoir, identite))) {
      return NextResponse.json({ success: false, message: 'Devoir non disponible' }, { status: 403 });
    }

    const etape = lirePortfolioContenu(devoir.portfolio).etapes.find((e) => e.id === etapeId);
    if (!etape || !etapeASoumettre(etape)) {
      return NextResponse.json({ success: false, message: 'Cette étape ne se soumet pas' }, { status: 400 });
    }

    // L'étape doit être PRÊTE — vérifié ici, pas seulement à l'écran
    const travailId = `TRV-${devoirId}-${auth.uid}`;
    const travail = await adminDb.collection('travaux').doc(travailId).get();
    const groupe = identite.eleveIds.length > 0 ? await groupeDe(devoirId, identite.eleveIds) : null;
    const vue: EtapePortfolioVue = { ...etape };
    if (etape.nature === 'activite' && etape.devoirId) {
      const copie = await adminDb.collection('travaux').doc(`TRV-${etape.devoirId}-${auth.uid}`).get();
      vue.etatRenvoi = copie.exists ? etatDe(copie.data()?.status) : 'a-faire';
    }
    const cible = await cibleSuivi(devoirId, auth.uid, auth.email);
    const ref = adminDb.collection('portfolioSuivi').doc(cible.cle);

    const resultat = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const suivi = snap.exists ? lireSuivi(snap.data()) : lireSuivi({});
      const contenu = {
        ...lireContenuEleve(typeof travail.data()?.content === 'string' ? travail.data()!.content : ''),
        groupeStatut: groupe?.statut ?? null,
        suivi,
      };
      const etat = etatEtape(vue, contenu);
      // On soumet une étape prête, ou une étape refusée qu'on a reprise
      if (etat !== 'prete' && etat !== 'a-reprendre') return { ok: false as const, etat };
      if (!prete(vue, contenu)) return { ok: false as const, etat: 'en-cours' as const };
      const n = (suivi.soumissions[etapeId]?.n ?? 0) + 1;
      tx.set(
        ref,
        {
          devoirId,
          groupeId: cible.groupeId,
          soumissions: { [etapeId]: { date: new Date().toISOString(), n } },
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      return { ok: true as const, n };
    });

    if (!resultat.ok) {
      return NextResponse.json(
        { success: false, message: resultat.etat === 'en-cours' ? 'L’étape n’est pas terminée' : 'L’étape est déjà soumise' },
        { status: 409 }
      );
    }

    // Le prof est prévenu (cloche). Pas de nom d'élève dans la notification :
    // la collection `annonces` ne porte aucune identité d'élève (RGPD).
    try {
      const profId = typeof devoir.profId === 'string' ? devoir.profId : '';
      const prof = profId ? await adminAuth.getUser(profId) : null;
      if (prof?.email) {
        await poserAnnonce({
          message: `${resultat.n > 1 ? 'Étape soumise à nouveau' : 'Étape soumise'} : « ${etape.titre} » — ${String(devoir.intitule || 'portfolio')}`,
          cible: 'collegue',
          destinataireEmail: prof.email,
          auteurUid: auth.uid,
          lien: `/dashboard/travaux/${devoirId}/${travailId}`,
          etiquette: '🗂️ Portfolio — à valider',
        });
      }
    } catch (e) {
      console.error('Notification de soumission non écrite:', e);
    }

    return NextResponse.json({ success: true, data: await suiviDe(cible.cle) });
  } catch (error) {
    console.error('Erreur POST /api/portfolio/suivi:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

/** Le prof donne son retour sur une étape (et attribue des valeurs). */
export async function PATCH(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  if (auth.role !== 'prof') return NextResponse.json({ success: false, message: 'Acces refuse' }, { status: 403 });

  try {
    const body = await request.json();
    const devoirId = typeof body.devoirId === 'string' ? body.devoirId : '';
    const eleve = typeof body.eleve === 'string' ? body.eleve : '';
    const etapeId = typeof body.etapeId === 'string' ? body.etapeId : '';
    const devoir = await devoirPortfolio(devoirId);
    if (!devoir || !eleve) return NextResponse.json({ success: false, message: 'Requête incomplète' }, { status: 400 });
    if (!(await profPeutGerer(devoirId, auth))) {
      return NextResponse.json({ success: false, message: 'Acces refuse' }, { status: 403 });
    }
    const etape = lirePortfolioContenu(devoir.portfolio).etapes.find((e) => e.id === etapeId);
    if (!etape) return NextResponse.json({ success: false, message: 'Étape introuvable' }, { status: 404 });

    // Seules les valeurs DÉCLARÉES par cette étape, du genre déclaré
    const declarees = new Map((etape.validation?.attribue ?? []).map((v) => [v.id, v]));
    const valeurs: Record<string, ValeurAttribuee | null> = {};
    for (const [id, brut] of Object.entries(body.valeurs && typeof body.valeurs === 'object' ? body.valeurs : {})) {
      const declaree = declarees.get(id);
      if (!declaree) continue;
      const propre = brut === null ? null : valeurPropre({ ...(brut as object), genre: declaree.genre });
      valeurs[id] = propre;
    }

    const cible = await cibleSuivi(devoirId, eleve);
    const ref = adminDb.collection('portfolioSuivi').doc(cible.cle);
    let decision: 'valide' | 'refuse' | null = null;
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const suivi = snap.exists ? lireSuivi(snap.data()) : lireSuivi({});
      const maintenant = new Date().toISOString();
      // Un retour donné sans soumission vaut soumission (le prof a vu le travail)
      const soumission = suivi.soumissions[etapeId] ?? { date: maintenant, n: 1 };
      const retour = retourPropre(body, soumission.n);
      if (!retour) throw new Error('decision');
      decision = retour.decision;
      const valeursSuivantes = { ...suivi.valeurs };
      for (const [id, v] of Object.entries(valeurs)) {
        if (v) valeursSuivantes[id] = v;
        else delete valeursSuivantes[id];
      }
      tx.set(
        ref,
        {
          devoirId,
          groupeId: cible.groupeId,
          soumissions: { ...suivi.soumissions, [etapeId]: soumission },
          retours: { ...suivi.retours, [etapeId]: retour },
          valeurs: valeursSuivantes,
          updatedAt: maintenant,
        },
        { merge: false }
      );
    });

    // Chaque membre du groupe est prévenu (cloche)
    await Promise.all(
      cible.uids.map((uid) =>
        poserAnnonce({
          message:
            decision === 'valide'
              ? `Ton professeur a validé l’étape « ${etape.titre} ».`
              : `Ton professeur te demande de reprendre l’étape « ${etape.titre} ».`,
          cible: 'eleve',
          destinataireUid: uid,
          auteurUid: auth.uid,
          lien: `/activites/${devoirId}`,
          ton: decision === 'valide' ? 'felicitation' : 'rappel',
          etiquette: '🗂️ Portfolio',
        })
      )
    );

    return NextResponse.json({ success: true, data: await suiviDe(cible.cle) });
  } catch (error) {
    if (error instanceof Error && error.message === 'decision') {
      return NextResponse.json({ success: false, message: 'Décision manquante (valider ou refuser)' }, { status: 400 });
    }
    console.error('Erreur PATCH /api/portfolio/suivi:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
