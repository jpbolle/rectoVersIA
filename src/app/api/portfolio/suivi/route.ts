import { NextRequest, NextResponse } from 'next/server';
import { generateTravailId } from '@/lib/travail-utils';
import { rouvrirEcriture } from '@/lib/ecriture-groupe-server';
import { adminDb } from '@/lib/firebase/admin';
import { soumettreEtape } from '@/lib/portfolio-activite-server';
import { verifyAuth } from '@/lib/api-auth';
import { accesDevoir } from '@/lib/classe-acces';
import { poserAnnonce } from '@/lib/annonce-server';
import { lirePortfolioContenu } from '@/lib/portfolio-server';
import { profPeutGerer } from '@/lib/portfolio-groupe-server';
import { cibleSuivi, lireSuivi, retourPropre, suiviDe, valeurPropre } from '@/lib/portfolio-suivi-server';
import { identiteEleve, sequenceOuverteA } from '@/lib/sequence-server';
import type { ValeurAttribuee } from '@/types/portfolio';

// Le SUIVI d'un portfolio (plan 2026-10-10-portfolio-validation-variables) :
//  GET   : l'élève lit le sien ; le prof celui d'un élève (`?eleve={uid}`)
//  POST  : l'élève SOUMET une étape au professeur (`{ devoirId, etapeId }`)
//  PATCH : le prof donne son RETOUR — ✓ / ✗, appréciation, commentaire,
//          valeurs attribuées (`{ devoirId, eleve, etapeId, decision, … }`)
// Un groupe accepté partage un seul suivi (voir `portfolio-suivi-server.ts`).

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

    const resultat = await soumettreEtape(devoir, etapeId, auth, identite);
    if (!resultat.ok) {
      if (resultat.raison === 'non-soumissible') {
        return NextResponse.json({ success: false, message: 'Cette étape ne se soumet pas' }, { status: 400 });
      }
      return NextResponse.json(
        { success: false, message: resultat.raison === 'pas-prete' ? 'L’étape n’est pas terminée' : 'L’étape est déjà soumise' },
        { status: 409 }
      );
    }

    const cible = await cibleSuivi(devoirId, auth.uid, auth.email);
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
      // Un retour répond à une soumission de l'élève (JP, 2026-10-11). Sauf le
      // « + Nouveau retour » du prof (`nouveau: true`) — l'élève a fait le
      // travail mais oublié de soumettre : ce retour VAUT soumission, il en
      // ouvre une nouvelle (et s'ajoute donc à l'historique).
      const soumission =
        body.nouveau === true
          ? { date: maintenant, n: (suivi.soumissions[etapeId]?.n ?? 0) + 1 }
          : suivi.soumissions[etapeId];
      if (!soumission) throw new Error('non-soumise');
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
          // L'HISTORIQUE (JP, 2026-10-11) : un retour par soumission. Le prof qui
          // retouche son retour sur la MÊME soumission le remplace (pas de faux
          // refus en double) ; une nouvelle soumission en ajoute un.
          historique: {
            ...suivi.historique,
            [etapeId]: (() => {
              const avant = suivi.historique[etapeId] ?? [];
              const dernier = avant[avant.length - 1];
              const suite = dernier && dernier.soumissionN === retour.soumissionN ? [...avant.slice(0, -1), retour] : [...avant, retour];
              return suite.slice(-40);
            })(),
          },
          valeurs: valeursSuivantes,
          updatedAt: maintenant,
        },
        { merge: false }
      );
    });

    // PASSERELLE RETOUR (JP, 2026-10-11) : une étape-ACTIVITÉ refusée rouvre la
    // copie de l'activité, chez chaque membre — sans quoi l'élève retrouvait sa
    // copie « remise », éditeur fermé, sans pouvoir reprendre. Sa nouvelle
    // remise soumettra l'étape à nouveau (passerelle aller).
    if (decision === 'refuse' && etape.nature === 'activite' && etape.devoirId) {
      try {
        const copies = await adminDb.getAll(
          ...cible.uids.map((uid) => adminDb.collection('travaux').doc(generateTravailId(etape.devoirId!, uid)))
        );
        const lot = adminDb.batch();
        let n = 0;
        copies.forEach((c) => {
          if (!c.exists || c.data()?.status !== 'submitted') return;
          lot.update(c.ref, { status: 'draft', submittedAt: null, verrouille: false, updatedAt: new Date().toISOString() });
          n++;
        });
        if (n > 0) await lot.commit();
        // Copie de groupe : le texte commun redevient modifiable
        const cle = copies.find((c) => c.exists && typeof c.data()?.groupeEcriture === 'string')?.data()?.groupeEcriture;
        if (cle) await rouvrirEcriture(cle);
      } catch (e) {
        console.error('Réouverture de la copie de l’activité refusée :', e);
      }
    }

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
    if (error instanceof Error && error.message === 'non-soumise') {
      return NextResponse.json({ success: false, message: 'L’élève n’a pas encore soumis cette étape' }, { status: 409 });
    }
    if (error instanceof Error && error.message === 'decision') {
      return NextResponse.json({ success: false, message: 'Décision manquante (valider ou refuser)' }, { status: 400 });
    }
    console.error('Erreur PATCH /api/portfolio/suivi:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
