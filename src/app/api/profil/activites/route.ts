import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/api-auth';
import { hashEmail } from '@/lib/crypto';
import { queryElevesByEmail } from '@/lib/eleve-lookup';
import { isProfilTargetError, resolveProfilTarget } from '@/lib/profil-target';
import { lecturesDe } from '@/lib/lecture-cours-server';
import { lireSequenceFle } from '@/lib/sequence-server';
import { evaluationsDesClasses } from '@/lib/evaluations-fle-server';

// GET ?eleveId= — la vue « Activités » de la fiche d'un élève (prof, 2026-10-08) :
// ses activités avec son avancement, ses parcours FLE étape par étape, ses
// lectures de cours, ses évaluations. Même garde que /api/profil/* (un élève
// d'une classe du prof) ; sans paramètre, l'élève connecté lui-même.

type Statut = 'non-commence' | 'en-cours' | 'remis' | 'corrige';

interface ActiviteVue {
  devoirId: string;
  intitule: string;
  typeTravail: string;
  atelier: string | null;
  classes: string[];
  dateRemise: string | null;
  archive: boolean;
  statut: Statut;
  score: number | null;
}

function toISO(v: unknown): string | null {
  const d = v as { toDate?: () => Date } | null;
  if (d && typeof d.toDate === 'function') return d.toDate().toISOString();
  return typeof v === 'string' ? v : null;
}

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ success: false, message: 'Non autorisé' }, { status: 401 });

  try {
    const target = await resolveProfilTarget(auth, request);
    if (isProfilTargetError(target)) {
      return NextResponse.json({ success: false, message: target.errorMessage }, { status: target.errorStatus });
    }
    const { uid, email } = target;

    // 1. Ses fiches et ses classes
    const [parUid, parEmail] = await Promise.all([
      uid ? adminDb.collection('eleves').where('firebaseUid', '==', uid).get() : Promise.resolve({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] }),
      queryElevesByEmail(email),
    ]);
    const classeIds = [...new Set([...parUid.docs, ...parEmail.docs].map((d) => String(d.data().classeId ?? '')).filter(Boolean))];
    const classes = await Promise.all(classeIds.map((id) => adminDb.collection('classes').doc(id).get()));
    const nomsClasses = classes.filter((c) => c.exists).map((c) => String(c.data()?.nom ?? '')).filter(Boolean);
    const classesFle = classes.filter((c) => c.exists && c.data()?.type === 'fle').map((c) => c.id);

    // 2. Les activités données à ses classes
    const devoirsMap = new Map<string, FirebaseFirestore.DocumentData>();
    await Promise.all(
      nomsClasses.map(async (nom) => {
        const snap = await adminDb.collection('devoirs').where('classes', 'array-contains', nom).get();
        snap.docs.forEach((d) => devoirsMap.set(d.id, { id: d.id, ...d.data() }));
      })
    );

    // 3. Ses copies (par uid, et par empreinte d'email pour les copies pré-créées)
    const travaux = new Map<string, { id: string; status: string; nonRendu: unknown }>();
    const lots = await Promise.all([
      uid ? adminDb.collection('travaux').where('studentId', '==', uid).select('devoirId', 'status', 'nonRendu').get() : null,
      email ? adminDb.collection('travaux').where('studentEmailHash', '==', hashEmail(email)).select('devoirId', 'status', 'nonRendu').get() : null,
    ]);
    lots.forEach((snap) =>
      snap?.docs.forEach((d) => {
        const data = d.data();
        travaux.set(String(data.devoirId), { id: d.id, status: String(data.status ?? 'draft'), nonRendu: data.nonRendu ?? null });
      })
    );
    // 4. Les corrections visibles (score)
    const corrections = new Map<string, number | null>();
    const travailIds = [...travaux.values()].map((t) => t.id);
    for (let i = 0; i < travailIds.length; i += 30) {
      const ids = travailIds.slice(i, i + 30).map((id) => `CORR-${id}`);
      const snap = await adminDb.collection('corrections').where('__name__', 'in', ids).get();
      snap.docs.forEach((d) => {
        const data = d.data();
        if (data.visibleParEleve) corrections.set(String(data.travailId), typeof data.score === 'number' ? data.score : null);
      });
    }
    const statutDe = (devoirId: string): { statut: Statut; score: number | null } => {
      const t = travaux.get(devoirId);
      if (!t) return { statut: 'non-commence', score: null };
      if (corrections.has(t.id)) return { statut: 'corrige', score: corrections.get(t.id) ?? null };
      if (t.status === 'submitted') return { statut: 'remis', score: null };
      return { statut: 'en-cours', score: null };
    };

    const activites: ActiviteVue[] = [];
    const parcours: { devoirId: string; intitule: string; etapes: { titre: string; nature: string; devoirId: string | null; statut: Statut | null }[] }[] = [];
    devoirsMap.forEach((d, id) => {
      if (d.referentiel === 'fle') return; // une activité FLE sans classe ne s'ouvre que par sa séquence
      if (d.typeTravail === 'sequence') {
        const contenu = lireSequenceFle(d.sequenceFle);
        parcours.push({
          devoirId: id,
          intitule: String(d.intitule ?? ''),
          etapes: (contenu?.etapes ?? []).map((e) => ({
            titre: e.titre,
            nature: e.nature,
            devoirId: e.devoirId ?? null,
            statut: e.devoirId ? statutDe(e.devoirId).statut : null,
          })),
        });
        return;
      }
      const { statut, score } = statutDe(id);
      activites.push({
        devoirId: id,
        intitule: String(d.intitule ?? ''),
        typeTravail: String(d.typeTravail ?? 'ecrire'),
        atelier: typeof d.atelier === 'string' ? d.atelier : null,
        classes: Array.isArray(d.classes) ? d.classes.filter((c: unknown) => nomsClasses.includes(String(c))) : [],
        dateRemise: toISO(d.dateRemise),
        archive: d.archive === true,
        statut,
        score,
      });
    });
    activites.sort((a, b) => (b.dateRemise ?? '').localeCompare(a.dateRemise ?? ''));

    // 5. Ses lectures de cours et ses évaluations FLE
    const lectures = uid ? await lecturesDe('eleveUid', uid) : [];
    const evaluations = (await evaluationsDesClasses(classesFle)).map((e) => ({
      ...e,
      statut: e.source.kind === 'activite' ? statutDe(e.source.devoirId).statut : undefined,
    }));

    return NextResponse.json({ success: true, data: { activites, parcours, lectures, evaluations } });
  } catch (error) {
    console.error('Erreur GET /api/profil/activites:', error);
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 });
  }
}
