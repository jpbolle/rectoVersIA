import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import {
  COLLECTION_NOTES,
  faitsAutomatiques,
  resumerCertifications,
} from '@/lib/certification-server';
import { normaliserScenarisation } from '@/types/scenarisation';
import type { Scenarisation } from '@/types/scenarisation';
import type { CertificationDeClasse } from '@/types/certification';

// Les certifications qui visent une classe, avec l'avancement de la saisie.
// Alimente le bloc « Certifications » du détail d'une classe (Mes Classes).

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  if (auth.role !== 'prof') return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });

  const classeId = new URL(request.url).searchParams.get('classeId');
  if (!classeId) {
    return NextResponse.json({ success: false, message: 'classeId requis' }, { status: 400 });
  }

  try {
    const classeDoc = await adminDb.collection('classes').doc(classeId).get();
    if (!classeDoc.exists || classeDoc.data()?.profId !== auth.uid) {
      return NextResponse.json({ success: false, message: 'Acces refuse' }, { status: 403 });
    }
    const classeNom = classeDoc.data()?.nom as string;

    const [scenSnap, elevesSnap] = await Promise.all([
      adminDb.collection('scenarisations').where('profId', '==', auth.uid).get(),
      adminDb.collection('eleves').where('classeId', '==', classeId).get(),
    ]);

    // Le parcours désigne ses classes par NOM (cf. devoirs.classes)
    const certifs = scenSnap.docs
      .map((d) => normaliserScenarisation({ id: d.id, ...d.data() } as Scenarisation))
      .filter((s) => !s.archive && (s.classes ?? []).includes(classeNom))
      .flatMap(resumerCertifications);

    if (certifs.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const elevesIds = new Set(elevesSnap.docs.map((d) => d.id));

    // Les élèves de la classe, avec leur compte Google : c'est par lui que la
    // copie corrigée se rattache à l'élève.
    const elevesClasse = elevesSnap.docs.map((d) => ({
      eleveId: d.id,
      nom: '',
      prenom: '',
      classeId,
      classeNom,
      firebaseUid: (d.data().firebaseUid as string) || null,
      emailHash: (d.data().emailHash as string) || null,
    }));

    const data: CertificationDeClasse[] = await Promise.all(
      certifs.map(async (c) => {
        // Une certification NON COTÉE se coche toute seule quand la copie est
        // corrigée : sans en tenir compte, le compteur annoncerait « 0 / 19 »
        // alors que la classe entière a fini (2026-09-20).
        const [snap, faitsAuto] = await Promise.all([
          adminDb.collection(COLLECTION_NOTES).where('moduleId', '==', c.moduleId).get(),
          c.cotation === 'fait'
            ? faitsAutomatiques(c.devoirId, elevesClasse)
            : Promise.resolve(new Set<string>()),
        ]);
        const comptees = new Set(
          snap.docs.map((d) => d.data().eleveId as string).filter((id) => elevesIds.has(id))
        );
        faitsAuto.forEach((id) => comptees.add(id));
        return {
          ...c,
          notees: comptees.size,
          eleves: elevesIds.size,
        };
      })
    );

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Erreur GET /api/certifications/classe:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
