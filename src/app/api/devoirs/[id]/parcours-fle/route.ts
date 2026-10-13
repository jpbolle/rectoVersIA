import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { docToModuleFle } from '@/lib/module-fle-server';
import { identiteEleve, lireSequenceFle, sequenceOuverteA } from '@/lib/sequence-server';
import { concerne } from '@/types/sequence-fle';
import type { EtapeParcours, EtatActiviteParcours, ParcoursFle } from '@/types/sequence-fle';

// Le PARCOURS d'une séquence FLE, prêt à afficher : les étapes (théories
// lues dans la bibliothèque, activités) et, pour l'élève, l'état de chaque
// activité.
//
//  - élève : seulement les étapes qui le concernent ; l'état se DÉDUIT du
//    travail `TRV-{devoirId}-{uid}` (rien n'est stocké — patron de la maison) ;
//  - prof  : toutes les étapes, sans état (il suit ses élèves ailleurs).
//
// Une THÉORIE, elle, n'a pas de copie : « J'ai lu, je continue » est rangé dans
// une fiche de progression à part, `progressionsSequence/{devoirId}_{uid}`
// (`lues` = ids d'étapes) — PATCH ci-dessous (plan 2026-10-13, option A).

function etatDe(status: unknown): EtatActiviteParcours {
  if (status === 'submitted') return 'fait';
  if (status === 'draft') return 'en-cours';
  return 'a-faire';
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

  try {
    const { id } = await params;
    const snap = await adminDb.collection('devoirs').doc(id).get();
    if (!snap.exists) return NextResponse.json({ success: false, message: 'Activité introuvable' }, { status: 404 });
    const data = snap.data()!;
    if (data.typeTravail !== 'sequence') {
      return NextResponse.json({ success: false, message: 'Cette activité n’est pas une séquence' }, { status: 400 });
    }

    const contenu = lireSequenceFle(data.sequenceFle);
    let etapesRefs = contenu.etapes;
    let eleveIds: string[] = [];

    if (auth.role === 'eleve') {
      const identite = await identiteEleve(auth.uid, auth.email);
      eleveIds = identite.eleveIds;
      if (!(await sequenceOuverteA({ id, ...data }, identite))) {
        return NextResponse.json({ success: false, message: 'Devoir non disponible' }, { status: 403 });
      }
      etapesRefs = contenu.etapes.filter((e) => concerne(e.eleves, eleveIds));
    } else if (auth.role === 'prof' && data.profId !== auth.uid && !auth.isAdmin) {
      return NextResponse.json({ success: false, message: 'Acces refuse' }, { status: 403 });
    }

    // Les modules (théories), en une lecture
    const moduleIds = [...new Set(etapesRefs.filter((e) => e.nature === 'theorie').map((e) => e.moduleId!))];
    const docs = moduleIds.length
      ? await adminDb.getAll(...moduleIds.map((m) => adminDb.collection('modulesFle').doc(m)))
      : [];
    const parId = new Map(docs.filter((d) => d.exists).map((d) => [d.id, docToModuleFle(d)]));

    // L'état de chaque activité, pour l'élève : une lecture par activité
    const devoirIds = [...new Set(etapesRefs.filter((e) => e.nature === 'activite').map((e) => e.devoirId!))];
    const etats = new Map<string, EtatActiviteParcours>();
    if (auth.role === 'eleve' && devoirIds.length > 0) {
      const travaux = await adminDb.getAll(
        ...devoirIds.map((d) => adminDb.collection('travaux').doc(`TRV-${d}-${auth.uid}`))
      );
      travaux.forEach((t, i) => etats.set(devoirIds[i], t.exists ? etatDe(t.data()?.status) : 'a-faire'));
    }

    // Les théories lues par l'élève
    const lues = new Set<string>();
    if (auth.role === 'eleve') {
      const prog = await adminDb.collection('progressionsSequence').doc(`${id}_${auth.uid}`).get();
      const brut = prog.exists ? prog.data()?.lues : null;
      if (Array.isArray(brut)) brut.forEach((x) => typeof x === 'string' && lues.add(x));
    }

    const etapes: EtapeParcours[] = [];
    for (const e of etapesRefs) {
      if (e.nature === 'theorie') {
        // Un point de théorie ARCHIVÉ reste dans les séquences qui l'utilisent :
        // l'archivage le retire de la bibliothèque, pas des parcours en cours
        // (c'est ce que promet la popup d'archivage — le code le sautait
        // jusqu'au 2026-09-19). Seul un document disparu est passé.
        const m = parId.get(e.moduleId!);
        if (!m) continue;
        etapes.push({
          id: e.id,
          nature: 'theorie',
          moduleId: m.id,
          titre: m.titre,
          type: m.type,
          niveau: m.niveau,
          competences: m.competences,
          introduction: m.introduction,
          ressources: m.ressources,
          etat: lues.has(e.id) ? 'fait' : 'a-faire',
        });
      } else {
        etapes.push({
          id: e.id,
          nature: 'activite',
          devoirId: e.devoirId!,
          intitule: e.titre,
          typeTravail: e.typeTravail,
          atelier: e.atelier,
          etat: etats.get(e.devoirId!) ?? 'a-faire',
        });
      }
    }

    const parcours: ParcoursFle = { devoirId: id, intitule: data.intitule || '', etapes };
    return NextResponse.json({ success: true, data: parcours });
  } catch (error) {
    console.error('Erreur GET /api/devoirs/[id]/parcours-fle:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}

// PATCH { etapeId, lu } — l'élève marque une théorie comme lue (ou se ravise).
// Seulement une étape THÉORIE de cette séquence, qui le concerne, dans une
// séquence qui lui est ouverte.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  if (auth.role !== 'eleve') {
    return NextResponse.json({ success: false, message: 'Réservé aux élèves' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const etapeId = typeof body.etapeId === 'string' ? body.etapeId : '';
    const lu = body.lu !== false;
    if (!etapeId) return NextResponse.json({ success: false, message: 'Étape manquante' }, { status: 400 });

    const snap = await adminDb.collection('devoirs').doc(id).get();
    if (!snap.exists) return NextResponse.json({ success: false, message: 'Activité introuvable' }, { status: 404 });
    const data = snap.data()!;
    if (data.typeTravail !== 'sequence') {
      return NextResponse.json({ success: false, message: 'Cette activité n’est pas une séquence' }, { status: 400 });
    }
    const identite = await identiteEleve(auth.uid, auth.email);
    if (!(await sequenceOuverteA({ id, ...data }, identite))) {
      return NextResponse.json({ success: false, message: 'Devoir non disponible' }, { status: 403 });
    }
    const etape = lireSequenceFle(data.sequenceFle).etapes.find((e) => e.id === etapeId);
    if (!etape || etape.nature !== 'theorie' || !concerne(etape.eleves, identite.eleveIds)) {
      return NextResponse.json({ success: false, message: 'Étape introuvable' }, { status: 404 });
    }

    await adminDb
      .collection('progressionsSequence')
      .doc(`${id}_${auth.uid}`)
      .set(
        {
          devoirId: id,
          uid: auth.uid,
          lues: lu ? FieldValue.arrayUnion(etapeId) : FieldValue.arrayRemove(etapeId),
          majAt: new Date(),
        },
        { merge: true }
      );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur PATCH /api/devoirs/[id]/parcours-fle:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
