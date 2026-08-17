import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { decryptFields, SENSITIVE_ELEVE_FIELDS } from '@/lib/crypto';
import { queryElevesByEmail } from '@/lib/eleve-lookup';
import {
  buildCertificationsProfil,
  chargerLabelsUaa,
  chargerUaaReferentiel,
  completerRoue,
} from '@/lib/certification-server';
import { atelierParDispositif } from '@/types/didactique';
import type { Accueil, ActiviteAccueil, ResultatAccueil } from '@/types/accueil';

// Page d'accueil de l'élève : ses retards, ses échéances, ses derniers
// résultats, sa progression en ceintures.
//
// Tout est calculé À LA LECTURE, comme les notifications : rien n'est stocké,
// donc rien ne peut se désynchroniser d'un basculement de disponibilité.

const VIDE: Accueil = {
  prenom: '',
  classes: [],
  retards: [],
  echeances: [],
  resultats: [],
  roue: [],
};

// Différence en jours entiers entre aujourd'hui et une échéance.
// On compare des JOURS, pas des instants : une échéance fixée à ce matin n'est
// pas « en retard d'un jour » parce qu'il est midi.
function joursDeRetard(dateRemise: Date, aujourdhui: Date): number {
  const a = Date.UTC(dateRemise.getFullYear(), dateRemise.getMonth(), dateRemise.getDate());
  const b = Date.UTC(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate());
  return Math.round((b - a) / 86_400_000);
}

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });

  try {
    // 1. Qui est-ce ? Un prof en prévisualisation n'est pas un élève : il reçoit
    //    une page vide plutôt qu'une erreur.
    const [parUid, parEmail] = await Promise.all([
      adminDb.collection('eleves').where('firebaseUid', '==', auth.uid).get(),
      queryElevesByEmail(auth.email || ''),
    ]);
    const docs = [...parUid.docs, ...parEmail.docs];
    const uniques = new Map(docs.map((d) => [d.id, d]));
    if (uniques.size === 0) {
      return NextResponse.json({ success: true, data: VIDE });
    }

    const eleveIds = [...uniques.keys()];
    const premier = decryptFields([...uniques.values()][0].data(), SENSITIVE_ELEVE_FIELDS);
    const classeIds = [...new Set([...uniques.values()].map((d) => d.data().classeId))].filter(
      Boolean
    );

    const classesSnap = await Promise.all(
      classeIds.map((id) => adminDb.collection('classes').doc(id).get())
    );
    const classeNames = classesSnap
      .filter((c) => c.exists && !c.data()?.archive)
      .map((c) => c.data()?.nom as string)
      .filter(Boolean);

    // 2. Ses activités, ses travaux, ses corrections visibles
    const [devoirsSnap, travauxSnap] = await Promise.all([
      adminDb.collection('devoirs').get(),
      adminDb.collection('travaux').where('studentId', '==', auth.uid).get(),
    ]);

    const devoirs = devoirsSnap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: data.id || d.id,
          intitule: (data.intitule as string) || 'Activité',
          classes: (data.classes as string[]) || [],
          disponible: data.disponible ?? true,
          archive: data.archive ?? false,
          corrigeDisponible: data.corrigeDisponible ?? false,
          typeTravail: (data.typeTravail as string) || 'ecrire',
          atelier:
            (data.atelier as string) ||
            atelierParDispositif((data.typeTravail as never) || 'ecrire').id,
          dateRemise: data.dateRemise?.toDate?.() ?? null,
        };
      })
      .filter(
        (d) =>
          d.disponible &&
          !d.archive &&
          d.classes.some((c) => classeNames.includes(c))
      );

    const travaux = new Map(
      travauxSnap.docs.map((d) => {
        const data = d.data();
        return [
          data.devoirId as string,
          {
            travailId: d.id,
            status: (data.status as string) || 'draft',
            nonRendu: (data.nonRendu as string | null) || null,
          },
        ];
      })
    );

    // Corrections visibles — un lot de 30 identifiants au plus par requête `in`
    const travailIds = [...travaux.values()].map((t) => `CORR-${t.travailId}`);
    const lots = Array.from({ length: Math.ceil(travailIds.length / 30) }, (_, i) =>
      travailIds.slice(i * 30, (i + 1) * 30)
    );
    const corrections = (
      await Promise.all(
        lots.map(async (lot) => {
          const snap = await adminDb
            .collection('corrections')
            .where('__name__', 'in', lot)
            .get();
          return snap.docs.map((d) => d.data());
        })
      )
    )
      .flat()
      .filter((c) => c.visibleParEleve);

    // 3. Les trois blocs
    const maintenant = new Date();
    const enCours: ActiviteAccueil[] = [];
    const retards: ActiviteAccueil[] = [];

    devoirs.forEach((d) => {
      // Sans échéance, une activité ne peut être ni en retard ni « à venir » :
      // l'échéance est facultative dans Recto-versIA (cf. INIT.md §4).
      if (!d.dateRemise) return;
      const t = travaux.get(d.id);
      // Remis, corrigé, ou décrété non rendu par le prof : plus rien à faire
      if (t?.status === 'submitted' || t?.nonRendu || d.corrigeDisponible) return;

      const jours = joursDeRetard(d.dateRemise, maintenant);
      const item: ActiviteAccueil = {
        devoirId: d.id,
        intitule: d.intitule,
        atelier: d.atelier,
        typeTravail: d.typeTravail,
        dateRemise: d.dateRemise.toISOString(),
        joursDeRetard: jours,
      };
      if (jours > 0) retards.push(item);
      else enCours.push(item);
    });

    retards.sort((a, b) => b.joursDeRetard - a.joursDeRetard);
    enCours.sort((a, b) => a.joursDeRetard - b.joursDeRetard);

    const intituleDe = new Map(devoirs.map((d) => [d.id, d.intitule]));
    const resultats: ResultatAccueil[] = corrections
      .filter((c) => typeof c.score === 'number')
      .map((c) => ({
        devoirId: c.devoirId as string,
        intitule: intituleDe.get(c.devoirId as string) || 'Activité',
        date: (c.updatedAt as string) || (c.createdAt as string) || '',
        percent: Math.round(c.score as number),
      }))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 5);

    // 4. La progression en ceintures — le même calcul que l'onglet Général du
    //    profil, pour que les deux écrans ne puissent pas se contredire, puis
    //    complété avec les UAA jamais certifiées : elles portent la blanche.
    const [labels, referentiel] = await Promise.all([
      chargerLabelsUaa(),
      chargerUaaReferentiel(),
    ]);
    const certifications = await buildCertificationsProfil(eleveIds, labels);
    const roue = completerRoue(certifications, referentiel);

    const data: Accueil = {
      prenom: (premier.prenom as string) || '',
      classes: classeNames,
      retards: retards.slice(0, 6),
      echeances: enCours.slice(0, 6),
      resultats,
      roue,
    };

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Erreur GET /api/accueil:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
