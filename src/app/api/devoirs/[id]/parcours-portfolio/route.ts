import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { lirePortfolioContenu } from '@/lib/portfolio-server';
import { identiteEleve, sequenceOuverteA } from '@/lib/sequence-server';
import type { EtapePortfolioVue, ParcoursPortfolio } from '@/lib/portfolio-etat';
import type { EtatActiviteParcours } from '@/types/sequence-fle';

// Le PORTFOLIO d'un élève, prêt à afficher : les étapes de l'activité, les
// renvois résolus (titre à jour de l'activité, et pour l'élève son état —
// déduit de `TRV-{devoirId}-{uid}`, rien n'est stocké). Même patron que le
// parcours d'une séquence FLE.
//
//  - élève : l'activité doit lui être ouverte (classe, élèves choisis, session) ;
//  - prof  : l'auteur (ou l'admin) ; toutes les étapes — avec l'état d'un élève
//    si `?eleve={uid}` (lecture de sa copie).

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
    if (data.typeTravail !== 'portfolio') {
      return NextResponse.json({ success: false, message: 'Cette activité n’est pas un portfolio' }, { status: 400 });
    }

    if (auth.role === 'eleve') {
      const identite = await identiteEleve(auth.uid, auth.email);
      if (!(await sequenceOuverteA({ id, ...data }, identite))) {
        return NextResponse.json({ success: false, message: 'Devoir non disponible' }, { status: 403 });
      }
    } else if (auth.role === 'prof' && data.profId !== auth.uid && !auth.isAdmin) {
      return NextResponse.json({ success: false, message: 'Acces refuse' }, { status: 403 });
    }
    // Pour qui calculer l'état des renvois : l'élève lui-même, ou celui que le prof lit
    const eleveDemande = request.nextUrl.searchParams.get('eleve');
    const uidEtats = auth.role === 'eleve' ? auth.uid : auth.role === 'prof' && eleveDemande ? eleveDemande : null;

    const contenu = lirePortfolioContenu(data.portfolio);
    const devoirIds = [...new Set(contenu.etapes.filter((e) => e.nature === 'activite').map((e) => e.devoirId!))];

    // Les activités renvoyées : leur titre à jour, et pour l'élève leur état
    const titres = new Map<string, string>();
    const etats = new Map<string, EtatActiviteParcours>();
    if (devoirIds.length > 0) {
      const docs = await adminDb.getAll(...devoirIds.map((d) => adminDb.collection('devoirs').doc(d)));
      docs.forEach((d, i) => {
        if (d.exists && typeof d.data()?.intitule === 'string') titres.set(devoirIds[i], d.data()!.intitule);
      });
      if (uidEtats) {
        const travaux = await adminDb.getAll(
          ...devoirIds.map((d) => adminDb.collection('travaux').doc(`TRV-${d}-${uidEtats}`))
        );
        travaux.forEach((t, i) => etats.set(devoirIds[i], t.exists ? etatDe(t.data()?.status) : 'a-faire'));
      }
    }

    const etapes: EtapePortfolioVue[] = contenu.etapes.map((e) =>
      e.nature === 'activite'
        ? {
            ...e,
            titre: titres.get(e.devoirId!) ?? e.titre,
            etatRenvoi: uidEtats ? etats.get(e.devoirId!) ?? 'a-faire' : undefined,
          }
        : e
    );

    const parcours: ParcoursPortfolio = {
      devoirId: id,
      intitule: data.intitule || '',
      tacheFinale: contenu.tacheFinale ?? '',
      consignes: typeof data.consignes === 'string' ? data.consignes : '',
      etapes,
    };
    return NextResponse.json({ success: true, data: parcours });
  } catch (error) {
    console.error('Erreur GET /api/devoirs/[id]/parcours-portfolio:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
