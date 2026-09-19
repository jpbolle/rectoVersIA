import { NextRequest, NextResponse } from 'next/server';
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
