import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { COLLECTION_NOTES, resumerCertifications } from '@/lib/certification-server';
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
    const data: CertificationDeClasse[] = await Promise.all(
      certifs.map(async (c) => {
        const snap = await adminDb
          .collection(COLLECTION_NOTES)
          .where('moduleId', '==', c.moduleId)
          .get();
        return {
          ...c,
          notees: snap.docs.filter((d) => elevesIds.has(d.data().eleveId)).length,
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
