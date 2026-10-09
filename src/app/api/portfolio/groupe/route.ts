import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { identiteEleve, sequenceOuverteA } from '@/lib/sequence-server';
import {
  camaradesDe,
  docToGroupe,
  fichesParId,
  groupeDe,
  groupeVue,
  groupesDe,
  profPeutGerer,
} from '@/lib/portfolio-groupe-server';
import { generateGroupeId } from '@/types/portfolio';

// LE GROUPE d'un portfolio (dépôt de type « groupe »).
//  GET   ?devoirId=  élève : ses camarades + son groupe ; prof : tous les groupes
//  POST  { devoirId, membres: eleveId[] }  élève : déclare son groupe (lui + partenaires)
//  PATCH { groupeId, action }  élève : confirmer | decliner | quitter
//                              prof  : accepter | refuser (+ motif)
// Accès serveur uniquement : aucune règle Firestore.

const TAILLE_MAX = 8;

async function devoirOuvert(devoirId: string, auth: { uid: string; email: string }) {
  const snap = await adminDb.collection('devoirs').doc(devoirId).get();
  if (!snap.exists) return null;
  const data = snap.data()!;
  if (data.typeTravail !== 'portfolio') return null;
  const identite = await identiteEleve(auth.uid, auth.email);
  if (!(await sequenceOuverteA({ id: devoirId, ...data }, identite))) return null;
  return { data, identite };
}

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  const devoirId = request.nextUrl.searchParams.get('devoirId') ?? '';
  if (!devoirId) return NextResponse.json({ success: false, message: 'devoirId requis' }, { status: 400 });

  try {
    if (auth.role === 'eleve') {
      const ctx = await devoirOuvert(devoirId, auth);
      if (!ctx) return NextResponse.json({ success: false, message: 'Devoir non disponible' }, { status: 403 });
      const { camarades, mesFiches } = await camaradesDe(ctx.data, ctx.identite);
      const g = await groupeDe(devoirId, mesFiches);
      return NextResponse.json({
        success: true,
        data: { camarades, groupe: g ? await groupeVue(g, { mesEleveIds: mesFiches }) : null },
      });
    }
    if (auth.role !== 'prof' || !(await profPeutGerer(devoirId, auth))) {
      return NextResponse.json({ success: false, message: 'Acces refuse' }, { status: 403 });
    }
    const groupes = await groupesDe(devoirId);
    const fiches = await fichesParId(groupes.flatMap((g) => g.membres.map((m) => m.eleveId)));
    const vues = await Promise.all(groupes.map((g) => groupeVue(g, { nomsComplets: true, fiches })));
    return NextResponse.json({ success: true, data: { groupes: vues } });
  } catch (error) {
    console.error('Erreur GET /api/portfolio/groupe:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  if (auth.role !== 'eleve') return NextResponse.json({ success: false, message: 'Réservé aux élèves' }, { status: 403 });

  try {
    const body = await request.json();
    const devoirId = typeof body.devoirId === 'string' ? body.devoirId : '';
    const demandes: string[] = Array.isArray(body.membres)
      ? [...new Set((body.membres as unknown[]).filter((m): m is string => typeof m === 'string' && m.trim() !== ''))]
      : [];
    if (!devoirId) return NextResponse.json({ success: false, message: 'devoirId requis' }, { status: 400 });
    if (demandes.length === 0) {
      return NextResponse.json({ success: false, message: 'Choisis au moins un partenaire' }, { status: 400 });
    }
    const ctx = await devoirOuvert(devoirId, auth);
    if (!ctx) return NextResponse.json({ success: false, message: 'Devoir non disponible' }, { status: 403 });

    // Seuls des camarades de l'activité peuvent être invités
    const { camarades, mesFiches } = await camaradesDe(ctx.data, ctx.identite);
    const autorises = new Set(camarades.map((c) => c.eleveId));
    const partenaires = demandes.filter((id) => autorises.has(id));
    if (partenaires.length === 0) {
      return NextResponse.json({ success: false, message: 'Ces élèves ne sont pas dans tes classes' }, { status: 400 });
    }
    if (partenaires.length + 1 > TAILLE_MAX) {
      return NextResponse.json({ success: false, message: `Un groupe compte ${TAILLE_MAX} élèves au plus` }, { status: 400 });
    }
    const moi = mesFiches[0];
    if (!moi) return NextResponse.json({ success: false, message: 'Fiche élève introuvable' }, { status: 403 });

    // Pas de double appartenance : ni moi ni un partenaire dans un groupe déjà accepté
    const existants = await groupesDe(devoirId);
    const pris = new Set(
      existants.filter((g) => g.statut === 'accepte').flatMap((g) => g.membres.map((m) => m.eleveId))
    );
    if (pris.has(moi)) return NextResponse.json({ success: false, message: 'Tu es déjà dans un groupe accepté' }, { status: 400 });
    const dejaPris = partenaires.filter((p) => pris.has(p));
    if (dejaPris.length > 0) {
      return NextResponse.json({ success: false, message: 'Un partenaire est déjà dans un groupe accepté' }, { status: 400 });
    }

    // Mon groupe en attente ou refusé : remplacé par la nouvelle déclaration
    const lot = adminDb.batch();
    existants
      .filter((g) => g.statut !== 'accepte' && g.membres.some((m) => mesFiches.includes(m.eleveId)))
      .forEach((g) => lot.delete(adminDb.collection('portfolioGroupes').doc(g.id)));

    const id = generateGroupeId();
    const now = new Date().toISOString();
    const doc = {
      id,
      devoirId,
      createurEleveId: moi,
      membres: [{ eleveId: moi, statut: 'confirme' }, ...partenaires.map((p) => ({ eleveId: p, statut: 'attente' }))],
      statut: 'attente',
      motif: '',
      createdAt: now,
      updatedAt: now,
    };
    lot.set(adminDb.collection('portfolioGroupes').doc(id), doc);
    await lot.commit();
    const snap = await adminDb.collection('portfolioGroupes').doc(id).get();
    return NextResponse.json({ success: true, data: await groupeVue(docToGroupe(snap), { mesEleveIds: mesFiches }) });
  } catch (error) {
    console.error('Erreur POST /api/portfolio/groupe:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

  try {
    const body = await request.json();
    const groupeId = typeof body.groupeId === 'string' ? body.groupeId : '';
    const action = typeof body.action === 'string' ? body.action : '';
    if (!groupeId || !action) return NextResponse.json({ success: false, message: 'groupeId et action requis' }, { status: 400 });

    const ref = adminDb.collection('portfolioGroupes').doc(groupeId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ success: false, message: 'Groupe introuvable' }, { status: 404 });
    const g = docToGroupe(snap);
    const now = new Date().toISOString();

    if (auth.role === 'eleve') {
      const identite = await identiteEleve(auth.uid, auth.email);
      const mes = identite.eleveIds;
      const membre = g.membres.find((m) => mes.includes(m.eleveId));
      if (!membre) return NextResponse.json({ success: false, message: 'Tu n’es pas dans ce groupe' }, { status: 403 });
      if (g.statut === 'accepte') {
        return NextResponse.json({ success: false, message: 'Ce groupe a été accepté par le professeur' }, { status: 400 });
      }
      if (action === 'confirmer' || action === 'decliner') {
        const membres = g.membres.map((m) =>
          m.eleveId === membre.eleveId ? { ...m, statut: action === 'confirmer' ? 'confirme' : 'decline' } : m
        );
        await ref.update({ membres, updatedAt: now });
      } else if (action === 'quitter') {
        // Le créateur qui quitte dissout le groupe ; un partenaire se retire
        if (membre.eleveId === g.createurEleveId) await ref.delete();
        else await ref.update({ membres: g.membres.filter((m) => m.eleveId !== membre.eleveId), updatedAt: now });
      } else {
        return NextResponse.json({ success: false, message: 'Action inconnue' }, { status: 400 });
      }
      const apres = await ref.get();
      return NextResponse.json({
        success: true,
        data: apres.exists ? await groupeVue(docToGroupe(apres), { mesEleveIds: mes }) : null,
      });
    }

    if (auth.role !== 'prof' || !(await profPeutGerer(g.devoirId, auth))) {
      return NextResponse.json({ success: false, message: 'Acces refuse' }, { status: 403 });
    }
    if (action === 'accepter') {
      // Les partenaires qui n'ont pas répondu sont confirmés par l'acceptation
      // du prof ; ceux qui ont décliné sortent du groupe
      const membres = g.membres
        .filter((m) => m.statut !== 'decline')
        .map((m) => ({ ...m, statut: 'confirme' }));
      await ref.update({ membres, statut: 'accepte', motif: '', updatedAt: now });
    } else if (action === 'refuser') {
      const motif = typeof body.motif === 'string' ? body.motif.trim().slice(0, 500) : '';
      await ref.update({ statut: 'refuse', motif, updatedAt: now });
    } else if (action === 'annuler') {
      await ref.update({ statut: 'attente', motif: '', updatedAt: now });
    } else {
      return NextResponse.json({ success: false, message: 'Action inconnue' }, { status: 400 });
    }
    const apres = await ref.get();
    return NextResponse.json({ success: true, data: await groupeVue(docToGroupe(apres), { nomsComplets: true }) });
  } catch (error) {
    console.error('Erreur PATCH /api/portfolio/groupe:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
